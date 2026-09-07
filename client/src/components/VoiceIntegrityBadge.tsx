import { useEffect, useState } from "react";
import type { FusedIntegrityStatus } from "../types/socket-events";

/**
 * Configurable classification thresholds for AASIST anti-spoof likelihood percentages (0–100).
 */
export const SPOOF_THRESHOLDS = {
  LIKELY_HUMAN_MAX: 20,
  UNCERTAIN_MAX: 50,
  SUSPICIOUS_MAX: 75,
} as const;

export type SpoofClassificationLabel =
  | "Likely Human"
  | "Uncertain"
  | "Suspicious"
  | "Likely Synthetic";

export function getSpoofClassification(percentage: number): {
  label: SpoofClassificationLabel;
  color: string;
} {
  if (percentage <= SPOOF_THRESHOLDS.LIKELY_HUMAN_MAX) {
    return { label: "Likely Human", color: "#16a34a" };
  }
  if (percentage <= SPOOF_THRESHOLDS.UNCERTAIN_MAX) {
    return { label: "Uncertain", color: "#d97706" };
  }
  if (percentage <= SPOOF_THRESHOLDS.SUSPICIOUS_MAX) {
    return { label: "Suspicious", color: "#dc2626" };
  }
  return { label: "Likely Synthetic", color: "#dc2626" };
}

export type ExplicitPipelineState =
  | "WAITING_FOR_REMOTE_AUDIO"
  | "WAITING_FOR_SPEECH"
  | "BUFFERING"
  | "ANALYZING"
  | "RESULT_READY"
  | "ANALYSIS_ERROR";

export interface VoiceIntegrityBadgeProps {
  integrityStatus: FusedIntegrityStatus;
  spoofScore: number | null;
  rawLabel?: "live" | "likely-synthetic" | "uncertain" | null;
  lastLatencyMs: number | null;
  sequenceNumber: number | null;
  speakerSimilarity?: number | null;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | null;
  confidence?: number | null;
  reason?: string | null;
  isSmoothed?: boolean | null;
  calibrationVersion?: string | null;
  /** Whether the remote incoming WebRTC stream is present with active audio tracks. */
  hasRemoteStream?: boolean;
  /** Whether VAD is currently detecting speech on the remote stream. */
  isRemoteSpeaking?: boolean;
  /** Number of milliseconds currently buffered in the rolling 3.0s window. */
  bufferedDurationMs?: number;
  /** Target window duration in milliseconds (default 3000 ms). */
  targetWindowDurationMs?: number;
  /** Current pipeline analysis status from useVoiceAnalysis. */
  analysisStatus?: string;
  /** Timestamp in ms when the latest analysis result arrived. */
  lastAnalyzedTimestampMs?: number | null;
  /** Monotonic window sequence number of the latest analyzed chunk. */
  analysisWindowNumber?: number | null;
  /** Remote caller user ID. */
  remoteUserId?: string | null;
  /** Local user ID. */
  localUserId?: string | null;
  /** Wav2Vec2 anti-spoof model status. */
  wav2vec2Status?: "READY" | "NOT_READY" | "ERROR" | null;
  /** Wav2Vec2 anti-spoof score (0.0 to 1.0, or null if unconfigured). */
  wav2vec2Score?: number | null;
  /** Call threat / social engineering risk score (0 to 100). */
  callRiskScore?: number | null;
  /** Call risk severity level ("LOW" | "MEDIUM" | "HIGH"). */
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  /** Detected conversational risk signals. */
  conversationalSignals?: string[];
  /** Decoupled voice integrity biometric score (0 to 100). */
  voiceIntegrityScore?: number | null;
}

const SIGNAL_FRIENDLY_NAMES: Record<string, { label: string; icon: string }> = {
  MONEY_REQUEST: { label: "Financial Transfer Demand", icon: "💰" },
  URGENCY: { label: "Urgency / Pressure Tactic", icon: "⚡" },
  CREDENTIAL_REQUEST: { label: "Credential / OTP Request", icon: "🔑" },
  IMPERSONATION_SIGNAL: { label: "Authority Impersonation", icon: "🏛️" },
  PRESSURE_TACTIC: { label: "Coercion / Threat of Arrest", icon: "⚠️" },
};

const BADGE_CONFIG: Record<
  FusedIntegrityStatus,
  { label: string; statusClass: string; defaultDesc: string; statusType: string }
