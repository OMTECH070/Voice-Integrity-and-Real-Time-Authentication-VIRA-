import { FormEvent, useState } from "react";
import { useCallManager } from "../hooks/useCallManager";
import { UserList } from "../components/UserList";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { ActiveCallScreen } from "../components/ActiveCallScreen";
import { ErrorBanner } from "../components/ErrorBanner";

export function Home() {
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

  const [usernameInput, setUsernameInput] = useState("");

  function handleRegister(e: FormEvent) {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (trimmed.length === 0) return;
    register(trimmed);
  }

  if (!self) {
    return (
      <div className="page-container">
        <h1>VIRA</h1>
        <p className="tagline">1-to-1 voice calling</p>
        <form onSubmit={handleRegister} className="register-form">
          <input
            type="text"
            placeholder="Enter your username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            autoFocus
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }

  const isIdle = callState === "IDLE";
  const isRinging = callState === "RINGING";
  const isInCallFlow = !isIdle && !isRinging;

  return (
    <div className="page-container">
      <h1>VIRA</h1>
      <p className="tagline">
        Signed in as <strong>{self.username}</strong>
      </p>

      {error && <ErrorBanner error={error} onDismiss={dismissError} />}

      {isIdle && (
        <UserList
          users={users}
          selfId={self.id}
          onCall={callUser}
          disabled={!isIdle}
        />
      )}

      {isRinging && activeCall && (
        <IncomingCallModal
          caller={activeCall.remoteUser}
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
    </div>
  );
}
