import { useEffect, useRef, useState } from "react";
import { RollingSpeechBuffer } from "../audio/analysis/RollingSpeechBuffer";
import type { VADAudioFrame } from "../audio/vad/types";
import { getSocket } from "../services/socket";
import type { FusedIntegrityStatus, VoiceAnalysisResultPayload } from "../types/socket-events";

export type AnalysisStatus = "idle" | "buffering" | "window-ready" | "sent";
export type VoiceIntegrityStatus = FusedIntegrityStatus;

export interface UseVoiceAnalysisOptions {
  callId: string | null;
  enabled?: boolean;
  targetWindowDurationMs?: number;
  hopDurationMs?: number;
}

export interface UseVoiceAnalysisResult {
  status: AnalysisStatus;
  bufferedDurationMs: number;
  targetWindowDurationMs: number;
  lastSentSequenceNumber: number | null;
  lastLatencyMs: number | null;
  /** Latest raw AASIST spoof score (0.0 = live human, 1.0 = synthetic spoof). */
  spoofScore: number | null;
  /** Latest raw label from the model. */
  rawLabel: "live" | "likely-synthetic" | "uncertain" | null;
  /** Fused, temporally smoothed voice integrity status for UI display. */
  integrityStatus: VoiceIntegrityStatus;
  /** Confidence metric of the fused assessment (0.0 - 1.0). */
  confidence: number | null;
  /** Human-readable explanation of the current decision. */
  reason: string | null;
  /** Whether the current status reflects temporal smoothing across recent windows. */
  isSmoothed: boolean | null;
  /** Calibration version tag. */
  calibrationVersion: string | null;
  /** ECAPA speaker verification similarity [-1.0, 1.0]. */
  speakerSimilarity: number | null;
  /** ECAPA speaker match flag. */
  speakerMatch: boolean | null;
  /** ECAPA speaker match label. */
  speakerMatchLabel: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | null;
  /** Timestamp in ms when the latest analysis result arrived. */
  lastAnalyzedTimestampMs: number | null;
  /** Sequence number of the latest analyzed speech window. */
  analysisWindowNumber: number | null;
  /** Wav2Vec2 anti-spoof model status. */
  wav2vec2Status?: "READY" | "NOT_READY" | "ERROR" | null;
  /** Wav2Vec2 anti-spoof score. */
  wav2vec2Score?: number | null;
  /** Call threat / social engineering risk score (0-100). */
  callRiskScore?: number | null;
  /** Call risk severity level. */
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  /** Detected conversational risk signals. */
  conversationalSignals?: string[];
  /** Decoupled voice integrity biometric score (0-100). */
  voiceIntegrityScore?: number | null;
  handleRemoteSpeechFrame: (frame: VADAudioFrame) => void;
  handleLocalSpeechFrame: (frame: VADAudioFrame) => void;
  reset: () => void;
}

/**
 * Connects speech-only PCM frames from the VAD pipeline to a rolling analysis
 * buffer and transmits 2–4 second windows to the backend for ML processing.
 */