> = {
  analyzing: {
    label: "Analyzing Voice...",
    statusClass: "analyzing",
    defaultDesc: "Listening and buffering speech for acoustic analysis...",
    statusType: "BUFFERING",
  },
  "human-verified": {
    label: "Human Voice Likely",
    statusClass: "verified",
    defaultDesc: "Natural human vocal tract acoustics verified with high probability.",
    statusType: "VERIFIED",
  },
  "possible-ai": {
    label: "Possible Synthetic Voice",
    statusClass: "warning",
    defaultDesc: "Acoustic patterns exhibit vocoder or neural voice synthesis characteristics.",
    statusType: "WARNING",
  },
  "speaker-mismatch": {
    label: "Speaker Mismatch Detected",
    statusClass: "warning",
    defaultDesc: "Voice appears live and human, but does not match the enrolled contact.",
    statusType: "MISMATCH",
  },
  uncertain: {
    label: "Voice Analysis Inconclusive",
    statusClass: "analyzing",
    defaultDesc: "Audio conditions, background noise, or network jitter prevented confident assessment.",
    statusType: "INCONCLUSIVE",
  },
  "not-enrolled": {
    label: "No Voice Profile Enrolled",
    statusClass: "neutral",
    defaultDesc: "Caller voice is live; no enrolled baseline profile exists for identity verification.",
    statusType: "UNENROLLED",
  },
  "analysis-unavailable": {
    label: "Voice Analysis Unavailable",
    statusClass: "warning",
    defaultDesc: "Call audio is connected, but voice integrity analysis is temporarily offline.",
    statusType: "UNAVAILABLE",
  },
};

const SPEAKER_LABEL_CONFIG: Record<
  "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled",
  { label: string }
> = {
  match: {
    label: "Speaker Identity Verified",
  },
  "likely-match": {
    label: "Likely Enrolled Speaker",
  },
  uncertain: {
    label: "Speaker Identity Inconclusive",
  },
  mismatch: {
    label: "Speaker Mismatch Detected",
  },
  "not-enrolled": {
    label: "No Voice Profile Enrolled",
  },
};

