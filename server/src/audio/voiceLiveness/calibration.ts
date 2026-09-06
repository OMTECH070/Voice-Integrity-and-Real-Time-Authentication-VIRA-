import { voiceAuthService } from "../../services/voiceAuth.service";
import { logger } from "../../utils/logger";

export interface AudioSample {
  id: string;
  speakerId: string;
  samples: Float32Array;
  sampleRate: number;
  condition?: string; // e.g., "clean", "opus_compressed", "noisy_snr_10db", "pitch_shift"
}

export interface PairEvaluationResult {
  pairType: "genuine" | "impostor";
  speakerA: string;
  sampleA: string;
  speakerB: string;
  sampleB: string;
  similarity: number;
  condition?: string;
}

export interface CalibrationStats {
  genuineMean: number;
  genuineStdDev: number;
  genuineMin: number;
  genuineMax: number;
  impostorMean: number;
  impostorStdDev: number;
  impostorMin: number;
  impostorMax: number;
  recommendedMatchThreshold: number;
  recommendedUncertainThreshold: number;
  recommendedMismatchThreshold: number;
  farAtMatch: number; // False Acceptance Rate (%)
  frrAtMatch: number; // False Rejection Rate (%)
  totalGenuinePairs: number;
  totalImpostorPairs: number;
}

/**
 * Computes mean and sample standard deviation of an array of numbers.
 */
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
 * Calibrates ECAPA-TDNN cosine similarity thresholds against a corpus of audio samples.
 */
export async function evaluateCalibrationCorpus(
  samples: AudioSample[],
  customMatchThreshold = 0.92,
  customUncertainThreshold = 0.82
): Promise<{ pairs: PairEvaluationResult[]; stats: CalibrationStats }> {
  // 1. Extract and cache embeddings for all samples
  const embeddings = new Map<string, Float32Array>();
  for (const sample of samples) {
    const emb = await voiceAuthService.extractEmbedding(sample.samples, sample.sampleRate);
    embeddings.set(sample.id, emb);
  }

  // 2. Generate all unique (i, j) pairs
  const pairResults: PairEvaluationResult[] = [];
  const genuineScores: number[] = [];
  const impostorScores: number[] = [];

  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const sA = samples[i];
      const sB = samples[j];
      const embA = embeddings.get(sA.id)!;
      const embB = embeddings.get(sB.id)!;

      const sim = voiceAuthService.computeCosineSimilarity(embA, embB);
      const isGenuine = sA.speakerId === sB.speakerId;
      const pairType = isGenuine ? "genuine" : "impostor";

      pairResults.push({
        pairType,
        speakerA: sA.speakerId,
        sampleA: sA.id,
        speakerB: sB.speakerId,
        sampleB: sB.id,
        similarity: sim,
        condition: `${sA.condition ?? "normal"} x ${sB.condition ?? "normal"}`,
      });

      if (isGenuine) {
        genuineScores.push(sim);
      } else {
        impostorScores.push(sim);
      }
    }
  }

  const genuineMoments = computeMoments(genuineScores);
  const impostorMoments = computeMoments(impostorScores);

  // Compute FAR and FRR at custom threshold
  const falseAcceptances = impostorScores.filter((s) => s >= customMatchThreshold).length;
  const falseRejections = genuineScores.filter((s) => s < customMatchThreshold).length;

  const far = impostorScores.length > 0 ? (falseAcceptances / impostorScores.length) * 100 : 0;
  const frr = genuineScores.length > 0 ? (falseRejections / genuineScores.length) * 100 : 0;

  const stats: CalibrationStats = {
    genuineMean: genuineMoments.mean,
    genuineStdDev: genuineMoments.stdDev,
    genuineMin: genuineMoments.min,
    genuineMax: genuineMoments.max,
    impostorMean: impostorMoments.mean,
    impostorStdDev: impostorMoments.stdDev,
    impostorMin: impostorMoments.min,
    impostorMax: impostorMoments.max,
    recommendedMatchThreshold: customMatchThreshold,
    recommendedUncertainThreshold: customUncertainThreshold,
    recommendedMismatchThreshold: customUncertainThreshold,
    farAtMatch: far,
    frrAtMatch: frr,
    totalGenuinePairs: genuineScores.length,
    totalImpostorPairs: impostorScores.length,
  };

  logger.info(
    `Calibration complete: ${genuineScores.length} genuine pairs (mean: ${genuineMoments.mean.toFixed(
      4
    )}), ${impostorScores.length} impostor pairs (mean: ${impostorMoments.mean.toFixed(
      4
    )}). FAR: ${far.toFixed(2)}%, FRR: ${frr.toFixed(2)}%`
  );

  return { pairs: pairResults, stats };
}
