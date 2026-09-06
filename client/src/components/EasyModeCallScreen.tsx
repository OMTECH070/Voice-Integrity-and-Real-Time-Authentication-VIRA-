import { useState, useMemo } from "react";
import { ActiveCallInfo, CallState } from "../types/call";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeListenButton } from "./EasyModeListenButton";
import { EasyModeNavToggle } from "./EasyModeNavToggle";
import { VoiceIntegrityBadge } from "./VoiceIntegrityBadge";
import type { FusedIntegrityStatus } from "../types/socket-events";

interface EasyModeCallScreenProps {
  activeCall: ActiveCallInfo;
  callState: CallState;
  duration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  isSpeakingRemote: boolean;
  isSpeakingLocal: boolean;
  // Multimodal Telemetry Props for optional "More details" expandable
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
  hasRemoteStream?: boolean;
  bufferedDurationMs?: number;
  targetWindowDurationMs?: number;
  analysisStatus?: string;
  lastAnalyzedTimestampMs?: number | null;
  analysisWindowNumber?: number | null;
  wav2vec2Status?: "READY" | "NOT_READY" | "ERROR" | null;
  wav2vec2Score?: number | null;
  callRiskScore?: number | null;
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  conversationalSignals?: string[];
  voiceIntegrityScore?: number | null;
}

