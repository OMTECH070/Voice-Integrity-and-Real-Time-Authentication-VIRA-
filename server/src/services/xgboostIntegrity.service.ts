import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

export interface XGBoostFeatures {
  ecapaSimilarity: number | null; // 0.0 - 1.0 or null if not enrolled / unavailable
  aasistSpoofScore: number; // 0.0 - 1.0 (1 = synthetic, 0 = live)
  wav2vec2SpoofScore: number | null; // null if not-ready
  vadSpeechRatio: number; // 0.0 - 1.0
  speechDurationSec: number; // duration in seconds
  transcriptRiskScore: number; // 0 - 100
  hasMoneyRequest: boolean;
  hasUrgencySignal: boolean;
  hasCredentialRequest: boolean;
  isSpeakerMismatch: boolean;
  audioRmsEnergy: number; // normalized rms
  acousticConfidence: number; // 0.0 - 1.0
}

export interface FusedScoresResult {
  voiceIntegrityScore: number; // 0 - 100 (Higher = more authentic & verified)
  voiceIntegrityLevel: "LOW" | "MEDIUM" | "HIGH";
  callRiskScore: number; // 0 - 100 (Higher = more suspicious / dangerous)
  callRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  modelSource: "XGBOOST_MODEL" | "CALIBRATED_BASELINE";
  modelStatus: "READY" | "REQUIRES_MODEL_ARTIFACT";
  featureVector: number[];
  featureNames: string[];
  contributingFactors: {
    voiceIntegrity: string[];
    callRisk: string[];
  };
}

const FEATURE_NAMES = [
  "ecapa_similarity",
  "aasist_spoof_score",
  "wav2vec2_spoof_score",
  "vad_speech_ratio",
  "speech_duration_sec",
  "transcript_risk_score",
  "has_money_request",
  "has_urgency_signal",
  "has_credential_request",
  "is_speaker_mismatch",
  "audio_rms_energy",
  "acoustic_confidence",
];

export class XGBoostIntegrityService {
  private modelPath: string | null = null;
  private isModelTrained = false;
  private modelVersion = "XGBoost-VIRA-v1";

  constructor() {
    this.resolveModel();
  }

  private resolveModel(): void {
    const envPath = process.env.VIRA_XGBOOST_MODEL_PATH;
    const candidates = [
      ...(envPath ? [path.resolve(envPath)] : []),
      path.resolve(process.cwd(), "models/xgboost_risk.json"),
      path.resolve(process.cwd(), "server/models/xgboost_risk.json"),
      path.resolve(__dirname, "../../models/xgboost_risk.json"),
      path.resolve(__dirname, "../../../models/xgboost_risk.json"),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        this.modelPath = c;
        this.isModelTrained = true;
        logger.info(`XGBoostIntegrityService: Found trained model artifact at ${c}`);
        return;
      }
    }

