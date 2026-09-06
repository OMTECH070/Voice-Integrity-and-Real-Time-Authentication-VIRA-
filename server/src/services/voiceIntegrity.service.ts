import { logger } from "../utils/logger";

export type VoiceIntegrityStatus =
  | "analyzing"
  | "human-verified"
  | "possible-ai"
  | "speaker-mismatch"
  | "uncertain"
  | "not-enrolled"
  | "analysis-unavailable";

export type SpoofLabel = "live" | "likely-synthetic" | "uncertain";
export type SpeakerMatchLabel = "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled";

export interface IntegrityCalibrationConfig {
  /** AASIST score threshold above which audio is classified as likely synthetic (default: 0.70). */
  aasistSpoofThreshold: number;
  /** AASIST score threshold below which audio is classified as live human (default: 0.55). */
  aasistLiveThreshold: number;
  /** ECAPA cosine similarity threshold for verified enrolled speaker match (default: 0.92, subject to dataset calibration). */
  ecapaMatchThreshold: number;
  /** ECAPA cosine similarity threshold below which speaker is considered a mismatch (default: 0.82). */
  ecapaMismatchThreshold: number;
  /** ECAPA uncertainty band between mismatch and match (default: 0.82 - 0.92). */
  ecapaUncertainThreshold: number;
  /** Number of recent windows to retain for temporal smoothing (default: 5). */
  temporalHistorySize: number;
  /** Number of consistent window classifications required to transition state (default: 2). */
  temporalAgreementRequired: number;
  /** Version tag of the calibration parameters. */
  calibrationVersion: string;
}

export interface WindowAssessment {
  timestampMs: number;
  spoofScore?: number;
  spoofLabel?: SpoofLabel;
  speakerSimilarity?: number;
  speakerLabel?: SpeakerMatchLabel;
  rawStatus: VoiceIntegrityStatus;
}

export interface VoiceIntegrityAssessment {
  integrityStatus: VoiceIntegrityStatus;
  confidence: number;
  reason: string;
  spoofScore?: number;
  spoofLabel?: SpoofLabel;
  speakerSimilarity?: number;
  speakerLabel?: SpeakerMatchLabel;
  isSmoothed: boolean;
  calibrationVersion: string;
}

interface CallIntegritySession {
  callId: string;
  history: WindowAssessment[];
  currentStatus: VoiceIntegrityStatus;
  lastActiveMs: number;
}

/**
 * Default calibration configuration.
 *
 * NOTE: Thresholds are preliminary calibration values. In acoustic tests with
 * SpeechBrain ECAPA-TDNN (spkrec-ecapa-voxceleb), genuine same-speaker pairs
 * yield similarity > 0.95 (observed ~0.9905), while cross-speaker impostor pairs
 * yield similarity in the 0.85 - 0.89 range.
 */
const DEFAULT_CALIBRATION: IntegrityCalibrationConfig = {
  aasistSpoofThreshold: parseFloat(process.env.VIRA_AASIST_SPOOF_THRESH ?? "0.70"),
  aasistLiveThreshold: parseFloat(process.env.VIRA_AASIST_LIVE_THRESH ?? "0.55"),
  ecapaMatchThreshold: parseFloat(process.env.VIRA_ECAPA_MATCH_THRESH ?? "0.92"),
  ecapaMismatchThreshold: parseFloat(process.env.VIRA_ECAPA_MISMATCH_THRESH ?? "0.82"),
  ecapaUncertainThreshold: parseFloat(process.env.VIRA_ECAPA_UNCERTAIN_THRESH ?? "0.82"),
  temporalHistorySize: 5,
  temporalAgreementRequired: 2,
  calibrationVersion: "CALIB-v1.0.0-PROBABILISTIC",
};

/**
 * Service managing real-time fusion of AASIST anti-spoofing probabilities,
 * ECAPA-TDNN speaker similarity scores, and temporal smoothing across active calls.
 */
