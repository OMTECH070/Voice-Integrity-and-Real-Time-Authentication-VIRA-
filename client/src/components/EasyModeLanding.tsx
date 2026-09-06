import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeListenButton } from "./EasyModeListenButton";
import { EasyModeNavToggle } from "./EasyModeNavToggle";

interface EasyModeLandingProps {
  onLogin?: () => void;
  onSignUp?: () => void;
  onLaunchApp?: () => void;
  isAuthenticated?: boolean;
}

export function EasyModeLanding({
  onLogin,
  onSignUp,
  onLaunchApp,
  isAuthenticated = false,
}: EasyModeLandingProps) {
  const { t } = useEasyMode();

  const handleStartCall = () => {
    if (isAuthenticated) {
      onLaunchApp?.();
    } else {
      onLogin ? onLogin() : onLaunchApp?.();
    }
  };

  return (
    <div
      className="easy-mode-landing"
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Accessible Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "2px solid #000000",
          background: "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: "#000000",
            }}
          >
            VIRA
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              background: "#000000",
              color: "#ffffff",
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.05em",
            }}
          >
            EASY MODE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <EasyModeNavToggle />

          {!isAuthenticated ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={onLogin || onLaunchApp}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: "transparent",
                  color: "#000000",
                  border: "2px solid #000000",
                  borderRadius: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  minHeight: "36px",
                }}
              >
                {t("signIn")}
              </button>
              <button
                onClick={onSignUp || onLaunchApp}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: "#000000",
                  color: "#ffffff",
                  border: "2px solid #000000",
                  borderRadius: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  minHeight: "36px",
                }}
              >
                {t("signUp")}
              </button>
            </div>
          ) : (
            <button
              onClick={onLaunchApp}
              style={{
                padding: "8px 18px",
                fontSize: "14px",
                fontWeight: 700,
                background: "#000000",
                color: "#ffffff",
                border: "2px solid #000000",
                borderRadius: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: "36px",
              }}
            >
              {t("startCall")}
            </button>
          )}
        </div>
      </header>

      {/* Main Accessible Content */}
      <main
        style={{
          maxWidth: "840px",
          margin: "0 auto",
          padding: "40px 20px 80px 20px",
        }}
      >
        {/* Hero Section */}
        <section
          style={{
            textAlign: "center",
            padding: "20px 0 40px 0",
            borderBottom: "1px solid #e5e5e5",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: "48px",
              marginBottom: "12px",
            }}
            aria-hidden="true"
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "0 0 12px 0",
              lineHeight: 1.15,
            }}
          >
            {t("welcomeTitle")}
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.5vw, 20px)",
              color: "#525252",
              margin: "0 auto 28px auto",
              maxWidth: "600px",
              lineHeight: 1.45,
            }}
          >
            {t("welcomeSubtitle")}
          </p>

          {/* Primary Big Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <EasyModeListenButton
              textToSpeak={t("landingSpokenSummary")}
              size="large"
            />

            <button
              onClick={handleStartCall}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                fontSize: "18px",
                fontWeight: 700,
                background: "#000000",
                color: "#ffffff",
                border: "2px solid #000000",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
                minHeight: "52px",
              }}
            >
              <span aria-hidden="true">📞</span>
              <span>{t("startCall")}</span>
            </button>
          </div>
        </section>

        {/* 3 Golden Rules Cards */}
        <section style={{ padding: "40px 0" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {t("whyFlagged")}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
            }}
          >
            {/* Card 1 */}
            <div
              style={{
                padding: "24px",
                borderRadius: "10px",
                border: "2px solid #171717",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔐</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>
                {t("rule1Title")}
              </h3>
              <p style={{ fontSize: "14px", color: "#525252", margin: 0, lineHeight: 1.45 }}>
                {t("rule1Desc")}
              </p>
            </div>

            {/* Card 2 */}
            <div
              style={{
                padding: "24px",
                borderRadius: "10px",
                border: "2px solid #171717",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>💸</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>
                {t("rule2Title")}
              </h3>
              <p style={{ fontSize: "14px", color: "#525252", margin: 0, lineHeight: 1.45 }}>
                {t("rule2Desc")}
              </p>
            </div>

            {/* Card 3 */}
            <div
              style={{
                padding: "24px",
                borderRadius: "10px",
                border: "2px solid #171717",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🤖</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>
                {t("rule3Title")}
              </h3>
              <p style={{ fontSize: "14px", color: "#525252", margin: 0, lineHeight: 1.45 }}>
                {t("rule3Desc")}
              </p>
            </div>
          </div>
        </section>

        {/* Warning Signs Section (Section 9) */}
        <section
          style={{
            padding: "28px",
            background: "#fafafa",
            borderRadius: "12px",
            border: "1px solid #d4d4d4",
            marginBottom: "36px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px 0" }}>
            🚨 Warning Signs to Watch for on Calls:
          </h2>
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <span>{t("signalMoneyRequest")}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <span>{t("signalUrgency")}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <span>{t("signalCredentialRequest")}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <span>{t("signalImpersonation")}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              <span>{t("signalPressureTactic")}</span>
            </div>
          </div>
        </section>

        {/* Action Advice Card */}
        <section
          style={{
            padding: "24px",
            background: "#fef2f2",
            border: "2px solid #dc2626",
            borderRadius: "10px",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛑</div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#991b1b", margin: "0 0 6px 0" }}>
            {t("reportAdviceTitle")}
          </h3>
          <p style={{ fontSize: "15px", color: "#7f1d1d", margin: 0, lineHeight: 1.4 }}>
            {t("reportAdviceDesc")}
          </p>
        </section>

        {/* Footer Note with link to exit Easy Mode */}
        <footer
          style={{
            textAlign: "center",
            paddingTop: "24px",
            borderTop: "1px solid #e5e5e5",
            fontSize: "13px",
            color: "#737373",
          }}
        >
          <p style={{ margin: "0 0 12px 0" }}>{t("learnMoreTechnical")}</p>
          <p style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>
            * Results are probabilistic and may be affected by audio quality, network conditions, and background noise.
          </p>
        </footer>
      </main>
    </div>
  );
}
