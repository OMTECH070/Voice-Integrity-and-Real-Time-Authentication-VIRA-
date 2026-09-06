import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceActivityDetector, VADState } from "./VoiceActivityDetector";
import type { SpeechSegment, VADAudioFrame, VADConfig, VADFrameResult, VADSpeechSegment } from "./types";

export interface UseVoiceActivityDetectorResult {
  state: VADState;
  /** Smoothed speaking flag — mirrors the segment start/end events. */
  isSpeaking: boolean;
  /** Most recent per-frame classification, for live meters/visualizers. */
  lastFrame: VADFrameResult | null;
  /** Completed speech segments observed so far this session. Each one
   * carries its full speech-only audio (segment.audio / sampleRate) once
   * assembled — silence around it was already excluded upstream. */
  segments: VADSpeechSegment[];
  /** Attach to a live MediaStream (e.g. the local mic stream from
   * useWebRTC's acquireLocalAudio or the remote stream from ontrack) and begin classifying it. */
  start: (stream: MediaStream) => Promise<void>;
  /** Stop classifying and release audio resources. Does not stop the
   * MediaStream itself. */
  stop: () => Promise<void>;
  /** Current VAD engine diagnostic status. */
  diagnosticStatus: import("./types").VadDiagnosticStatus;
}

/**
 * React wrapper around VoiceActivityDetector. Purely audio-classification
 * state — no call signaling, auth, or session concerns live here. Intended
 * to be composed alongside useWebRTC/useCallManager once the VAD is wired
 * into the live call pipeline; it does not touch either today.
 *
 * `onSpeechAudioFrame` is an optional real-time sink for gated speech-only
 * PCM (e.g. piping straight into a live ECAPA/Whisper streaming socket).
 *
 * `onSpeechSegment` is the standard callback for completed speech-only PCM
 * segments (Float32Array audio + sampleRate + duration) ready for downstream
 * ML processing (ECAPA-TDNN / AASIST anti-spoofing).
 */
export function useVoiceActivityDetector(
  config: Omit<VADConfig, "sampleRate"> = {},
  onSpeechAudioFrame?: (frame: VADAudioFrame) => void,
  onSpeechSegment?: (segment: SpeechSegment) => void
): UseVoiceActivityDetectorResult {
  const [state, setState] = useState<VADState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastFrame, setLastFrame] = useState<VADFrameResult | null>(null);
  const [segments, setSegments] = useState<VADSpeechSegment[]>([]);
  const [diagnosticStatus, setDiagnosticStatus] = useState<import("./types").VadDiagnosticStatus>({
    vadEngine: "fallback-rms-zcr",
    modelLoaded: false,
    modelVersion: "Silero-VAD-v5",
    inferenceAvailable: false,
    error: null,
  });
  const detectorRef = useRef<VoiceActivityDetector | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const onSpeechAudioFrameRef = useRef(onSpeechAudioFrame);
  onSpeechAudioFrameRef.current = onSpeechAudioFrame;
  const onSpeechSegmentRef = useRef(onSpeechSegment);
  onSpeechSegmentRef.current = onSpeechSegment;

  const start = useCallback(async (stream: MediaStream) => {
    // If an existing detector was already attached, stop and clean it up first
    if (detectorRef.current) {
      await detectorRef.current.stop();
      detectorRef.current = null;
    }

    const detector = new VoiceActivityDetector(configRef.current, {
      onFrame: (result) => setLastFrame(result),
      onSpeechStart: () => setIsSpeaking(true),
      onSpeechAudioFrame: (frame) => onSpeechAudioFrameRef.current?.(frame),
      onSpeechEnd: (segment) => {
        setIsSpeaking(false);
        setSegments((prev) => [...prev, segment]);
      },
      onSpeechSegment: (segment) => {
        onSpeechSegmentRef.current?.(segment);
      },
      onError: () => setState("error"),
    });

    detectorRef.current = detector;
    await detector.start(stream);
    setState(detector.getState());
    setDiagnosticStatus(detector.getVadDiagnosticStatus());
  }, []);

  const stop = useCallback(async () => {
    if (detectorRef.current) {
      await detectorRef.current.stop();
      detectorRef.current = null;
    }
    setState("idle");
    setIsSpeaking(false);
    setLastFrame(null);
  }, []);

  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
      detectorRef.current = null;
    };
  }, []);

  return { state, isSpeaking, lastFrame, segments, start, stop, diagnosticStatus };
}
