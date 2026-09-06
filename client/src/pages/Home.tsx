import { useEffect, useState, useMemo } from "react";
import { useCallManager } from "../hooks/useCallManager";
import { UseAuthResult } from "../hooks/useAuth";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { ActiveCallScreen } from "../components/ActiveCallScreen";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProfileEditor } from "./ProfileEditor";
import { ContactsPanel } from "./ContactsPanel";
import { VoiceEnrollment } from "./VoiceEnrollment";
import { SecurityIndicator } from "../components/SecurityIndicator";
import { HowViraWorksModal } from "../components/HowViraWorksModal";
import { PrivacyModal } from "../components/PrivacyModal";
import { supabase } from "../services/supabaseClient";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeNavToggle } from "../components/EasyModeNavToggle";
import { EasyModeListenButton } from "../components/EasyModeListenButton";

interface HomeProps {
  auth: UseAuthResult;
  onBackToLanding?: () => void;
}

export function Home({ auth, onBackToLanding }: HomeProps) {
  const {
    self,
    users,
    callState,
    activeCall,
    error,
    localStream,
    remoteStream,
    isMuted,
    register,
    callUser,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    dismissError,
  } = useCallManager();

  const [activeTab, setActiveTab] = useState<"home" | "contacts">("home");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showVoiceEnrollment, setShowVoiceEnrollment] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasVoiceProfile, setHasVoiceProfile] = useState<boolean | null>(null);

  // Register presence using the REAL authenticated account
  useEffect(() => {
    if (auth.user) {
      register(auth.user.id, auth.user.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  // Check voice profile enrollment status
  useEffect(() => {
    async function checkEnrollment() {
      if (!auth.user) return;
      try {
        const { data } = await supabase
          .from("voice_profiles")
          .select("enrolled_at")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        setHasVoiceProfile(!!data);
      } catch (err) {
        console.warn("Could not check voice enrollment on home:", err);
      }
    }
    checkEnrollment();
  }, [auth.user, showVoiceEnrollment]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    const others = users.filter((u) => u.id !== self?.id);
    if (!searchQuery.trim()) return others;
    const q = searchQuery.toLowerCase().trim();
    return others.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, self?.id, searchQuery]);

  if (!self) {
    return (
      <div className="page-container app-connecting-container">
        <h1 className="brand-logo-text" style={{ fontSize: "24px", marginBottom: "8px" }}>VIRA</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 20px 0" }}>
          Connecting to secure WebRTC signaling network...
        </p>
        <div className="cyber-spinner" />
      </div>
    );
  }

  const isIdle = callState === "IDLE";
  const isRinging = callState === "RINGING";
  const isInCallFlow = !isIdle && !isRinging;

  const { isEasyMode, t } = useEasyMode();

  return (
    <div className="main-dashboard-container">
      {/* Minimal Top Navigation */}
      <nav className="app-navbar" role="navigation" aria-label="Main Navigation">
        <div className="navbar-brand-group">
          <div
            className="vira-brand-logo"
            onClick={() => (onBackToLanding ? onBackToLanding() : setActiveTab("home"))}
            title="Return to VIRA Overview"
          >
            <span className="brand-logo-text">VIRA</span>
          </div>

          <div className="nav-links-list">
            <button
              className={`nav-link-btn ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              Home
            </button>
            <button
              className={`nav-link-btn ${activeTab === "contacts" ? "active" : ""}`}
              onClick={() => setActiveTab("contacts")}
            >
              Contacts
            </button>
            <button
              className="nav-link-btn"
              onClick={() => setShowVoiceEnrollment(true)}
            >
              Voice ID
            </button>
            <button
              className="nav-link-btn"
              onClick={() => setShowHowItWorks(true)}
            >
              How It Works
            </button>
          </div>
        </div>

        <div className="navbar-right-group">
          <EasyModeNavToggle />

          <div className="user-status-pill-clean">
            <span className="status-dot-green" />
            <span className="user-display-name">@{auth.user?.username}</span>
          </div>

          <SecurityIndicator state="active" showLabel={false} />

          <button
            className="nav-btn-text"
            onClick={() => setShowProfileEditor(true)}
          >
            Profile
          </button>

          <button
            className="nav-btn-logout"
            onClick={auth.signOut}
            title="Log out"
          >
            Log Out
          </button>
        </div>
      </nav>

      {error && <ErrorBanner error={error} onDismiss={dismissError} />}

      {/* Main Home Content (When Idle) */}
      {isIdle && (
        <>
          {isEasyMode ? (
            <div
              className="easy-mode-home-content"
              style={{
                maxWidth: "760px",
                margin: "0 auto",
                padding: "32px 20px 60px 20px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {/* Header with Listen */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginBottom: "24px",
                  paddingBottom: "20px",
                  borderBottom: "2px solid #000000",
                }}
              >
                <div>
                  <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 4px 0" }}>
                    🛡️ {t("welcomeTitle")}
                  </h1>
                  <p style={{ fontSize: "16px", color: "#525252", margin: 0 }}>
                    {t("welcomeSubtitle")}
                  </p>
                </div>
                <EasyModeListenButton
                  textToSpeak={`${t("welcomeTitle")}. ${t("welcomeSubtitle")}. ${t("neverShareOtp")}. ${t("verifyBeforeTransfer")}.`}
                  size="medium"
                />
              </div>

              {/* Safety Rules Banner */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "14px",
                  marginBottom: "28px",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    border: "2px solid #171717",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>🔐</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                    {t("neverShareOtp")}
                  </div>
                  <div style={{ fontSize: "13.5px", color: "#525252", lineHeight: 1.4 }}>
                    {t("rule1Desc")}
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    border: "2px solid #171717",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>💸</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                    {t("verifyBeforeTransfer")}
                  </div>
                  <div style={{ fontSize: "13.5px", color: "#525252", lineHeight: 1.4 }}>
                    {t("rule2Desc")}
                  </div>
                </div>
              </div>

              {/* Easy Mode Contacts Section */}
              <div
                style={{
                  padding: "24px",
                  borderRadius: "12px",
                  border: "2px solid #171717",
                  background: "#f5f5f5",
                }}
              >
                <div style={{ marginBottom: "18px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>
                    📞 {t("contacts")}
                  </h2>
                  <p style={{ fontSize: "14px", color: "#525252", margin: "4px 0 0 0" }}>
                    {t("testCallPrompt")}
                  </p>
                </div>

                {filteredUsers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", color: "#737373" }}>
                    No other users online right now.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {filteredUsers.map((user) => {
                      const isAvail = user.status === "available";
                      return (
                        <div
                          key={user.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "16px 20px",
                            background: "#ffffff",
                            borderRadius: "10px",
                            border: "1.5px solid #d4d4d4",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "17px", fontWeight: 700 }}>
                              {user.username}
                            </div>
                            <div style={{ fontSize: "13px", color: isAvail ? "#16a34a" : "#737373", marginTop: "2px" }}>
                              ● {isAvail ? t("online") : t("offline")}
                            </div>
                          </div>

                          <button
                            onClick={() => callUser(user.id)}
                            disabled={!isAvail}
                            style={{
                              padding: "12px 24px",
                              fontSize: "16px",
                              fontWeight: 700,
                              background: isAvail ? "#000000" : "#e5e5e5",
                              color: isAvail ? "#ffffff" : "#a3a3a3",
                              border: isAvail ? "2px solid #000000" : "1px solid #d4d4d4",
                              borderRadius: "8px",
                              cursor: isAvail ? "pointer" : "not-allowed",
                              minHeight: "48px",
                              minWidth: "120px",
                            }}
                          >
                            📞 {t("startCall")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "home" ? (
            <div className="editorial-home-content">
              {/* Editorial Header Section */}
              <section className="editorial-header-section">
                <h1 className="editorial-title">
                  Know who you&rsquo;re really talking to.
                </h1>
                <p className="editorial-subtitle">
                  VIRA verifies speaker identity during live voice communication, helping protect conversations from AI voice cloning.
                </p>
                <div className="editorial-actions-row">
                  <button
                    className="btn-black"
                    onClick={() => {
                      const firstUser = users.find((u) => u.id !== self.id && u.status === "available");
                      if (firstUser) callUser(firstUser.id);
                      else {
                        const peopleEl = document.getElementById("people-section");
                        peopleEl?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                  >
                    Start Secure Call
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => setShowVoiceEnrollment(true)}
                  >
                    Voice ID
                  </button>
                </div>
              </section>

              <hr className="editorial-divider" />

              {/* Voice ID Section */}
              <section className="editorial-section">
                <h2 className="section-label-minimal">Voice ID</h2>
                <div className="voice-id-minimal-row">
                  <div className="voice-id-info-col">
                    <div className="voice-id-status-tag" style={{ color: hasVoiceProfile ? "var(--color-success)" : "var(--text-muted)" }}>
                      <span>●</span>
                      <span>{hasVoiceProfile ? "Ready" : "Not Set Up"}</span>
                    </div>
                    <h4>Your voice profile</h4>
                    <p>
                      {hasVoiceProfile
                        ? "Used to verify your identity during secure calls."
                        : "Record a short passphrase to create your baseline voice profile."}
                    </p>
                  </div>
                  <button
                    className="btn-outline"
                    onClick={() => setShowVoiceEnrollment(true)}
                  >
                    {hasVoiceProfile ? "Manage Voice ID" : "Set Up Voice ID"}
                  </button>
                </div>
              </section>

              <hr className="editorial-divider" />

              {/* People Directory Section */}
              <section id="people-section" className="editorial-section">
                <div className="people-section-header">
                  <h2 className="section-label-minimal" style={{ margin: 0 }}>People</h2>
                  <input
                    type="text"
                    className="search-people-input-minimal"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="empty-list-notice">
                    {searchQuery ? "No users matching your search." : "No other users are online yet."}
                  </div>
                ) : (
                  <ul className="people-list-minimal">
                    {filteredUsers.map((user) => {
                      const initial = (user.username || "U").charAt(0).toUpperCase();
                      const isAvailable = user.status === "available";

                      return (
                        <li key={user.id} className="person-row-minimal">
                          <div className="person-left-meta">
                            <div className="person-avatar-minimal">
                              <span>{initial}</span>
                            </div>
                            <div>
                              <div className="person-name-text">{user.username}</div>
                              <div className="person-handle-text">@{user.username}</div>
                            </div>
                          </div>

                          <div className="person-right-action">
                            <div className="person-status-dot-label">
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor: isAvailable ? "var(--color-success)" : "var(--text-dim)",
                                  display: "inline-block",
                                }}
                              />
                              <span>{isAvailable ? "online" : "offline"}</span>
                            </div>

                            <button
                              className="btn-call-minimal"
                              onClick={() => callUser(user.id)}
                              disabled={!isAvailable}
                              aria-label={`Call ${user.username}`}
                            >
                              Call
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <hr className="editorial-divider" />

              {/* System Section */}
              <section className="editorial-section">
                <h2 className="section-label-minimal">System</h2>
                <table className="system-status-table">
                  <tbody>
                    <tr>
                      <td>Voice verification</td>
                      <td>Ready</td>
                    </tr>
                    <tr>
                      <td>WebRTC</td>
                      <td>Ready</td>
                    </tr>
                    <tr>
                      <td>Anti-spoof detection</td>
                      <td>Ready</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          ) : (
            <div className="editorial-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 className="section-label-minimal" style={{ margin: 0 }}>Verified Contacts</h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                    Known contacts recognized by unique account ID.
                  </p>
                </div>
                <button
                  className="btn-outline"
                  onClick={() => setActiveTab("home")}
                >
                  Back
                </button>
              </div>
              {auth.user && <ContactsPanel ownUserId={auth.user.id} />}
            </div>
          )}
        </>
      )}

      {/* Incoming Call Dialog */}
      {isRinging && activeCall && (
        <IncomingCallModal
          caller={activeCall.remoteUser}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Active Call Interface */}
      {isInCallFlow && activeCall && (
        <ActiveCallScreen
          activeCall={activeCall}
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onEndCall={endCall}
        />
      )}

      {/* Profile Editor Modal */}
      {showProfileEditor && auth.user && (
        <ProfileEditor
          user={auth.user}
          onUpdated={() => auth.refreshProfile()}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

      {/* Voice Enrollment Modal */}
      {showVoiceEnrollment && auth.user && (
        <VoiceEnrollment
          userId={auth.user.id}
          onClose={() => setShowVoiceEnrollment(false)}
          onEnrolled={() => setHasVoiceProfile(true)}
        />
      )}

      {/* How VIRA Works Info Modal */}
      {showHowItWorks && (
        <HowViraWorksModal onClose={() => setShowHowItWorks(false)} />
      )}

      {/* Privacy Guarantees Modal */}
      {showPrivacy && (
        <PrivacyModal onClose={() => setShowPrivacy(false)} />
      )}
    </div>
  );
}
