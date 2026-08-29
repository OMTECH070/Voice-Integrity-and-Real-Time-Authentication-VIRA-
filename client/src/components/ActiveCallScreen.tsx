import { useEffect, useRef } from "react";
import { ActiveCallInfo, CallState } from "../types/call";
import { formatDuration, useCallTimer } from "../hooks/useCallTimer";

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

  return (
    <div className="active-call-screen">
      <h2>{activeCall.remoteUser.username}</h2>
      <p className="call-status">{STATE_LABELS[callState]}</p>

      {callState === "CONNECTED" && (
        <p className="call-timer">{formatDuration(duration)}</p>
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