export class VoiceIntegrityService {
  private config: IntegrityCalibrationConfig;
  private activeSessions = new Map<string, CallIntegritySession>();

  constructor(customConfig?: Partial<IntegrityCalibrationConfig>) {
    this.config = { ...DEFAULT_CALIBRATION, ...customConfig };
  }

  public getCalibration(): IntegrityCalibrationConfig {
    return { ...this.config };
  }

  public setCalibration(newConfig: Partial<IntegrityCalibrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`VoiceIntegrityService: Updated calibration configuration (${this.config.calibrationVersion})`);
  }

  /**
   * Classifies an individual raw window from AASIST and ECAPA outputs.
   */
  public classifySingleWindow(
    spoofScore?: number,
    speakerSimilarity?: number,
    hasEnrolledProfile = false
  ): { rawStatus: VoiceIntegrityStatus; spoofLabel: SpoofLabel; speakerLabel: SpeakerMatchLabel; confidence: number; reason: string } {
    // 1. Classify AASIST anti-spoof probability
    let spoofLabel: SpoofLabel = "uncertain";
    if (spoofScore !== undefined) {
      if (spoofScore >= this.config.aasistSpoofThreshold) {
        spoofLabel = "likely-synthetic";
      } else if (spoofScore <= this.config.aasistLiveThreshold) {
        spoofLabel = "live";
      } else {
        spoofLabel = "uncertain";
      }
    }

    // 2. Classify ECAPA speaker similarity
    let speakerLabel: SpeakerMatchLabel = hasEnrolledProfile ? "uncertain" : "not-enrolled";
    if (hasEnrolledProfile && speakerSimilarity !== undefined) {
      if (speakerSimilarity >= this.config.ecapaMatchThreshold) {
        speakerLabel = "match";
      } else if (speakerSimilarity < this.config.ecapaMismatchThreshold) {
        speakerLabel = "mismatch";
      } else {
        speakerLabel = "likely-match";
      }
    }

    // 3. Decision Matrix Fusion Rules
    let rawStatus: VoiceIntegrityStatus = "analyzing";
    let confidence = 0.5;
    let reason = "Analyzing caller speech features...";

    if (spoofScore === undefined && speakerSimilarity === undefined) {
      return { rawStatus: "analyzing", spoofLabel, speakerLabel, confidence: 0.0, reason };
    }

    // RULE 1: Likely Synthetic / Spoofed audio detected
    if (spoofLabel === "likely-synthetic") {
      rawStatus = "possible-ai";
      confidence = spoofScore ?? 0.85;
      if (speakerLabel === "match" || speakerLabel === "likely-match") {
        reason = "Acoustic artifacts suggest possible synthetic voice clone targeting enrolled contact";
      } else {
        reason = "Acoustic artifacts suggest possible AI-generated or spoofed audio";
      }
    }
    // RULE 2: Live Human + Enrolled Speaker Match
    else if (spoofLabel === "live" && (speakerLabel === "match" || speakerLabel === "likely-match")) {
      rawStatus = "human-verified";
      confidence = Math.min(1.0, (1 - (spoofScore ?? 0)) * 0.5 + (speakerSimilarity ?? 0.9) * 0.5);
      reason = "Live human voice verified against enrolled contact profile";
    }
    // RULE 3: Live Human + Speaker Mismatch (Impostor)
    else if (spoofLabel === "live" && speakerLabel === "mismatch") {
      rawStatus = "speaker-mismatch";
      confidence = 1.0 - (speakerSimilarity ?? 0.5);
      reason = "Live human voice detected, but acoustic signature does not match enrolled contact";
    }
    // RULE 4: Live Human + No Enrolled Profile available
    else if (spoofLabel === "live" && speakerLabel === "not-enrolled") {
      rawStatus = "human-verified";
      confidence = 1 - (spoofScore ?? 0.1);
      reason = "Live human voice detected (no enrolled voice profile registered for contact)";
    }
    // RULE 5: Inconclusive / Distorted
    else {
      rawStatus = "uncertain";
      confidence = 0.5;
      reason = "Acoustic features inconclusive or distorted by background noise";
    }

    return { rawStatus, spoofLabel, speakerLabel, confidence, reason };
  }

  /**
   * Evaluates an incoming window within the temporal context of an active call.
   */
  public assessWindow(
    callId: string,
    spoofScore?: number,
    speakerSimilarity?: number,
    hasEnrolledProfile = false,
    timestampMs = Date.now()
  ): VoiceIntegrityAssessment {
    let session = this.activeSessions.get(callId);
    if (!session) {
      session = {
        callId,
        history: [],
        currentStatus: "analyzing",
        lastActiveMs: timestampMs,
      };
      this.activeSessions.set(callId, session);
    }

    session.lastActiveMs = timestampMs;

    // Single window classification
    const single = this.classifySingleWindow(spoofScore, speakerSimilarity, hasEnrolledProfile);

    // Record into temporal history
    session.history.push({
      timestampMs,
      spoofScore,
      spoofLabel: single.spoofLabel,
      speakerSimilarity,
      speakerLabel: single.speakerLabel,
      rawStatus: single.rawStatus,
    });

    if (session.history.length > this.config.temporalHistorySize) {
      session.history.shift();
    }

    // Apply temporal smoothing over recent window agreement
    const recent = session.history.slice(-this.config.temporalHistorySize);
    const statusCounts = new Map<VoiceIntegrityStatus, number>();
    for (const item of recent) {
      statusCounts.set(item.rawStatus, (statusCounts.get(item.rawStatus) ?? 0) + 1);
    }

    let smoothedStatus: VoiceIntegrityStatus = session.currentStatus;

    // Check if any state meets the temporal agreement threshold
    const possibleAiCount = statusCounts.get("possible-ai") ?? 0;
    const humanVerifiedCount = statusCounts.get("human-verified") ?? 0;
    const speakerMismatchCount = statusCounts.get("speaker-mismatch") ?? 0;
    const uncertainCount = statusCounts.get("uncertain") ?? 0;

    if (possibleAiCount >= this.config.temporalAgreementRequired) {
      smoothedStatus = "possible-ai";
    } else if (humanVerifiedCount >= this.config.temporalAgreementRequired) {
      smoothedStatus = "human-verified";
    } else if (speakerMismatchCount >= this.config.temporalAgreementRequired) {
      smoothedStatus = "speaker-mismatch";
    } else if (uncertainCount >= this.config.temporalAgreementRequired) {
      smoothedStatus = "uncertain";
    } else if (session.currentStatus === "analyzing" && recent.length >= 1) {
      // First window initialization
      smoothedStatus = single.rawStatus;
    }

    session.currentStatus = smoothedStatus;

    console.log(
      `[VIRA][RESULT] Fused voice integrity assessment for call ${callId}: ` +
        `rawStatus=${single.rawStatus}, smoothedStatus=${smoothedStatus}, isSmoothed=${smoothedStatus !== single.rawStatus}, ` +
        `rawSpoof=${spoofScore !== undefined ? spoofScore.toFixed(4) : "N/A"} (${single.spoofLabel}), ` +
        `sim=${speakerSimilarity !== undefined ? speakerSimilarity.toFixed(4) : "N/A"} (${single.speakerLabel}), ` +
        `historyLen=${session.history.length}`
    );

    return {
      integrityStatus: smoothedStatus,
      confidence: single.confidence,
      reason: single.reason,
      spoofScore,
      spoofLabel: single.spoofLabel,
      speakerSimilarity,
      speakerLabel: single.speakerLabel,
      isSmoothed: smoothedStatus !== single.rawStatus,
      calibrationVersion: this.config.calibrationVersion,
    };
  }

  public getSession(callId: string): CallIntegritySession | null {
    return this.activeSessions.get(callId) ?? null;
  }

  public cleanupSession(callId: string): void {
    this.activeSessions.delete(callId);
  }
}

export const voiceIntegrityService = new VoiceIntegrityService();
