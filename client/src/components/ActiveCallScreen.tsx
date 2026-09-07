import { useEffect, useRef, useState } from "react";
import { ActiveCallInfo, CallState } from "../types/call";
import { formatDuration, useCallTimer } from "../hooks/useCallTimer";
import { useCallVAD } from "../hooks/useCallVAD";
import { useVoiceAnalysis } from "../hooks/useVoiceAnalysis";
import { VoiceIntegrityBadge } from "./VoiceIntegrityBadge";
import { SecurityIndicator, SecurityState } from "./SecurityIndicator";
import { useEasyMode } from "../context/EasyModeContext";
import { EasyModeCallScreen } from "./EasyModeCallScreen";
import { useCallRecording } from "../hooks/useCallRecording";
import { WhyFlaggedModal } from "./WhyFlaggedModal";
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
  const [showWhyFlagged, setShowWhyFlagged] = useState(false);

  // On-device call recording and safety actions
  const recording = useCallRecording({
    callId: activeCall.callId,
    localStream,
    remoteStream,
  });

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
      audioRef.current.play().catch((err) => {
        console.warn("[VIRA][AUDIO] Remote audio autoplay error:", err);
      });
    }
  }, [remoteStream]);

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
          isRecording={recording.isRecording}
          recordingUrl={recording.recordingUrl}
          isPlaying={recording.isPlaying}
          statusMessage={recording.statusMessage}
          isReported={recording.isReported}
          onStartRecording={recording.startRecording}
          onStopRecording={recording.stopRecording}
          onTogglePlayPause={recording.togglePlayPause}
          onDownloadRecording={recording.downloadRecording}
          onReportScamCall={recording.reportScamCall}
          onOpenWhyFlagged={() => setShowWhyFlagged(true)}
          isRecordingSupported={recording.isSupported}
        />
        <WhyFlaggedModal
          isOpen={showWhyFlagged}
          onClose={() => setShowWhyFlagged(false)}
          callRiskScore={analysis.callRiskScore}
          callRiskLevel={analysis.callRiskLevel}
          integrityStatus={analysis.integrityStatus}
          voiceIntegrityScore={analysis.voiceIntegrityScore}
          speakerMatchLabel={analysis.speakerMatchLabel}
          speakerSimilarity={analysis.speakerSimilarity}
          spoofScore={analysis.spoofScore}
          rawLabel={analysis.rawLabel}
          conversationalSignals={analysis.conversationalSignals}
          reason={analysis.reason}
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
          <button
            className={`btn-call-action-minimal btn-call-mute ${isMuted ? "muted" : ""}`}
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? "Unmute" : localVAD.isSpeaking ? "Speaking..." : "Mute"}
          </button>
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

      {/* Call Recording & Safety Actions Toolbar */}
      <div className="call-safety-actions-toolbar" role="toolbar" aria-label="Call safety actions">
        {/* 1. Record / Stop button */}
        <button
          type="button"
          className={`btn-call-safety btn-call-record ${recording.isRecording ? "is-recording" : ""}`}
          onClick={recording.isRecording ? recording.stopRecording : recording.startRecording}
          disabled={!recording.isSupported || (callState !== "CONNECTED" && !recording.isRecording)}
          aria-label={recording.isRecording ? "Stop recording call" : "Record call"}
        >
          {recording.isRecording ? "⏹ Stop Recording" : "⏺ Record"}
        </button>

        {/* 2. Playback button */}
        <button
          type="button"
          className="btn-call-safety"
          onClick={recording.togglePlayPause}
          disabled={!recording.recordingUrl}
          aria-label={recording.isPlaying ? "Pause playback" : "Play recording"}
        >
          {recording.isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* 3. Download button */}
        <button
          type="button"
          className="btn-call-safety"
          onClick={recording.downloadRecording}
          disabled={!recording.recordingUrl}
          aria-label="Download recording"
        >
          ⤓ Download
        </button>

        {/* 4. Report Scam Call button */}
        <button
          type="button"
          className={`btn-call-safety btn-call-report ${recording.isReported ? "is-reported" : ""}`}
          onClick={recording.reportScamCall}
          aria-label="Report scam call"
        >
          {recording.isReported ? "✓ Reported" : "🚨 Report Scam Call"}
        </button>

        {/* 5. Explain Why VIRA Flagged It button */}
        <button
          type="button"
          className="btn-call-safety"
          onClick={() => setShowWhyFlagged(true)}
          aria-label="Explain why VIRA flagged it"
        >
          ℹ️ Why VIRA Flagged It
        </button>

        {/* Status messages */}
        {recording.isRecording && (
          <div className="call-recording-status-msg recording" role="status">
            Recording...
          </div>
        )}
        {!recording.isRecording && recording.statusMessage && (
          <div className="call-recording-status-msg saved" role="status">
            {recording.statusMessage}
          </div>
        )}
        {recording.isReported && (
          <div className="call-recording-status-msg reported" role="status">
            Call reported as suspicious.
          </div>
        )}
      </div>

      <WhyFlaggedModal
        isOpen={showWhyFlagged}
        onClose={() => setShowWhyFlagged(false)}
        callRiskScore={analysis.callRiskScore}
        callRiskLevel={analysis.callRiskLevel}
        integrityStatus={analysis.integrityStatus}
        voiceIntegrityScore={analysis.voiceIntegrityScore}
        speakerMatchLabel={analysis.speakerMatchLabel}
        speakerSimilarity={analysis.speakerSimilarity}
        spoofScore={analysis.spoofScore}
        rawLabel={analysis.rawLabel}
        conversationalSignals={analysis.conversationalSignals}
        reason={analysis.reason}
      />
    </div>
  );
}