export function EasyModeCallScreen(props: EasyModeCallScreenProps) {
  const { t, language } = useEasyMode();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const {
    activeCall,
    duration,
    isMuted,
    onToggleMute,
    onEndCall,
    isSpeakingRemote,
    integrityStatus,
    speakerMatchLabel,
    callRiskScore,
    callRiskLevel,
    conversationalSignals = [],
  } = props;

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Plain-Language Voice Safety Assessment
  const voiceSafetyAssessment = useMemo(() => {
    if (integrityStatus === "human-verified") {
      return {
        label: t("safeVoice"),
        desc: t("safeVoiceDesc"),
        statusColor: "#16a34a",
        bgColor: "#f0fdf4",
        borderColor: "#86efac",
        icon: "🛡️",
      };
    }
    if (integrityStatus === "possible-ai") {
      const isClone = speakerMatchLabel === "match";
      return {
        label: t("aiVoiceWarning"),
        desc: isClone ? `${t("aiVoiceWarningDesc")} (Possible voice clone of contact)` : t("aiVoiceWarningDesc"),
        statusColor: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#fca5a5",
        icon: "⚠️",
      };
    }
    if (integrityStatus === "speaker-mismatch") {
      return {
        label: t("mismatchWarning"),
        desc: t("mismatchWarningDesc"),
        statusColor: "#d97706",
        bgColor: "#fffbeb",
        borderColor: "#fde68a",
        icon: "⚠️",
      };
    }
    if (integrityStatus === "not-enrolled") {
      return {
        label: t("unverifiedVoice"),
        desc: t("unverifiedVoiceDesc"),
        statusColor: "#525252",
        bgColor: "#f5f5f5",
        borderColor: "#d4d4d4",
        icon: "ℹ️",
      };
    }
    if (integrityStatus === "analysis-unavailable") {
      return {
        label: t("analysisUnavailable"),
        desc: t("analysisUnavailable"),
        statusColor: "#737373",
        bgColor: "#f5f5f5",
        borderColor: "#d4d4d4",
        icon: "⏳",
      };
    }
    return {
      label: t("evaluatingVoice"),
      desc: t("waitingForAnalysis"),
      statusColor: "#2563eb",
      bgColor: "#eff6ff",
      borderColor: "#bfdbfe",
      icon: "⏳",
    };
  }, [integrityStatus, t]);

  // Plain-Language Call Threat Risk Assessment
  const riskAssessment = useMemo(() => {
    const score = callRiskScore ?? 0;
    if (callRiskLevel === "HIGH" || score >= 70) {
      return {
        label: t("highRisk"),
        desc: t("highRiskDesc"),
        statusColor: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#f87171",
        icon: "🚨",
      };
    }
    if (callRiskLevel === "MEDIUM" || score >= 30) {
      return {
        label: t("mediumRisk"),
        desc: t("mediumRiskDesc"),
        statusColor: "#d97706",
        bgColor: "#fffbeb",
        borderColor: "#fde68a",
        icon: "⚠️",
      };
    }
    return {
      label: t("lowRisk"),
      desc: t("lowRiskDesc"),
      statusColor: "#16a34a",
      bgColor: "#f0fdf4",
      borderColor: "#86efac",
      icon: "✅",
    };
  }, [callRiskScore, callRiskLevel, t]);

  // Spoken Text for Listen Button
  const spokenCallExplanation = useMemo(() => {
    const callerName = activeCall.remoteUser.username;
    if (language === "hi") {
      let speech = `कॉल चल रही है ${callerName} के साथ। आवाज़ की स्थिति: ${voiceSafetyAssessment.label}। जोखिम स्तर: ${riskAssessment.label}।`;
      if (conversationalSignals.length > 0) {
        speech += " चेतावनी: कॉलर पैसे या गुप्त जानकारी मांग रहा है। कृपया कोई OTP न दें।";
      } else {
        speech += " याद रखें: फोन पर कभी भी OTP या PIN साझा न करें।";
      }
      return speech;
    } else {
      let speech = `Call connected with ${callerName}. Voice safety: ${voiceSafetyAssessment.label}. Call risk level: ${riskAssessment.label}.`;
      if (conversationalSignals.length > 0) {
        speech += " Warning: Suspicious threat signals detected on this call. Never share OTP or transfer money.";
      } else {
        speech += " Remember: Never share your OTP or PIN with anyone over the phone.";
      }
      return speech;
    }
  }, [activeCall.remoteUser, language, voiceSafetyAssessment, riskAssessment, conversationalSignals]);

  const callerDisplayName = activeCall.remoteUser.username;

  return (
    <div
      className="easy-mode-call-container"
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        padding: "24px 16px 48px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Easy Mode Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "12px",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 800 }}>VIRA</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              background: "#000000",
              color: "#ffffff",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            EASY
          </span>
        </div>

        <EasyModeNavToggle />
      </div>

      {/* Caller Header Card */}
      <div
        style={{
          textAlign: "center",
          padding: "24px 20px",
          background: "#f5f5f5",
          borderRadius: "12px",
          border: "2px solid #171717",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#000000",
            color: "#ffffff",
            fontSize: "26px",
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px auto",
          }}
        >
          {callerDisplayName.slice(0, 1).toUpperCase()}
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            margin: "0 0 4px 0",
            letterSpacing: "-0.02em",
          }}
        >
          {callerDisplayName}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "15px",
            color: "#525252",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: isSpeakingRemote ? "#16a34a" : "#000000",
              display: "inline-block",
              transition: "background 0.2s ease",
            }}
          />
          <span>{t("connected")}</span>
          <span>•</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Listen Button for Call Screen */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
        <EasyModeListenButton textToSpeak={spokenCallExplanation} size="large" />
      </div>

      {/* Primary Security Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Voice Safety Card */}
        <div
          style={{
            padding: "18px 16px",
            borderRadius: "10px",
            background: voiceSafetyAssessment.bgColor,
            border: `2px solid ${voiceSafetyAssessment.borderColor}`,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#525252",
              marginBottom: "6px",
            }}
          >
            {t("voiceSafety")}
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              color: voiceSafetyAssessment.statusColor,
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{voiceSafetyAssessment.icon}</span>
            <span>{voiceSafetyAssessment.label}</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "#525252", margin: 0, lineHeight: 1.35 }}>
            {voiceSafetyAssessment.desc}
          </p>
        </div>

        {/* Risk Level Card */}
        <div
          style={{
            padding: "18px 16px",
            borderRadius: "10px",
            background: riskAssessment.bgColor,
            border: `2px solid ${riskAssessment.borderColor}`,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#525252",
              marginBottom: "6px",
            }}
          >
            {t("riskLevel")}
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              color: riskAssessment.statusColor,
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{riskAssessment.icon}</span>
            <span>{riskAssessment.label}</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "#525252", margin: 0, lineHeight: 1.35 }}>
            {riskAssessment.desc}
          </p>
        </div>
      </div>

      {/* Threat Warnings Banner (if any detected) */}
      {conversationalSignals.length > 0 && (
        <div
          style={{
            padding: "18px 20px",
            background: "#fef2f2",
            border: "2px solid #dc2626",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "#dc2626",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚠️</span>
            <span>{t("whyFlagged")}</span>
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            {conversationalSignals.map((sig) => {
              let msg = sig;
              if (sig === "MONEY_REQUEST") msg = t("signalMoneyRequest");
              else if (sig === "URGENCY" || sig === "URGENCY_SIGNAL") msg = t("signalUrgency");
              else if (sig === "CREDENTIAL_REQUEST") msg = t("signalCredentialRequest");
              else if (sig === "IMPERSONATION_SIGNAL") msg = t("signalImpersonation");
              else if (sig === "PRESSURE_TACTIC") msg = t("signalPressureTactic");
              return (
                <div
                  key={sig}
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#991b1b",
                    padding: "6px 10px",
                    background: "#ffffff",
                    borderRadius: "6px",
                    border: "1px solid #fca5a5",
                  }}
                >
                  {msg}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Golden Call Advisory */}
      <div
        style={{
          padding: "14px 18px",
          background: "#fffbeb",
          border: "1.5px solid #fde68a",
          borderRadius: "8px",
          marginBottom: "24px",
          fontSize: "13px",
          lineHeight: 1.4,
          color: "#92400e",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "4px" }}>
          🛡️ {t("neverShareOtp")}
        </div>
        <div>
          {t("verifyBeforeTransfer")}
        </div>
      </div>

      {/* Big Action Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <button
          onClick={onToggleMute}
          style={{
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            background: isMuted ? "#fef2f2" : "#ffffff",
            color: isMuted ? "#dc2626" : "#000000",
            border: isMuted ? "2px solid #dc2626" : "2px solid #000000",
            borderRadius: "10px",
            cursor: "pointer",
            minHeight: "56px",
          }}
        >
          {isMuted ? `🔇 ${t("unmute")}` : `🎤 ${t("mute")}`}
        </button>

        <button
          onClick={onEndCall}
          style={{
            padding: "16px 24px",
            fontSize: "18px",
            fontWeight: 800,
            background: "#dc2626",
            color: "#ffffff",
            border: "2px solid #dc2626",
            borderRadius: "10px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
            minHeight: "56px",
          }}
        >
          📞 {t("endCall")}
        </button>
      </div>

      {/* Technical Forensic Telemetry Toggle ("More details") */}
      <div style={{ textAlign: "center", marginTop: "16px" }}>
        <button
          onClick={() => setShowTechnicalDetails((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "#525252",
            fontSize: "13px",
            textDecoration: "underline",
            cursor: "pointer",
            padding: "8px 12px",
          }}
        >
          {showTechnicalDetails ? `▲ ${t("hideDetails")}` : `▼ ${t("moreDetails")} (${t("technicalDetails")})`}
        </button>
      </div>

      {/* Expandable Technical Badge */}
      {showTechnicalDetails && (
        <div style={{ marginTop: "16px" }}>
          <VoiceIntegrityBadge
            integrityStatus={props.integrityStatus}
            spoofScore={props.spoofScore}
            rawLabel={props.rawLabel}
            lastLatencyMs={props.lastLatencyMs}
            sequenceNumber={props.sequenceNumber}
            speakerSimilarity={props.speakerSimilarity}
            speakerMatchLabel={props.speakerMatchLabel}
            confidence={props.confidence}
            reason={props.reason}
            isSmoothed={props.isSmoothed}
            calibrationVersion={props.calibrationVersion}
            hasRemoteStream={props.hasRemoteStream}
            isRemoteSpeaking={props.isSpeakingRemote}
            bufferedDurationMs={props.bufferedDurationMs}
            targetWindowDurationMs={props.targetWindowDurationMs}
            analysisStatus={props.analysisStatus}
            lastAnalyzedTimestampMs={props.lastAnalyzedTimestampMs}
            analysisWindowNumber={props.analysisWindowNumber}
            remoteUserId={activeCall.remoteUser.id}
            wav2vec2Status={props.wav2vec2Status}
            wav2vec2Score={props.wav2vec2Score}
            callRiskScore={props.callRiskScore}
            callRiskLevel={props.callRiskLevel}
            conversationalSignals={props.conversationalSignals}
            voiceIntegrityScore={props.voiceIntegrityScore}
          />
        </div>
      )}
    </div>
  );
}
