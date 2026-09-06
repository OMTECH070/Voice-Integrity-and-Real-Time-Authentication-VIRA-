import { useEasyMode } from "../context/EasyModeContext";

interface EasyModeNavToggleProps {
  className?: string;
}

export function EasyModeNavToggle({ className = "" }: EasyModeNavToggleProps) {
  const { isEasyMode, language, enableEasyMode, disableEasyMode, toggleLanguage, t } = useEasyMode();

  if (!isEasyMode) {
    return (
      <button
        id="easy-mode-toggle-btn"
        data-testid="easy-mode-toggle-btn"
        type="button"
        onClick={enableEasyMode}
        className={`easy-mode-toggle-btn ${className}`}
        aria-label="Easy Mode"
        title="Switch to simplified, high-contrast Easy Mode with audio explanations"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "7px 16px",
          fontSize: "13.5px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          background: "#ffffff",
          color: "#000000",
          border: "1.5px solid #000000",
          borderRadius: "9999px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s ease",
          minHeight: "36px",
          lineHeight: 1,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#000000";
          e.currentTarget.style.background = "#000000";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#000000";
          e.currentTarget.style.background = "#ffffff";
          e.currentTarget.style.color = "#000000";
        }}
      >
        <span>Easy Mode</span>
      </button>
    );
  }

  return (
    <div
      className={`easy-mode-nav-group ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "nowrap",
      }}
    >
      {/* Language Switcher */}
      <button
        onClick={toggleLanguage}
        className="easy-mode-lang-toggle"
        title={language === "en" ? "Switch to Hindi (हिंदी)" : "Switch to English"}
        style={{
          padding: "6px 12px",
          fontSize: "13px",
          fontWeight: 700,
          background: "#ffffff",
          color: "#000000",
          border: "1.5px solid #000000",
          borderRadius: "6px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          minHeight: "36px",
        }}
      >
        {language === "en" ? "🌐 हिंदी" : "🌐 English"}
      </button>

      {/* Exit Easy Mode */}
      <button
        onClick={disableEasyMode}
        className="easy-mode-exit-btn"
        style={{
          padding: "6px 14px",
          fontSize: "13px",
          fontWeight: 700,
          background: "#000000",
          color: "#ffffff",
          border: "1.5px solid #000000",
          borderRadius: "6px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          minHeight: "36px",
        }}
      >
        {t("exitEasyMode")}
      </button>
    </div>
  );
}
