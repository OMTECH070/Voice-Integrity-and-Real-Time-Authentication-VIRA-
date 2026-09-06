import { useEffect, useRef, useState } from "react";
import { ActiveCallInfo, CallState } from "../types/call";
import { formatDuration, useCallTimer } from "../hooks/useCallTimer";
import { useCallVAD } from "../hooks/useCallVAD";
import { useVoiceAnalysis } from "../hooks/useVoiceAnalysis";
import { VoiceIntegrityBadge } from "./VoiceIntegrityBadge";
import { SecurityIndicator, SecurityState } from "./SecurityIndicator";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeCallScreen } from "./EasyModeCallScreen";
import type { SpeechSegment } from "../audio/vad/types";

interface ActiveCallScreenProps {
  activeCall: ActiveCallInfo;
  callState: CallState;
  localStream?: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  onRemoteSpeechSegment?: (segment: SpeechSegment) => void;
  onLocalSpeechSegment?: (segment: SpeechSegment) => void;
}

const STATE_LABELS: Record<CallState, string> = {
  IDLE: "Idle",
  CALLING: "Calling...",
  RINGING: "Ringing...",
  ACCEPTED: "Connecting...",
  CONNECTING: "Connecting...",
  CONNECTED: "Connected",
  REJECTED: "Call rejected",
  ENDED: "Call ended",
};

/**
 * Routes call audio output between loudspeaker and normal default/earpiece output.
 * Remote audio is NEVER muted by the speaker toggle.
 */
async function routeAudioOutput(
  audioEl: HTMLAudioElement | null,
  isSpeakerOn: boolean
): Promise<void> {
  if (!audioEl) return;

  // Remote caller audio MUST remain audible in both states
  audioEl.muted = false;

  if (!("setSinkId" in audioEl) || typeof audioEl.setSinkId !== "function") {
    // Browser does not expose setSinkId; remote audio continues through default output
    return;
  }

  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      await audioEl.setSinkId("");
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

    if (audioOutputs.length === 0) {
      await audioEl.setSinkId("");
      return;
    }

    if (isSpeakerOn) {
      // Speaker On: Route to loudspeaker if exposed, or default output
      const speakerDevice = audioOutputs.find((d) => {
        const label = d.label.toLowerCase();
        return (
          (label.includes("speaker") || label.includes("loudspeaker")) &&
          !label.includes("earpiece") &&
          !label.includes("handset") &&
          !label.includes("headphone") &&
          !label.includes("headset")
        );
      });

      const targetId = speakerDevice
        ? speakerDevice.deviceId
        : (audioOutputs.find((d) => d.deviceId === "default")?.deviceId || "");
      await audioEl.setSinkId(targetId);
    } else {
      // Speaker Off: Route to earpiece / handset / communications receiver / default output
      const earpieceDevice = audioOutputs.find((d) => {
        const label = d.label.toLowerCase();
        return (
          label.includes("earpiece") ||
          label.includes("handset") ||
          label.includes("receiver") ||
          label.includes("phone") ||
          label.includes("headphone") ||
          label.includes("headset") ||
          label.includes("communications")
        );
      });

      const targetId = earpieceDevice ? earpieceDevice.deviceId : "";
      await audioEl.setSinkId(targetId);
    }
  } catch (err) {
    console.warn("[VIRA][AUDIO] setSinkId routing fallback:", err);
  }
}