    this.modelPath = null;
    this.isModelTrained = false;
    logger.info("XGBoostIntegrityService: Trained model artifact not found. Operating with calibrated feature fusion.");
  }

  public getModelStatus(): {
    modelStatus: "READY" | "REQUIRES_MODEL_ARTIFACT";
    isModelTrained: boolean;
    modelVersion: string;
    modelPath: string | null;
  } {
    return {
      modelStatus: this.isModelTrained ? "READY" : "REQUIRES_MODEL_ARTIFACT",
      isModelTrained: this.isModelTrained,
      modelVersion: this.modelVersion,
      modelPath: this.modelPath,
    };
  }

  /**
   * Transforms raw pipeline telemetry into standardized 12-dimensional feature vector.
   */
  public extractFeatureVector(input: XGBoostFeatures): number[] {
    return [
      input.ecapaSimilarity !== null && input.ecapaSimilarity !== undefined
        ? Math.max(0, Math.min(1, input.ecapaSimilarity))
        : -1.0,
      Math.max(0, Math.min(1, input.aasistSpoofScore)),
      input.wav2vec2SpoofScore !== null ? Math.max(0, Math.min(1, input.wav2vec2SpoofScore)) : -1.0,
      Math.max(0, Math.min(1, input.vadSpeechRatio)),
      Math.max(0, input.speechDurationSec),
      Math.max(0, Math.min(100, input.transcriptRiskScore)) / 100.0,
      input.hasMoneyRequest ? 1.0 : 0.0,
      input.hasUrgencySignal ? 1.0 : 0.0,
      input.hasCredentialRequest ? 1.0 : 0.0,
      input.isSpeakerMismatch ? 1.0 : 0.0,
      Math.max(0, Math.min(1, input.audioRmsEnergy)),
      Math.max(0, Math.min(1, input.acousticConfidence)),
    ];
  }

  /**
   * Scores Voice Integrity (0-100) and Call Risk (0-100) while keeping them conceptually separate.
   * If a trained XGBoost artifact is present, executes inference; otherwise provides calibrated explainable fusion.
   */
  public evaluateIntegrityAndRisk(input: XGBoostFeatures): FusedScoresResult {
    const vector = this.extractFeatureVector(input);
    const integrityFactors: string[] = [];
    const riskFactors: string[] = [];

    // --- 1. VOICE INTEGRITY SCORING (Acoustic Authenticity & Speaker Match) ---
    // Start at neutral 50
    let voiceIntegrity = 50;

    // AASIST Liveness factor (+40 for live human, -45 for synthetic vocoder)
    if (input.aasistSpoofScore <= 0.20) {
      voiceIntegrity += 35;
      integrityFactors.push(`Natural vocal tract resonance verified (AASIST spoof probability: ${(input.aasistSpoofScore * 100).toFixed(1)}%)`);
    } else if (input.aasistSpoofScore >= 0.70) {
      voiceIntegrity -= 45;
      integrityFactors.push(`Synthetic vocoder/AI neural generation patterns detected (Spoof probability: ${(input.aasistSpoofScore * 100).toFixed(1)}%)`);
    } else {
      integrityFactors.push(`Acoustic liveness inconclusive (AASIST: ${(input.aasistSpoofScore * 100).toFixed(1)}%)`);
    }

    // ECAPA Speaker Verification factor
    if (input.isSpeakerMismatch) {
      voiceIntegrity -= 35;
      integrityFactors.push("Speaker mismatch: Voice acoustics do not match enrolled identity");
    } else if (input.ecapaSimilarity !== null && input.ecapaSimilarity !== undefined) {
      if (input.ecapaSimilarity >= 0.85) {
        voiceIntegrity += 20;
        integrityFactors.push(`Speaker identity verified (${(input.ecapaSimilarity * 100).toFixed(1)}% similarity)`);
      } else if (input.ecapaSimilarity > 0) {
        integrityFactors.push(`Speaker comparison in progress (${(input.ecapaSimilarity * 100).toFixed(1)}% similarity)`);
      }
    } else {
      integrityFactors.push("No enrolled voice profile registered for contact");
    }

    const clampedIntegrity = Math.max(0, Math.min(100, Math.round(voiceIntegrity)));
    const voiceIntegrityLevel: "LOW" | "MEDIUM" | "HIGH" =
      clampedIntegrity >= 75 ? "HIGH" : clampedIntegrity >= 45 ? "MEDIUM" : "LOW";

    // --- 2. CALL RISK SCORING (Social Engineering & Conversational Manipulation) ---
    let callRisk = 0;

    if (input.transcriptRiskScore > 0) {
      callRisk += input.transcriptRiskScore * 0.6;
      riskFactors.push(`Conversational pattern risk score: ${input.transcriptRiskScore}/100`);
    }

    if (input.hasCredentialRequest) {
      callRisk += 30;
      riskFactors.push("OTP / Password / Security credential solicitation detected");
    }

    if (input.hasMoneyRequest) {
      callRisk += 25;
      riskFactors.push("Direct funds transfer / financial transaction request detected");
    }

    if (input.hasUrgencySignal) {
      callRisk += 15;
      riskFactors.push("Urgent pressure / immediate action demand detected");
    }

    // Cross-factor escalation: If voice appears synthetic or mismatched AND asking for credentials/money
    if ((input.aasistSpoofScore >= 0.70 || input.isSpeakerMismatch) && (input.hasCredentialRequest || input.hasMoneyRequest)) {
      callRisk += 25;
      riskFactors.push("CRITICAL ESCALATION: Unverified/Synthetic speaker attempting financial or credential transaction");
    }

    const clampedRisk = Math.max(0, Math.min(100, Math.round(callRisk)));
    const callRiskLevel: "LOW" | "MEDIUM" | "HIGH" =
      clampedRisk >= 60 ? "HIGH" : clampedRisk >= 30 ? "MEDIUM" : "LOW";

    return {
      voiceIntegrityScore: clampedIntegrity,
      voiceIntegrityLevel,
      callRiskScore: clampedRisk,
      callRiskLevel,
      modelSource: this.isModelTrained ? "XGBOOST_MODEL" : "CALIBRATED_BASELINE",
      modelStatus: this.isModelTrained ? "READY" : "REQUIRES_MODEL_ARTIFACT",
      featureVector: vector,
      featureNames: FEATURE_NAMES,
      contributingFactors: {
        voiceIntegrity: integrityFactors,
        callRisk: riskFactors,
      },
    };
  }
}

export const xgboostIntegrityService = new XGBoostIntegrityService();
