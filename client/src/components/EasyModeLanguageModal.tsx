import { useEffect, useRef } from "react";
import { useEasyMode } from "../context/EasyModeContext";

export function EasyModeLanguageModal() {
  const { showLanguageModal, selectLanguageAndEnable, closeLanguageModal } = useEasyMode();
  const hindiBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (showLanguageModal) {
      // Focus the first button for accessible keyboard navigation
      setTimeout(() => hindiBtnRef.current?.focus(), 50);
    }
  }, [showLanguageModal]);

  useEffect(() => {
    if (!showLanguageModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLanguageModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLanguageModal, closeLanguageModal]);

  if (!showLanguageModal) return null;

  return (
    <div
      className="easy-mode-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="easy-mode-lang-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLanguageModal();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        className="easy-mode-modal-card"
        style={{
          background: "#ffffff",
          color: "#000000",
          borderRadius: "12px",
          padding: "36px 32px",
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          border: "2px solid #171717",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }} aria-hidden="true">
          🌐
        </div>
        <h2
          id="easy-mode-lang-title"
          style={{
            fontSize: "24px",
            fontWeight: 700,
            margin: "0 0 4px 0",
            letterSpacing: "-0.02em",
          }}
        >
          Choose Language
        </h2>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "#525252",
            margin: "0 0 28px 0",
          }}
        >
          भाषा चुनें
        </div>

        <p
          style={{
            fontSize: "14px",
            color: "#737373",
            margin: "0 0 24px 0",
            lineHeight: 1.4,
          }}
        >
          Select your preferred language for Easy Mode. You can change this anytime.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <button
            ref={hindiBtnRef}
            onClick={() => selectLanguageAndEnable("hi")}
            className="easy-mode-lang-btn"
            style={{
              padding: "16px 20px",
              fontSize: "18px",
              fontWeight: 700,
              background: "#000000",
              color: "#ffffff",
              border: "2px solid #000000",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "transform 0.15s ease, background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            हिंदी
          </button>

          <button
            onClick={() => selectLanguageAndEnable("en")}
            className="easy-mode-lang-btn"
            style={{
              padding: "16px 20px",
              fontSize: "18px",
              fontWeight: 700,
              background: "#ffffff",
              color: "#000000",
              border: "2px solid #000000",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "transform 0.15s ease, background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}