export function VoiceIntegrityBadge({
  integrityStatus,
  spoofScore,
  rawLabel,
  lastLatencyMs,
  sequenceNumber,
  speakerSimilarity,
  speakerMatchLabel,
  confidence,
  reason,
  isSmoothed,
  calibrationVersion,
  hasRemoteStream = true,
  isRemoteSpeaking = false,
  bufferedDurationMs = 0,
  targetWindowDurationMs = 3000,
  analysisStatus = "idle",
  lastAnalyzedTimestampMs,
  analysisWindowNumber,
  remoteUserId,
  localUserId,
  wav2vec2Status,
  wav2vec2Score,
  callRiskScore,
  callRiskLevel,
  conversationalSignals = [],
  voiceIntegrityScore,
}: VoiceIntegrityBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  // Live timer for "Last analyzed: X seconds ago"
  useEffect(() => {
    if (!lastAnalyzedTimestampMs) {
      setSecondsAgo(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - lastAnalyzedTimestampMs) / 1000));
      setSecondsAgo(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastAnalyzedTimestampMs]);

  const config = BADGE_CONFIG[integrityStatus] ?? BADGE_CONFIG.analyzing;
  const speakerConfig = speakerMatchLabel
    ? SPEAKER_LABEL_CONFIG[speakerMatchLabel]
    : SPEAKER_LABEL_CONFIG["not-enrolled"];

  const spoofPercent = spoofScore !== null && spoofScore !== undefined ? Math.round(spoofScore * 100) : null;
  const classification = spoofPercent !== null ? getSpoofClassification(spoofPercent) : null;

  const similarityPercent =
    speakerSimilarity !== null && speakerSimilarity !== undefined
      ? Math.round(speakerSimilarity * 100)
      : null;

  const targetMs = targetWindowDurationMs || 3000;
  const currentMs = bufferedDurationMs || 0;

  // Determine explicit pipeline state
  let explicitState: ExplicitPipelineState = "WAITING_FOR_REMOTE_AUDIO";
  if (!hasRemoteStream) {
    explicitState = "WAITING_FOR_REMOTE_AUDIO";
  } else if (integrityStatus === "analysis-unavailable") {
    explicitState = "ANALYSIS_ERROR";
  } else if (analysisStatus === "sent" || analysisStatus === "window-ready") {
    explicitState = "ANALYZING";
  } else if (spoofScore !== null && classification) {
    explicitState = "RESULT_READY";
  } else if (currentMs > 0) {
    explicitState = "BUFFERING";
  } else {
    explicitState = "WAITING_FOR_SPEECH";
  }

  let displayValueText = "Waiting...";
  switch (explicitState) {
    case "WAITING_FOR_REMOTE_AUDIO":
      displayValueText = "Waiting for audio...";
      break;
    case "WAITING_FOR_SPEECH":
      displayValueText = "Listening for speech...";
      break;
    case "BUFFERING": {
      const pct = Math.min(100, Math.round((currentMs / targetMs) * 100));
      displayValueText = `Buffering (${pct}%)`;
      break;
    }
    case "ANALYZING":
      displayValueText = "Evaluating acoustics...";
      break;
    case "RESULT_READY":
      displayValueText = classification ? `${classification.label} (${spoofPercent}%)` : `${spoofPercent}%`;
      break;
    case "ANALYSIS_ERROR":
      displayValueText = "Unavailable";
      break;
  }

  // Honest display state for Wav2Vec2 anti-spoof
  let wav2vec2DisplayText = "Waiting for analysis";
  if (wav2vec2Status === "NOT_READY" || wav2vec2Score === null || wav2vec2Score === undefined) {
    wav2vec2DisplayText = "Not configured";
  } else if (wav2vec2Status === "ERROR") {
    wav2vec2DisplayText = "Unavailable";
  } else if (wav2vec2Status === "READY" && typeof wav2vec2Score === "number") {
    const w2vPct = Math.round(wav2vec2Score * 100);
    wav2vec2DisplayText = `${w2vPct}% Spoof (${wav2vec2Score >= 0.5 ? "Likely Synthetic" : "Likely Human"})`;
  }

  // Honest display state for Call Risk Engine
  let callRiskDisplayText = "Waiting for speech";
  if (callRiskScore !== null && callRiskScore !== undefined) {
    callRiskDisplayText = `${callRiskScore}/100 (${callRiskLevel ?? "LOW"})`;
  }

  const activeWindow = analysisWindowNumber ?? sequenceNumber ?? 0;

  return (
    <div className="voice-integrity-minimal-box" role="region" aria-label="Voice Authentication">
      <div className="integrity-minimal-top">
        <span className="integrity-minimal-label">Voice Integrity</span>
        <span className={`integrity-status-pill-minimal ${config.statusClass}`}>
          {integrityStatus === "human-verified" ? "✓ " : integrityStatus === "possible-ai" || integrityStatus === "speaker-mismatch" ? "! " : "● "}
          {config.label}
        </span>
      </div>

      <p className="integrity-minimal-desc">{reason ?? config.defaultDesc}</p>

      {/* Dual Decoupled Threat Meters (Voice Integrity vs Call Threat) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "14px",
          padding: "12px",
          background: "var(--bg-subtle)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px", fontWeight: 600 }}>
            Voice Integrity
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "monospace",
                color: (voiceIntegrityScore ?? 100) >= 75 ? "var(--color-success)" : (voiceIntegrityScore ?? 100) >= 45 ? "var(--color-warning)" : "var(--color-danger)",
              }}
            >
              {voiceIntegrityScore !== null && voiceIntegrityScore !== undefined ? voiceIntegrityScore : 100}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>/ 100</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Biometric Authenticity
          </div>
        </div>

        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px", fontWeight: 600 }}>
            Call Threat Risk
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "monospace",
                color: (callRiskScore ?? 0) >= 70 ? "var(--color-danger)" : (callRiskScore ?? 0) >= 30 ? "var(--color-warning)" : "var(--color-success)",
              }}
            >
              {callRiskScore !== null && callRiskScore !== undefined ? callRiskScore : 0}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>/ 100</span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: (callRiskScore ?? 0) >= 70 ? "var(--color-danger)" : "var(--text-secondary)",
              marginTop: "2px",
              fontWeight: (callRiskScore ?? 0) >= 70 ? 600 : 400,
            }}
          >
            {callRiskScore !== null && callRiskScore !== undefined ? `${callRiskLevel ?? "LOW"} Threat` : "Waiting for speech"}
          </div>
        </div>
      </div>

      {/* Dual Signal Distinction Banners for AI / Impostor Detection */}
      {integrityStatus === "possible-ai" && (
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "12.5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Voice Authenticity:</span>
            <strong style={{ color: "var(--color-danger)" }}>Possible Synthetic Voice</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>Speaker Identity:</span>
            <strong>
              {speakerMatchLabel === "match" ? "Match (Voice Clone Detected)" : "Unverified / Mismatch"}
            </strong>
          </div>
        </div>
      )}

      {integrityStatus === "speaker-mismatch" && (
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "12.5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Voice Authenticity:</span>
            <strong style={{ color: "var(--color-success)" }}>Human Voice Likely</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>Speaker Identity:</span>
            <strong style={{ color: "var(--color-danger)" }}>Speaker Mismatch Detected</strong>
          </div>
        </div>
      )}

      {/* Conversational Threat Signals Alert */}
      {conversationalSignals && conversationalSignals.length > 0 && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--color-danger)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>⚠️</span>
            <span>Conversational Threat Signals Detected ({conversationalSignals.length})</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {conversationalSignals.map((sig) => {
              const friendly = SIGNAL_FRIENDLY_NAMES[sig] || { label: sig, icon: "⚠️" };
              return (
                <span
                  key={sig}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  <span>{friendly.icon}</span>
                  <span>{friendly.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Multimodal Forensic Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div className="metric-col-minimal" style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>
          <span className="metric-label-mono">Anti-Spoof (AASIST)</span>
          <span className="metric-val-mono" style={{ fontSize: "11.5px" }}>{displayValueText}</span>
        </div>
        <div className="metric-col-minimal" style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>
          <span className="metric-label-mono">Anti-Spoof (Wav2Vec2)</span>
          <span className="metric-val-mono" style={{ fontSize: "11.5px" }}>{wav2vec2DisplayText}</span>
        </div>
        <div className="metric-col-minimal" style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>
          <span className="metric-label-mono">ECAPA Voice Match</span>
          <span className="metric-val-mono" style={{ fontSize: "11.5px" }}>
            {similarityPercent !== null
              ? `${similarityPercent}%`
              : speakerMatchLabel === "not-enrolled"
              ? "Voice ID not set up"
              : integrityStatus === "analysis-unavailable"
              ? "Unable to verify"
              : explicitState === "BUFFERING" || explicitState === "ANALYZING"
              ? "Checking..."
              : speakerMatchLabel === "match"
              ? "Voice matched"
              : speakerMatchLabel === "mismatch"
              ? "Voice mismatch"
              : speakerConfig.label}
          </span>
        </div>
        <div className="metric-col-minimal" style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>
          <span className="metric-label-mono">Social Engineering</span>
          <span className="metric-val-mono" style={{ fontSize: "11.5px" }}>{callRiskDisplayText}</span>
        </div>
      </div>

      {/* Minimal Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)", fontSize: "11.5px", color: "var(--text-muted)" }}>
        <span>Window #{activeWindow} {secondsAgo !== null && `• ${secondsAgo}s ago`}</span>
        <button
          onClick={() => setShowDetails((v) => !v)}
          style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "11.5px", cursor: "pointer", padding: 0 }}
        >
          {showDetails ? "Hide Details" : "Details"}
        </button>
      </div>

      {/* Diagnostic details */}
      {showDetails && (
        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>Audio Source:</span>
            <strong>REMOTE WebRTC Track</strong>
          </div>
          {localUserId && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Local User ID:</span>
              <strong>{localUserId}</strong>
            </div>
          )}
          {remoteUserId && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Remote Caller ID:</span>
              <strong>{remoteUserId}</strong>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>Speech Activity:</span>
            <strong>{isRemoteSpeaking ? "Active Speech" : "Silence"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>Speech Buffer:</span>
            <strong>{(currentMs / 1000).toFixed(1)}s / {(targetMs / 1000).toFixed(1)}s</strong>
          </div>
          {lastLatencyMs !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Round-trip Latency:</span>
              <strong>~{lastLatencyMs} ms</strong>
            </div>
          )}
          {confidence !== null && confidence !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Model Confidence:</span>
              <strong>{(confidence * 100).toFixed(0)}%</strong>
            </div>
          )}
          {rawLabel && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Raw Model Label:</span>
              <strong>{rawLabel}</strong>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>Wav2Vec2 Engine:</span>
            <strong>
              {wav2vec2Status === "READY"
                ? "Active (Fine-Tuned V2 ONNX)"
                : wav2vec2Status === "NOT_READY"
                ? "Not configured"
                : wav2vec2Status === "ERROR"
                ? "Unavailable"
                : "Standby"}
            </strong>
          </div>
          {conversationalSignals && conversationalSignals.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Detected Threat Signals:</span>
              <strong>{conversationalSignals.join(", ")}</strong>
            </div>
          )}
          {calibrationVersion && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Calibration Tag:</span>
              <strong>{calibrationVersion}</strong>
            </div>
          )}
          {isSmoothed && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Temporal Smoothing:</span>
              <strong>Active (5-Window Ring Buffer)</strong>
            </div>
          )}
        </div>
      )}

      {/* Probabilistic Disclaimer */}
      <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.35 }}>
        * Results are probabilistic and may be affected by audio quality, network conditions, and background noise.
      </p>
    </div>
  );
}

