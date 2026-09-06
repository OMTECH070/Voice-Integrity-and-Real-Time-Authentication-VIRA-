import { useEasyMode } from "../context/EasyModeContext";

interface EasyModeListenButtonProps {
  textToSpeak: string;
  className?: string;
  style?: React.CSSProperties;
  size?: "small" | "medium" | "large";
}

export function EasyModeListenButton({
  textToSpeak,
  className = "",
  style = {},
  size = "medium",
}: EasyModeListenButtonProps) {
  const { isSpeaking, isSpeechSupported, speakText, stopSpeaking, t } = useEasyMode();

  if (!isSpeechSupported) {
    return (
      <button
        disabled
        className={`easy-mode-listen-btn unsupported ${className}`}
        title={t("speechNotSupported")}
        style={{
          opacity: 0.5,
          cursor: "not-allowed",
          padding: size === "large" ? "12px 20px" : size === "small" ? "6px 12px" : "8px 16px",
          fontSize: size === "large" ? "16px" : size === "small" ? "13px" : "14px",
          fontWeight: 600,
          borderRadius: "6px",
          border: "1px solid var(--border-medium)",
          background: "var(--bg-subtle)",
          color: "var(--text-muted)",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          ...style,
        }}
      >
        <span>🔇</span>
        <span>{t("listen")}</span>
      </button>
    );
  }

  const handleClick = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(textToSpeak);
    }
  };

  const isSmall = size === "small";
  const isLarge = size === "large";

  return (
    <button
      onClick={handleClick}
      className={`easy-mode-listen-btn ${isSpeaking ? "speaking" : ""} ${className}`}
      aria-label={isSpeaking ? t("stop") : t("listen")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: isLarge ? "14px 24px" : isSmall ? "6px 14px" : "10px 18px",
        fontSize: isLarge ? "18px" : isSmall ? "13px" : "15px",
        fontWeight: 700,
        borderRadius: "8px",
        border: isSpeaking ? "2px solid #dc2626" : "2px solid #000000",
        background: isSpeaking ? "#dc2626" : "#ffffff",
        color: isSpeaking ? "#ffffff" : "#000000",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: isSpeaking ? "0 0 12px rgba(220, 38, 38, 0.4)" : "0 2px 4px rgba(0,0,0,0.06)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: isLarge ? "20px" : "16px" }}>
        {isSpeaking ? "⏹" : "🔊"}
      </span>
      <span>{isSpeaking ? t("stop") : t("listen")}</span>
    </button>
  );
}
