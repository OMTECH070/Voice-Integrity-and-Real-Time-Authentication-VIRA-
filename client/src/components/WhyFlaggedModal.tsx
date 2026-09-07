import { useEffect, useMemo } from "react";
import type { FusedIntegrityStatus } from "../types/socket-events";
import { useEasyMode } from "../context/EasyModeContext";

export interface WhyFlaggedModalProps {
  isOpen: boolean;
  onClose: () => void;
  callRiskScore?: number | null;
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  integrityStatus: FusedIntegrityStatus;
  voiceIntegrityScore?: number | null;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | null;
  speakerSimilarity?: number | null;
  spoofScore?: number | null;
  rawLabel?: "live" | "likely-synthetic" | "uncertain" | null;
  conversationalSignals?: string[];
  reason?: string | null;
}

export function buildFlaggedReason({
  integrityStatus,
  spoofScore,
  rawLabel,
  speakerMatchLabel,
  callRiskScore,
  callRiskLevel,
  conversationalSignals,
  reason,
  isHindi,
}: {
  integrityStatus: FusedIntegrityStatus;
  spoofScore?: number | null;
  rawLabel?: "live" | "likely-synthetic" | "uncertain" | null;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | null;
  callRiskScore?: number | null;
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  conversationalSignals?: string[];
  reason?: string | null;
  isHindi?: boolean;
}): string {
  // If backend/model provided an explicit reason, prioritize it:
  if (reason && reason.trim()) {
    return reason;
  }

  const reasons: string[] = [];

  // 1. Anti-spoof / synthetic voice signal:
  const hasSyntheticSignal =
    integrityStatus === "possible-ai" ||
    rawLabel === "likely-synthetic" ||
    (spoofScore !== null && spoofScore !== undefined && spoofScore > 50);

  if (hasSyntheticSignal) {
    if (speakerMatchLabel === "match") {
      reasons.push(
        isHindi
          ? "ध्वनिक विश्लेषण में संभावित वॉइस क्लोनिंग या कंप्यूटर-जनित आवाज़ के संकेत मिले हैं, जो आपके संपर्क की आवाज़ की नकल हो सकती है।"
          : "Acoustic analysis detected signals indicative of synthetic voice cloning resembling the enrolled contact."
      );
    } else {
      reasons.push(
        isHindi
          ? "ध्वनिक विश्लेषण में संभावित कंप्यूटर-जनित (AI) या सिंथेटिक आवाज़ के लक्षण पाए गए हैं।"
          : "Acoustic analysis detected signals indicative of synthetic or computer-generated voice."
      );
    }
  }

  // 2. Speaker mismatch signal:
  if (integrityStatus === "speaker-mismatch" || speakerMatchLabel === "mismatch") {
    reasons.push(
      isHindi
        ? "कॉलर की आवाज़ इस संपर्क के पंजीकृत वॉइस प्रोफ़ाइल से मेल नहीं खाती है।"
        : "The caller voice does not match the enrolled biometric voice profile for this contact."
    );
  }

  // 3. Conversational threat signals:
  if (conversationalSignals && conversationalSignals.length > 0) {
    const signalNames = conversationalSignals.map((s) => {
      if (s === "MONEY_REQUEST") return isHindi ? "पैसे की मांग" : "Financial demand";
      if (s === "URGENCY") return isHindi ? "अनावश्यक जल्दबाजी" : "Urgency pressure";
      if (s === "CREDENTIAL_REQUEST") return isHindi ? "गोपनीय जानकारी (OTP/PIN) मांगना" : "Credential/OTP request";
      if (s === "IMPERSONATION_SIGNAL") return isHindi ? "अधिकारी होने का दिखावा" : "Authority impersonation";
      if (s === "PRESSURE_TACTIC") return isHindi ? "धमकी या दबाव" : "Coercive pressure tactic";
      return s;
    });
    reasons.push(
      isHindi
        ? `बातचीत में संदिग्ध पैटर्न पाए गए: ${signalNames.join(", ")}।`
        : `Conversational risk patterns detected: ${signalNames.join(", ")}.`
    );
  } else if ((callRiskScore ?? 0) >= 70 || callRiskLevel === "HIGH") {
    reasons.push(
      isHindi
        ? "कॉल थ्रेट एल्गोरिदम ने उच्च जोखिम स्तर दर्ज किया है।"
        : "Call threat analysis calculated a high threat risk level."
    );
  }

  if (reasons.length > 0) {
    return reasons.join(" ");
  }

  return isHindi
    ? "VIRA के पास कोई विशिष्ट कारण बताने के लिए पर्याप्त प्रमाण नहीं हैं।"
    : "VIRA does not have enough evidence to provide a specific reason.";
}

