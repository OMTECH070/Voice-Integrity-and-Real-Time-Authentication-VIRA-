import { UseAuthResult } from "../hooks/useAuth";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeNavToggle } from "../components/EasyModeNavToggle";
import { EasyModeListenButton } from "../components/EasyModeListenButton";

interface LaunchingSoonProps {
  auth: UseAuthResult;
  onBackToLanding?: () => void;
  onLogout?: () => void;
}

export function LaunchingSoon({ auth, onBackToLanding, onLogout }: LaunchingSoonProps) {
  const { isEasyMode, t } = useEasyMode();

  return (
    <div className="main-dashboard-container" role="main" aria-label="Launching Soon">
      {/* Minimal Top Navigation Header */}
      <nav className="app-navbar" role="navigation" aria-label="Top Navigation">
        <div className="navbar-brand-group">
          <div
            className="vira-brand-logo"
            onClick={() => (onBackToLanding ? onBackToLanding() : undefined)}
            title="Return to VIRA Overview"
            style={{ cursor: onBackToLanding ? "pointer" : "default" }}
          >
            <span className="brand-logo-text">VIRA</span>
          </div>
        </div>

        <div className="navbar-right-group">
          <EasyModeNavToggle />

          <div className="user-status-pill-clean">
            <span className="status-dot-green" />
            <span className="user-display-name">@{auth.user?.username || auth.user?.displayName}</span>
          </div>

          <button
            className="nav-btn-logout"
            onClick={async () => {
              await auth.signOut();
              onLogout?.();
            }}
            title={t("logout")}
          >
            {t("logout")}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      {isEasyMode ? (
        /* Easy Mode High-Contrast View */
        <div
          className="easy-mode-home-content"
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            padding: "40px 20px 80px 20px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* Header with Listen Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "28px",
              paddingBottom: "20px",
              borderBottom: "2px solid #000000",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  background: "#000000",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                {t("launchingSoon")}
              </div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 8px 0" }}>
                {t("launchingSoonTitle")}
              </h1>
              <p style={{ fontSize: "16px", color: "#525252", margin: 0, lineHeight: 1.5 }}>
                {t("launchingSoonSubtitle")}
              </p>
            </div>

            <EasyModeListenButton
              textToSpeak={t("launchingSoonSpoken")}
              size="medium"
            />
          </div>

          {/* Account Verified Notice Card */}
          <div
            style={{
              padding: "24px",
              borderRadius: "12px",
              border: "2px solid #171717",
              background: "#ffffff",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "6px" }}>
              {t("launchingSoonAccountReady")}
            </div>
            <p style={{ fontSize: "15px", color: "#404040", margin: 0, lineHeight: 1.5 }}>
              {t("launchingSoonAccountDesc")}
            </p>
          </div>

          {/* Safety Rules Reminder */}
          <div
            style={{
              padding: "20px",
              borderRadius: "10px",
              border: "1.5px solid #d4d4d4",
              background: "#f5f5f5",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
              🛡️ {t("neverShareOtp")}
            </div>
            <div style={{ fontSize: "13.5px", color: "#525252", lineHeight: 1.4 }}>
              {t("rule1Desc")}
            </div>
          </div>
        </div>
      ) : (
        /* Standard Editorial Minimalist View */
        <div className="editorial-home-content" style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 20px" }}>
          <section className="editorial-header-section" style={{ borderBottom: "none", paddingBottom: "16px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 12px",
                borderRadius: "9999px",
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: "20px",
              }}
            >
              <span>●</span>
              <span>{t("launchingSoon")}</span>
            </div>

            <h1 className="editorial-title" style={{ fontSize: "36px", marginBottom: "16px" }}>
              {t("launchingSoonTitle")}
            </h1>

            <p className="editorial-subtitle" style={{ fontSize: "16px", lineHeight: 1.6, maxWidth: "600px" }}>
              {t("launchingSoonSubtitle")}
            </p>
          </section>

          <hr className="editorial-divider" style={{ margin: "24px 0 32px 0" }} />

          {/* Account Verification & Registration Badge */}
          <section className="editorial-section">
            <h2 className="section-label-minimal">Account Status</h2>
            <div
              style={{
                padding: "24px",
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border)",
                background: "var(--bg-surface, #ffffff)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-success, #16a34a)",
                      display: "inline-block",
                    }}
                  />
                  <strong style={{ fontSize: "14px" }}>@{auth.user?.username || auth.user?.displayName}</strong>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {t("launchingSoonAccountDesc")}
                </div>
              </div>

              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Standard User
              </div>
            </div>
          </section>

          <hr className="editorial-divider" style={{ margin: "32px 0" }} />

          {/* System Notice */}
          <section className="editorial-section">
            <h2 className="section-label-minimal">Platform Telemetry</h2>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              VIRA is rolling out in scheduled phases to verify baseline acoustic models and distributed WebRTC signaling
              stability. You will be notified the moment live authentication and secure calls are opened for your account tier.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