export function useVoiceAnalysis({
  callId,
  enabled = true,
  targetWindowDurationMs = 3000,
  hopDurationMs = 1500,
}: UseVoiceAnalysisOptions): UseVoiceAnalysisResult {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [bufferedDurationMs, setBufferedDurationMs] = useState(0);
  const [lastSentSequenceNumber, setLastSentSequenceNumber] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [spoofScore, setSpoofScore] = useState<number | null>(null);
  const [rawLabel, setRawLabel] = useState<"live" | "likely-synthetic" | "uncertain" | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<VoiceIntegrityStatus>("analyzing");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [isSmoothed, setIsSmoothed] = useState<boolean | null>(null);
  const [calibrationVersion, setCalibrationVersion] = useState<string | null>(null);
  const [speakerSimilarity, setSpeakerSimilarity] = useState<number | null>(null);
  const [speakerMatch, setSpeakerMatch] = useState<boolean | null>(null);
  const [speakerMatchLabel, setSpeakerMatchLabel] = useState<"match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | null>(null);
  const [wav2vec2Status, setWav2vec2Status] = useState<"READY" | "NOT_READY" | "ERROR" | null>(null);
  const [wav2vec2Score, setWav2vec2Score] = useState<number | null>(null);
  const [callRiskScore, setCallRiskScore] = useState<number | null>(null);
  const [callRiskLevel, setCallRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | null>(null);
  const [conversationalSignals, setConversationalSignals] = useState<string[]>([]);
  const [voiceIntegrityScore, setVoiceIntegrityScore] = useState<number | null>(null);

  const scoreHistoryRef = useRef<Array<{ spoofScore: number; label: "live" | "likely-synthetic" | "uncertain" }>>([]);

  const remoteBufferRef = useRef<RollingSpeechBuffer>(
    new RollingSpeechBuffer({ targetWindowDurationMs, hopDurationMs })
  );
  const localBufferRef = useRef<RollingSpeechBuffer>(
    new RollingSpeechBuffer({ targetWindowDurationMs, hopDurationMs })
  );

  const [lastAnalyzedTimestampMs, setLastAnalyzedTimestampMs] = useState<number | null>(null);
  const [analysisWindowNumber, setAnalysisWindowNumber] = useState<number | null>(null);

  // Listen for analysis results from the server
  useEffect(() => {
    if (!callId || !enabled) return;

    const socket = getSocket();

    const handleResult = (result: VoiceAnalysisResultPayload) => {
      if (result.callId !== callId) return;

      console.log(
        `[VIRA][CLIENT] RECEIVED voice:analysis-result window=${result.sequenceNumber ?? 0} ` +
          `spoofScore=${result.spoofScore !== undefined ? result.spoofScore.toFixed(4) : "N/A"} ` +
          `classification=${result.integrityStatus ?? "analyzing"}`
      );

      if (result.processingLatencyMs !== undefined) {
        setLastLatencyMs(result.processingLatencyMs);
      }

      if (
        result.speakerDirection === "remote" &&
        (result.status === "analyzed" || result.status === "unavailable" || result.status === "error")
      ) {
        setLastAnalyzedTimestampMs(Date.now());
        if (result.sequenceNumber !== undefined) {
          setAnalysisWindowNumber(result.sequenceNumber);
        }

        if (result.spoofScore !== undefined) {
          console.log(
            `[VIRA][CLIENT] React state updated: spoofScore=${result.spoofScore} (${Math.round(result.spoofScore * 100)}%), rawLabel=${result.label}`
          );
          setSpoofScore(result.spoofScore);
          setRawLabel(result.label ?? "uncertain");
        }

        // Speaker verification telemetry
        if (result.speakerSimilarity !== undefined) {
          setSpeakerSimilarity(result.speakerSimilarity);
          setSpeakerMatch(result.speakerMatch ?? false);
          setSpeakerMatchLabel(result.speakerMatchLabel ?? "uncertain");
        } else if (result.speakerMatchLabel) {
          setSpeakerMatchLabel(result.speakerMatchLabel);
        }

        // Wav2Vec2 telemetry
        if (result.wav2vec2Status !== undefined) {
          setWav2vec2Status(result.wav2vec2Status);
        }
        if (result.wav2vec2Score !== undefined) {
          setWav2vec2Score(result.wav2vec2Score);
        }

        // Conversational Risk & XGBoost telemetry
        if (result.callRiskScore !== undefined) {
          setCallRiskScore(result.callRiskScore);
        }
        if (result.callRiskLevel !== undefined) {
          setCallRiskLevel(result.callRiskLevel);
        }
        if (result.conversationalSignals !== undefined) {
          setConversationalSignals(result.conversationalSignals);
        }
        if (result.voiceIntegrityScore !== undefined) {
          setVoiceIntegrityScore(result.voiceIntegrityScore);
        }

        console.log(
          `[VIRA][UI] window=${result.sequenceNumber ?? 0} ` +
            `speakerSimilarity=${result.speakerSimilarity !== undefined ? (result.speakerSimilarity * 100).toFixed(1) + "%" : "N/A"} ` +
            `speakerMatch=${result.speakerMatch !== undefined ? (result.speakerMatch ? "MATCH" : "NO MATCH") : (result.speakerMatchLabel ?? "N/A")}`
        );

        // Fused voice integrity assessment
        if (result.integrityStatus !== undefined) {
          setIntegrityStatus(result.integrityStatus);
        }
        if (result.confidence !== undefined) {
          setConfidence(result.confidence);
        }
        if (result.reason !== undefined) {
          setReason(result.reason);
        }
        if (result.isSmoothed !== undefined) {
          setIsSmoothed(result.isSmoothed);
        }
        if (result.calibrationVersion !== undefined) {
          setCalibrationVersion(result.calibrationVersion);
        }
      }
    };

    socket.on("voice:analysis-result", handleResult);

    return () => {
      socket.off("voice:analysis-result", handleResult);
    };
  }, [callId, enabled]);

  // Reset buffers when callId changes
  useEffect(() => {
    remoteBufferRef.current.reset();
    localBufferRef.current.reset();
    scoreHistoryRef.current = [];
    setStatus("idle");
    setBufferedDurationMs(0);
    setLastSentSequenceNumber(null);
    setLastLatencyMs(null);
    setSpoofScore(null);
    setRawLabel(null);
    setIntegrityStatus("analyzing");
    setSpeakerSimilarity(null);
    setSpeakerMatch(null);
    setSpeakerMatchLabel(null);
  }, [callId]);

  const handleRemoteSpeechFrame = (frame: VADAudioFrame) => {
    if (!callId || !enabled) return;

    const windows = remoteBufferRef.current.push(frame);
    const currentBufferedMs = remoteBufferRef.current.getBufferedDurationMs();
    setBufferedDurationMs(currentBufferedMs);

    if (windows.length > 0) {
      setStatus("window-ready");
      const socket = getSocket();

      for (const window of windows) {
        console.log(
          `[VIRA][CLIENT] SEND voice:analysis-chunk window=${window.sequenceNumber} ` +
            `samples=${window.pcm.length} duration=${window.durationMs}ms`
        );

        // Transmit binary ArrayBuffer slice directly over WebSocket
        socket.emit("voice:analysis-chunk", {
          callId,
          speakerDirection: "remote",
          sampleRate: window.sampleRate,
          sequenceNumber: window.sequenceNumber,
          timestampMs: window.startMs,
          durationMs: window.durationMs,
          pcm: window.pcm.buffer.slice(
            window.pcm.byteOffset,
            window.pcm.byteOffset + window.pcm.byteLength
          ),
        });

        setLastSentSequenceNumber(window.sequenceNumber);
        setStatus("sent");
      }
    } else if (currentBufferedMs > 0 && status === "idle") {
      setStatus("buffering");
    }
  };

  const handleLocalSpeechFrame = (frame: VADAudioFrame) => {
    if (!callId || !enabled) return;
    localBufferRef.current.push(frame);
  };

  const reset = () => {
    remoteBufferRef.current.reset();
    localBufferRef.current.reset();
    scoreHistoryRef.current = [];
    setStatus("idle");
    setBufferedDurationMs(0);
    setLastSentSequenceNumber(null);
    setLastLatencyMs(null);
    setSpoofScore(null);
    setRawLabel(null);
    setIntegrityStatus("analyzing");
    setConfidence(null);
    setReason(null);
    setIsSmoothed(null);
    setCalibrationVersion(null);
    setSpeakerSimilarity(null);
    setSpeakerMatch(null);
    setSpeakerMatchLabel(null);
    setWav2vec2Status(null);
    setWav2vec2Score(null);
    setCallRiskScore(null);
    setCallRiskLevel(null);
    setConversationalSignals([]);
    setVoiceIntegrityScore(null);
    setLastAnalyzedTimestampMs(null);
    setAnalysisWindowNumber(null);
  };

  return {
    status,
    bufferedDurationMs,
    targetWindowDurationMs,
    lastSentSequenceNumber,
    lastLatencyMs,
    lastAnalyzedTimestampMs,
    analysisWindowNumber,
    spoofScore,
    rawLabel,
    integrityStatus,
    confidence,
    reason,
    isSmoothed,
    calibrationVersion,
    speakerSimilarity,
    speakerMatch,
    speakerMatchLabel,
    wav2vec2Status,
    wav2vec2Score,
    callRiskScore,
    callRiskLevel,
    conversationalSignals,
    voiceIntegrityScore,
    handleRemoteSpeechFrame,
    handleLocalSpeechFrame,
    reset,
  };
}
