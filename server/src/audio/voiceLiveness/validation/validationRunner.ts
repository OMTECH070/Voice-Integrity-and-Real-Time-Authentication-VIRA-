import { performance } from "perf_hooks";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { voiceAuthService, EnrolledVoiceProfile } from "../../../services/voiceAuth.service";
import {
  voiceIntegrityService,
  VoiceIntegrityStatus,
} from "../../../services/voiceIntegrity.service";

export interface AudioSampleInput {
  id: string;
  speakerId: string;
  samples: Float32Array;
  sampleRate: number;
  expectedLabel?: "human-verified" | "possible-ai" | "speaker-mismatch" | "uncertain";
  category?: string; // e.g. "genuine", "impostor", "tts", "replay", "noise", "codec"
}

export interface SampleValidationResult {
  id: string;
  speakerId: string;
  category: string;
  sampleRate: number;
  durationSeconds: number;
  // AASIST Telemetry
  spoofScore: number;
  spoofLabel: "live" | "likely-synthetic" | "uncertain";
  aasistLatencyMs: number;
  // ECAPA Telemetry
  speakerSimilarity?: number;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled";
  ecapaLatencyMs: number;
  // Fused Voice Integrity
  fusedStatus: VoiceIntegrityStatus;
  confidence: number;
  reason: string;
  fusionLatencyMs: number;
  totalPipelineLatencyMs: number;
  // Test Evaluation
  passed?: boolean;
  notes?: string;
}

export interface LatencyDistribution {
  min: number;
  mean: number;
  p95: number;
  max: number;
}

