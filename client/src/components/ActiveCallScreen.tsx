import { useEffect, useRef } from "react";
import { ActiveCallInfo, CallState } from "../types/call";
import { formatDuration, useCallTimer } from "../hooks/useCallTimer";
import { useVoiceVerification } from "../hooks/useVoiceVerification";

interface ActiveCallScreenProps {
  activeCall: ActiveCallInfo;
  callState: CallState;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

const STATE_LABELS: Record<CallState, string> = {
  IDLE: "",
  CALLING: "Calling...",
  RINGING: "Incoming call",
  ACCEPTED: "Connecting...",
  CONNECTING: "Connecting...",
  CONNECTED: "Connected",
  REJECTED: "Call rejected",
  ENDED: "Call ended",
};

const VERIFICATION_LABELS: Record<string, string> = {
  listening: "Checking voice...",
  checking: "Checking voice...",
  verified: "✓ Voice Verified",
  mismatch: "⚠️ Voice Does Not Match Account",
  not_enrolled: "Caller has not enrolled their voice",
  unavailable: "Voice check unavailable",
};

export function ActiveCallScreen({
  activeCall,
  callState,
  remoteStream,
  isMuted,
  onToggleMute,
  onEndCall,
}: ActiveCallScreenProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duration = useCallTimer(callState === "CONNECTED");

  // Only the callee verifies — never the caller, and never self-reported.
  // See hooks/useVoiceVerification.ts for why.
  const { status: verificationStatus, score: verificationScore } = useVoiceVerification(
    remoteStream,
    callState === "CONNECTED",
    !activeCall.isCaller,
    activeCall.remoteUser.id
  );

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const canEndOrCancel =
    callState === "CALLING" ||
    callState === "ACCEPTED" ||
    callState === "CONNECTING" ||
    callState === "CONNECTED";

  const verificationLabel = VERIFICATION_LABELS[verificationStatus];
  const isMismatch = verificationStatus === "mismatch";

  return (
    <div className="active-call-screen">
      <h2>{activeCall.remoteUser.username}</h2>
      <p className="call-status">{STATE_LABELS[callState]}</p>

      {callState === "CONNECTED" && (
        <p className="call-timer">{formatDuration(duration)}</p>
      )}

      {!activeCall.isCaller && callState === "CONNECTED" && verificationLabel && (
        <p className={isMismatch ? "voice-mismatch-badge" : "voice-status-badge"}>
          {verificationLabel}
          {verificationScore !== null && ` (score: ${verificationScore.toFixed(3)})`}
        </p>
      )}

      <audio ref={audioRef} autoPlay playsInline />

      <div className="call-controls">
        {callState === "CONNECTED" && (
          <button onClick={onToggleMute}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
        )}
        {canEndOrCancel && (
          <button className="btn-end" onClick={onEndCall}>
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