export function ActiveCallScreen({
  activeCall,
  callState,
  localStream = null,
  remoteStream,
  isMuted,
  onToggleMute,
  onEndCall,
  onRemoteSpeechSegment,
  onLocalSpeechSegment,
}: ActiveCallScreenProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duration = useCallTimer(callState === "CONNECTED");
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  // Real-time rolling buffer & streaming transport for speech analysis
  const analysis = useVoiceAnalysis({
    callId: activeCall.callId,
    enabled: callState === "CONNECTED",
  });

  // Non-intrusive dual-stream VAD observer
  const { localVAD, remoteVAD } = useCallVAD({
    localStream,
    remoteStream,
    isLocalMuted: isMuted,
    onRemoteSpeechSegment,
    onLocalSpeechSegment,
    onRemoteSpeechFrame: analysis.handleRemoteSpeechFrame,
    onLocalSpeechFrame: analysis.handleLocalSpeechFrame,
  });

  // Ensure remote audio playback is attached and audible
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.muted = false;
      void routeAudioOutput(audioRef.current, speakerEnabled);
    }
  }, [remoteStream]);

  // Handle speaker output route switching without ever muting
  useEffect(() => {
    if (audioRef.current) {
      void routeAudioOutput(audioRef.current, speakerEnabled);
    }
  }, [speakerEnabled]);

  const toggleSpeaker = () => {
    setSpeakerEnabled((prev) => {
      const next = !prev;
      void routeAudioOutput(audioRef.current, next);
      return next;
    });
  };

  // Derive security state for indicator
  let securityState: SecurityState = "idle";
  if (callState === "CONNECTED") {
    if (analysis.integrityStatus === "possible-ai" || analysis.integrityStatus === "speaker-mismatch") {
      securityState = "warning";
    } else if (analysis.integrityStatus === "human-verified" || analysis.integrityStatus === "not-enrolled") {
      securityState = "active";
    } else if (analysis.integrityStatus === "analysis-unavailable") {
      securityState = "offline";
    } else {
      securityState = "limited";
    }
  }

  const { isEasyMode } = useEasyMode();

  if (isEasyMode) {
    return (
      <div className="active-call-canvas easy-mode-active" role="main" aria-label="Secure Easy Mode Call">
        <audio ref={audioRef} autoPlay playsInline />
        <EasyModeCallScreen
          activeCall={activeCall}
          callState={callState}
          duration={duration}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          onEndCall={onEndCall}
          isSpeakingRemote={remoteVAD.isSpeaking}
          isSpeakingLocal={localVAD.isSpeaking}
          integrityStatus={analysis.integrityStatus}
          spoofScore={analysis.spoofScore}
          rawLabel={analysis.rawLabel}
          lastLatencyMs={analysis.lastLatencyMs}
          sequenceNumber={analysis.lastSentSequenceNumber}
          speakerSimilarity={analysis.speakerSimilarity}
          speakerMatchLabel={analysis.speakerMatchLabel}
          confidence={analysis.confidence}
          reason={analysis.reason}
          isSmoothed={analysis.isSmoothed}
          calibrationVersion={analysis.calibrationVersion}
          hasRemoteStream={!!remoteStream && remoteStream.getAudioTracks().length > 0}
          bufferedDurationMs={analysis.bufferedDurationMs}
          targetWindowDurationMs={analysis.targetWindowDurationMs}
          analysisStatus={analysis.status}
          lastAnalyzedTimestampMs={analysis.lastAnalyzedTimestampMs}
          analysisWindowNumber={analysis.analysisWindowNumber}
          wav2vec2Status={analysis.wav2vec2Status}
          wav2vec2Score={analysis.wav2vec2Score}
          callRiskScore={analysis.callRiskScore}
          callRiskLevel={analysis.callRiskLevel}
          conversationalSignals={analysis.conversationalSignals}
          voiceIntegrityScore={analysis.voiceIntegrityScore}
        />
      </div>
    );
  }

  const canEndOrCancel =
    callState === "CALLING" ||
    callState === "ACCEPTED" ||
    callState === "CONNECTING" ||
    callState === "CONNECTED";

  const initial = (activeCall.remoteUser.username || "U").charAt(0).toUpperCase();

  return (
    <div className="active-call-canvas" role="main" aria-label="Secure WebRTC Call">
      {/* Top Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div className="call-header-status" style={{ margin: 0 }}>
          <span style={{ color: callState === "CONNECTED" ? "var(--color-success)" : "var(--color-warning)" }}>●</span>
          <span>{STATE_LABELS[callState]}</span>
        </div>
        <SecurityIndicator state={securityState} />
      </div>

      {/* Large Minimal Avatar */}
      <div className="caller-avatar-circle-minimal">
        <span>{initial}</span>
        {callState === "CONNECTED" && remoteVAD.isSpeaking && (
          <div className="speech-active-ring" aria-hidden="true" />
        )}
      </div>

      <h2 className="caller-name-minimal">
        {activeCall.remoteUser.username}
      </h2>
      <p className="caller-handle-minimal">@{activeCall.remoteUser.username}</p>

      {/* Call Timer */}
      {callState === "CONNECTED" && (
        <div className="call-timer-minimal" aria-live="off">
          {formatDuration(duration)}
        </div>
      )}

      {/* Monochrome Waveform */}
      <div className="monochrome-waveform" aria-hidden="true">
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
        <div className={`mono-wave-bar ${remoteVAD.isSpeaking ? "speaking" : ""}`} />
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Voice Integrity Section */}
      {callState === "CONNECTED" && (
        <VoiceIntegrityBadge
          integrityStatus={analysis.integrityStatus}
          spoofScore={analysis.spoofScore}
          rawLabel={analysis.rawLabel}
          lastLatencyMs={analysis.lastLatencyMs}
          sequenceNumber={analysis.lastSentSequenceNumber}
          speakerSimilarity={analysis.speakerSimilarity}
          speakerMatchLabel={analysis.speakerMatchLabel}
          confidence={analysis.confidence}
          reason={analysis.reason}
          isSmoothed={analysis.isSmoothed}
          calibrationVersion={analysis.calibrationVersion}
          hasRemoteStream={!!remoteStream && remoteStream.getAudioTracks().length > 0}
          isRemoteSpeaking={remoteVAD.isSpeaking}
          bufferedDurationMs={analysis.bufferedDurationMs}
          targetWindowDurationMs={analysis.targetWindowDurationMs}
          analysisStatus={analysis.status}
          lastAnalyzedTimestampMs={analysis.lastAnalyzedTimestampMs}
          analysisWindowNumber={analysis.analysisWindowNumber}
          remoteUserId={activeCall.remoteUser.id}
          wav2vec2Status={analysis.wav2vec2Status}
          wav2vec2Score={analysis.wav2vec2Score}
          callRiskScore={analysis.callRiskScore}
          callRiskLevel={analysis.callRiskLevel}
          conversationalSignals={analysis.conversationalSignals}
          voiceIntegrityScore={analysis.voiceIntegrityScore}
        />
      )}

      {/* Call Controls */}
      <div className="call-controls-row-minimal" role="toolbar" aria-label="Call controls">
        {callState === "CONNECTED" && (
          <>
            <button
              className={`btn-call-action-minimal btn-call-mute ${isMuted ? "muted" : ""}`}
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? "Unmute" : localVAD.isSpeaking ? "Speaking..." : "Mute"}
            </button>

            <button
              className="btn-call-action-minimal btn-call-mute"
              onClick={toggleSpeaker}
              aria-label={speakerEnabled ? "Speaker On" : "Speaker Off"}
            >
              {speakerEnabled ? "Speaker On" : "Speaker Off"}
            </button>
          </>
        )}

        {canEndOrCancel && (
          <button
            className="btn-call-action-minimal btn-call-end"
            onClick={onEndCall}
            aria-label="End call"
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