export interface ValidationSummaryReport {
  timestamp: string;
  totalSamplesEvaluated: number;
  categories: Record<string, { total: number; passed: number; failed: number }>;
  genuineScores: number[];
  impostorScores: number[];
  spoofScores: number[];
  genuineScoreMoments: { mean: number; stdDev: number; min: number; max: number };
  impostorScoreMoments: { mean: number; stdDev: number; min: number; max: number };
  latency: {
    aasist: LatencyDistribution;
    ecapa: LatencyDistribution;
    fusion: LatencyDistribution;
    total: LatencyDistribution;
  };
  farAtMatchThreshold: number;
  frrAtMatchThreshold: number;
  qualityGateStatus: "READY FOR DEMONSTRATION" | "NEEDS CALIBRATION" | "NEEDS ENGINEERING FIXES" | "NEEDS MORE REAL-WORLD DATA";
  results: SampleValidationResult[];
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function computeDistribution(values: number[]): LatencyDistribution {
  if (values.length === 0) {
    return { min: 0, mean: 0, p95: 0, max: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const p95 = calculatePercentile(values, 95);
  return { min, mean, p95, max };
}

function computeMoments(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 };
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / Math.max(1, values.length - 1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { mean, stdDev: Math.sqrt(variance), min, max };
}

/**
 * Executes end-to-end VIRA validation on a single sample using identical production services.
 */
export async function validateSingleSample(
  sample: AudioSampleInput,
  enrolledProfile?: EnrolledVoiceProfile
): Promise<SampleValidationResult> {
  // Ensure models are initialized
  if (!voiceLivenessService.isReady()) {
    voiceLivenessService.init();
  }
  if (!voiceAuthService.isReady()) {
    await voiceAuthService.init();
  }

  const tStart = performance.now();

  // 1. AASIST Inference
  const tAasistStart = performance.now();
  const aasistResult = await voiceLivenessService.analyze(sample.samples, sample.sampleRate);
  const aasistLatencyMs = performance.now() - tAasistStart;

  // 2. ECAPA Embedding & Similarity
  const tEcapaStart = performance.now();
  const embedding = await voiceAuthService.extractEmbedding(sample.samples, sample.sampleRate);
  let speakerSimilarity: number | undefined;
  let speakerMatchLabel: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" =
    enrolledProfile ? "uncertain" : "not-enrolled";

  if (enrolledProfile) {
    const verification = voiceAuthService.verifySpeaker(enrolledProfile, embedding);
    speakerSimilarity = verification.similarity;
    speakerMatchLabel = verification.label;
  }
  const ecapaLatencyMs = performance.now() - tEcapaStart;

  // 3. Fused Decision
  const tFusionStart = performance.now();
  const singleWindow = voiceIntegrityService.classifySingleWindow(
    aasistResult.spoofScore,
    speakerSimilarity,
    !!enrolledProfile
  );
  const fusionLatencyMs = performance.now() - tFusionStart;
  const totalPipelineLatencyMs = performance.now() - tStart;

  let passed: boolean | undefined;
  if (sample.expectedLabel) {
    passed = singleWindow.rawStatus === sample.expectedLabel;
  }

  return {
    id: sample.id,
    speakerId: sample.speakerId,
    category: sample.category ?? "unclassified",
    sampleRate: sample.sampleRate,
    durationSeconds: sample.samples.length / sample.sampleRate,
    spoofScore: aasistResult.spoofScore,
    spoofLabel: aasistResult.label,
    aasistLatencyMs,
    speakerSimilarity,
    speakerMatchLabel,
    ecapaLatencyMs,
    fusedStatus: singleWindow.rawStatus,
    confidence: singleWindow.confidence,
    reason: singleWindow.reason,
    fusionLatencyMs,
    totalPipelineLatencyMs,
    passed,
  };
}

/**
 * Runs an end-to-end validation suite across a collection of samples and builds a full validation report.
 */
export async function runValidationSuite(
  samples: AudioSampleInput[],
  enrolledProfile?: EnrolledVoiceProfile
): Promise<ValidationSummaryReport> {
  const results: SampleValidationResult[] = [];
  const aasistLatencies: number[] = [];
  const ecapaLatencies: number[] = [];
  const fusionLatencies: number[] = [];
  const totalLatencies: number[] = [];

  const genuineScores: number[] = [];
  const impostorScores: number[] = [];
  const spoofScores: number[] = [];

  const categories: Record<string, { total: number; passed: number; failed: number }> = {};

  for (const sample of samples) {
    const res = await validateSingleSample(sample, enrolledProfile);
    results.push(res);

    aasistLatencies.push(res.aasistLatencyMs);
    ecapaLatencies.push(res.ecapaLatencyMs);
    fusionLatencies.push(res.fusionLatencyMs);
    totalLatencies.push(res.totalPipelineLatencyMs);

    spoofScores.push(res.spoofScore);

    if (res.speakerSimilarity !== undefined) {
      if (sample.category === "genuine" || (sample.speakerId === enrolledProfile?.userId && sample.category !== "synthetic")) {
        genuineScores.push(res.speakerSimilarity);
      } else if (sample.category === "impostor") {
        impostorScores.push(res.speakerSimilarity);
      }
    }

    const cat = res.category;
    if (!categories[cat]) {
      categories[cat] = { total: 0, passed: 0, failed: 0 };
    }
    categories[cat].total++;
    if (res.passed === true) {
      categories[cat].passed++;
    } else if (res.passed === false) {
      categories[cat].failed++;
    }
  }

  const genuineMoments = computeMoments(genuineScores);
  const impostorMoments = computeMoments(impostorScores);

  const calibration = voiceIntegrityService.getCalibration();
  const matchThreshold = calibration.ecapaMatchThreshold;

  const falseAcceptances = impostorScores.filter((s) => s >= matchThreshold).length;
  const falseRejections = genuineScores.filter((s) => s < matchThreshold).length;

  const far = impostorScores.length > 0 ? (falseAcceptances / impostorScores.length) * 100 : 0;
  const frr = genuineScores.length > 0 ? (falseRejections / genuineScores.length) * 100 : 0;

  // Quality gate evaluation
  let qualityGateStatus: "READY FOR DEMONSTRATION" | "NEEDS CALIBRATION" | "NEEDS ENGINEERING FIXES" | "NEEDS MORE REAL-WORLD DATA";
  if (samples.length < 10) {
    qualityGateStatus = "NEEDS MORE REAL-WORLD DATA";
  } else if (far > 5 || frr > 5) {
    qualityGateStatus = "NEEDS CALIBRATION";
  } else {
    qualityGateStatus = "READY FOR DEMONSTRATION";
  }

  return {
    timestamp: new Date().toISOString(),
    totalSamplesEvaluated: samples.length,
    categories,
    genuineScores,
    impostorScores,
    spoofScores,
    genuineScoreMoments: genuineMoments,
    impostorScoreMoments: impostorMoments,
    latency: {
      aasist: computeDistribution(aasistLatencies),
      ecapa: computeDistribution(ecapaLatencies),
      fusion: computeDistribution(fusionLatencies),
      total: computeDistribution(totalLatencies),
    },
    farAtMatchThreshold: far,
    frrAtMatchThreshold: frr,
    qualityGateStatus,
    results,
  };
}
