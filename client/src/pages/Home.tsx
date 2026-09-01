import { useEffect, useState } from "react";
import { useCallManager } from "../hooks/useCallManager";
import { UseAuthResult } from "../hooks/useAuth";
import { UserList } from "../components/UserList";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { ActiveCallScreen } from "../components/ActiveCallScreen";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProfileEditor } from "./ProfileEditor";
import { ContactsPanel } from "./ContactsPanel";
import { EnrollVoice } from "./EnrollVoice";

interface HomeProps {
  auth: UseAuthResult;
}

export function Home({ auth }: HomeProps) {
  const {
    self,
    users,
    callState,
    activeCall,
    error,
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

  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showEnrollVoice, setShowEnrollVoice] = useState(false);

  // Register presence using the REAL authenticated account, not a
  // typed-in name — this is what makes the calling system target
  // people by their actual persistent identity.
  useEffect(() => {
    if (auth.user) {
      register(auth.user.id, auth.user.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  if (!self) {
    return (
      <div className="page-container">
        <h1>VIRA</h1>
        <p className="tagline">Connecting...</p>
      </div>
    );
  }

  const isIdle = callState === "IDLE";
  const isRinging = callState === "RINGING";
  const isInCallFlow = !isIdle && !isRinging;

  return (
    <div className="page-container">
      <div className="home-header">
        <div>
          <h1>VIRA</h1>
          <p className="tagline">
            Signed in as <strong>{auth.user?.displayName}</strong> (@{auth.user?.username})
          </p>
        </div>
        <div className="home-header-actions">
          <button onClick={() => setShowProfileEditor(true)}>Edit Profile</button>
          <button onClick={() => setShowEnrollVoice(true)}>Enroll Voice</button>
          <button onClick={() => setShowContacts((v) => !v)}>
            {showContacts ? "Hide Contacts" : "Contacts"}
          </button>
          <button onClick={auth.signOut}>Log Out</button>
        </div>
      </div>

      {error && <ErrorBanner error={error} onDismiss={dismissError} />}

      {showContacts && auth.user && <ContactsPanel ownUserId={auth.user.id} />}

      {isIdle && (
        <UserList users={users} selfId={self.id} onCall={callUser} disabled={!isIdle} />
      )}

      {isRinging && activeCall && (
        <IncomingCallModal
          caller={activeCall.remoteUser}
          relationship={activeCall.relationship}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {isInCallFlow && activeCall && (
        <ActiveCallScreen
          activeCall={activeCall}
          callState={callState}
          remoteStream={remoteStream}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onEndCall={endCall}
        />
      )}

      {showProfileEditor && auth.user && (
        <ProfileEditor
          user={auth.user}
          onUpdated={() => auth.refreshProfile()}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

      {showEnrollVoice && <EnrollVoice onClose={() => setShowEnrollVoice(false)} />}
    </div>
  );
}