export function WhyFlaggedModal({
  isOpen,
  onClose,
  callRiskScore,
  callRiskLevel,
  integrityStatus,
  voiceIntegrityScore,
  speakerMatchLabel,
  speakerSimilarity,
  spoofScore,
  rawLabel,
  conversationalSignals,
  reason,
}: WhyFlaggedModalProps) {
  const { isEasyMode, language } = useEasyMode();
  const isHindi = isEasyMode && language === "hi";

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const synthesizedReason = useMemo(() => {
    return buildFlaggedReason({
      integrityStatus,
      spoofScore,
      rawLabel,
      speakerMatchLabel,
      callRiskScore,
      callRiskLevel,
      conversationalSignals,
      reason,
      isHindi,
    });
  }, [
    integrityStatus,
    spoofScore,
    rawLabel,
    speakerMatchLabel,
    callRiskScore,
    callRiskLevel,
    conversationalSignals,
    reason,
    isHindi,
  ]);

  if (!isOpen) return null;

  // Format Voice Integrity display
  let integrityDisplay = isHindi ? "जांच जारी है" : "Evaluating...";
  if (integrityStatus === "human-verified") {
    integrityDisplay = isHindi ? "मानव आवाज़ (सुरक्षित)" : "Human Verified (Likely Real)";
  } else if (integrityStatus === "possible-ai") {
    integrityDisplay = isHindi ? "संभावित AI / क्लोन आवाज़" : "Likely Synthetic / AI Clone";
  } else if (integrityStatus === "speaker-mismatch") {
    integrityDisplay = isHindi ? "आवाज़ मेल नहीं खाती" : "Speaker Mismatch";
  } else if (integrityStatus === "not-enrolled") {
    integrityDisplay = isHindi ? "पंजीकृत नहीं" : "Not Enrolled";
  } else if (integrityStatus === "analysis-unavailable") {
    integrityDisplay = isHindi ? "विश्लेषण अनुपलब्ध" : "Analysis Unavailable";
  }

  // Format Speaker Match display
  let speakerMatchDisplay = "N/A";
  if (speakerMatchLabel === "match") {
    speakerMatchDisplay = isHindi ? "मेल खाता है (Match)" : "Match";
  } else if (speakerMatchLabel === "likely-match") {
    speakerMatchDisplay = isHindi ? "संभावित मेल" : "Likely Match";
  } else if (speakerMatchLabel === "mismatch") {
    speakerMatchDisplay = isHindi ? "मेल नहीं खाता (Mismatch)" : "Mismatch";
  } else if (speakerMatchLabel === "not-enrolled") {
    speakerMatchDisplay = isHindi ? "पंजीकृत नहीं (Not Enrolled)" : "Not Enrolled";
  } else if (speakerMatchLabel === "uncertain") {
    speakerMatchDisplay = isHindi ? "अनिश्चित (Uncertain)" : "Uncertain";
  }
  if (speakerSimilarity !== null && speakerSimilarity !== undefined && speakerSimilarity > 0) {
    speakerMatchDisplay += ` (${Math.round(speakerSimilarity * 100)}%)`;
  }

  // Format Risk Score display
  let riskDisplay = "N/A";
  if (callRiskScore !== null && callRiskScore !== undefined) {
    const levelStr = callRiskLevel ? ` [${callRiskLevel}]` : "";
    riskDisplay = `${callRiskScore}/100${levelStr}`;
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="why-flagged-title"
      onClick={onClose}
    >
      <div
        className="why-flagged-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="why-flagged-title" className="why-flagged-title">
          {isHindi ? "VIRA ने इस कॉल को चेतावनी क्यों दी" : "Why VIRA Flagged This Call"}
        </h3>

        <div className="flag-metric-row">
          <span className="flag-metric-label">
            {isHindi ? "जोखिम स्कोर (Risk Score)" : "Risk Score"}
          </span>
          <span className="flag-metric-val">{riskDisplay}</span>
        </div>

        <div className="flag-metric-row">
          <span className="flag-metric-label">
            {isHindi ? "आवाज़ अखंडता (Voice Integrity)" : "Voice Integrity"}
          </span>
          <span className="flag-metric-val">
            {integrityDisplay}
            {voiceIntegrityScore !== null && voiceIntegrityScore !== undefined && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>
                ({voiceIntegrityScore}/100)
              </span>
            )}
          </span>
        </div>

        <div className="flag-metric-row">
          <span className="flag-metric-label">
            {isHindi ? "वक्ता सत्यापन (Speaker Verification)" : "Speaker Verification"}
          </span>
          <span className="flag-metric-val">{speakerMatchDisplay}</span>
        </div>

        <div className="flag-reason-box">
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--color-black)" }}>
            {isHindi ? "कारण (Reason):" : "Reason:"}
          </div>
          <div>{synthesizedReason}</div>
        </div>

        <div className="why-flagged-actions">
          <button
            type="button"
            className="btn-call-action-minimal"
            onClick={onClose}
            autoFocus
          >
            {isHindi ? "बंद करें" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
