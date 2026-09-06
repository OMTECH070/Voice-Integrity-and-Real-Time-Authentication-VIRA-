import { useEffect, useRef, useState } from "react";
import { VoiceActivityDetector, VADState } from "../audio/vad/VoiceActivityDetector";
import type {
  SpeechSegment,
  VADAudioFrame,
  VADFrameResult,
} from "../audio/vad/types";

export interface UseCallVADOptions {
  /** Local microphone MediaStream from acquireLocalAudio. */
  localStream?: MediaStream | null;
  /** Remote incoming caller MediaStream from RTCPeerConnection ontrack. */
  remoteStream?: MediaStream | null;
  /** Whether local microphone is currently muted. */
  isLocalMuted?: boolean;
  /** Callback for completed speech-only PCM segments from the REMOTE caller.
   * This is the primary input interface for future ML pipelines (ECAPA / AASIST). */
  onRemoteSpeechSegment?: (segment: SpeechSegment) => void;
  /** Real-time per-frame speech chunk callback for REMOTE stream. */
  onRemoteSpeechFrame?: (frame: VADAudioFrame) => void;
  /** Callback for completed speech-only PCM segments from the LOCAL mic. */
  onLocalSpeechSegment?: (segment: SpeechSegment) => void;
  /** Real-time per-frame speech chunk callback for LOCAL stream. */
  onLocalSpeechFrame?: (frame: VADAudioFrame) => void;
}

export interface StreamVADStatus {
  isSpeaking: boolean;
  lastFrame: VADFrameResult | null;
  state: VADState;
}

export interface UseCallVADResult {
  localVAD: StreamVADStatus;
  remoteVAD: StreamVADStatus;
  hasRemoteStream: boolean;
}

const INITIAL_STATUS: StreamVADStatus = {
  isSpeaking: false,
  lastFrame: null,
  state: "idle",
};

/**
 * Manages non-intrusive Voice Activity Detection on active call streams
 * (both local mic and remote caller).
 *
 * Guarantees:
 * 1. WebRTC audio and `<audio>` element playback remain completely untouched.
 * 2. Only ONE AudioContext / worklet node is created per active stream.
 * 3. Immediate cleanup when a stream ends, changes, or component unmounts.
 * 4. Structured SpeechSegment callback emission for downstream ML processing.
 */
export function useCallVAD({
  localStream,
  remoteStream,
  isLocalMuted = false,
  onRemoteSpeechSegment,
  onRemoteSpeechFrame,
  onLocalSpeechSegment,
  onLocalSpeechFrame,
}: UseCallVADOptions): UseCallVADResult {
  const [localStatus, setLocalStatus] = useState<StreamVADStatus>(INITIAL_STATUS);
  const [remoteStatus, setRemoteStatus] = useState<StreamVADStatus>(INITIAL_STATUS);

  const localDetectorRef = useRef<VoiceActivityDetector | null>(null);
  const remoteDetectorRef = useRef<VoiceActivityDetector | null>(null);

  // Keep callback references fresh without triggering effect re-runs
  const onRemoteSpeechSegmentRef = useRef(onRemoteSpeechSegment);
  onRemoteSpeechSegmentRef.current = onRemoteSpeechSegment;
  const onRemoteSpeechFrameRef = useRef(onRemoteSpeechFrame);
  onRemoteSpeechFrameRef.current = onRemoteSpeechFrame;
  const onLocalSpeechSegmentRef = useRef(onLocalSpeechSegment);
  onLocalSpeechSegmentRef.current = onLocalSpeechSegment;
  const onLocalSpeechFrameRef = useRef(onLocalSpeechFrame);
  onLocalSpeechFrameRef.current = onLocalSpeechFrame;

  // ---------- Local Microphone VAD Lifecycle ----------
  useEffect(() => {
    let cancelled = false;

    async function setupLocalVAD(stream: MediaStream) {
      if (localDetectorRef.current) {
        await localDetectorRef.current.stop();
        localDetectorRef.current = null;
      }

      if (cancelled) return;

      const detector = new VoiceActivityDetector(
        {},
        {
          onFrame: (result) => {
            if (!cancelled) {
              setLocalStatus((prev) => ({ ...prev, lastFrame: result }));
            }
          },
          onSpeechStart: () => {
            if (!cancelled) {
              setLocalStatus((prev) => ({ ...prev, isSpeaking: true }));
            }
          },
          onSpeechAudioFrame: (frame) => {
            if (!cancelled && !isLocalMuted) {
              onLocalSpeechFrameRef.current?.(frame);
            }
          },
          onSpeechEnd: () => {
            if (!cancelled) {
              setLocalStatus((prev) => ({ ...prev, isSpeaking: false }));
            }
          },
          onSpeechSegment: (segment) => {
            if (!cancelled && !isLocalMuted) {
              onLocalSpeechSegmentRef.current?.(segment);
            }
          },
          onError: () => {
            if (!cancelled) {
              setLocalStatus((prev) => ({ ...prev, state: "error" }));
            }
          },
        }
      );

      localDetectorRef.current = detector;

      try {
        await detector.start(stream);
        console.log(`[VIRA][VAD] Local microphone VAD detector started successfully (${stream.getAudioTracks().length} tracks)`);
        if (!cancelled) {
          setLocalStatus((prev) => ({ ...prev, state: detector.getState() }));
        }
      } catch (err) {
        console.error(`[VIRA][VAD] Local microphone VAD start failed: ${err}`);
        if (!cancelled) {
          setLocalStatus((prev) => ({ ...prev, state: "error" }));
        }
      }
    }

    if (localStream && localStream.getAudioTracks().length > 0) {
      setupLocalVAD(localStream);
    } else {
      if (localDetectorRef.current) {
        localDetectorRef.current.stop();
        localDetectorRef.current = null;
      }
      setLocalStatus(INITIAL_STATUS);
    }

    return () => {
      cancelled = true;
      if (localDetectorRef.current) {
        localDetectorRef.current.stop();
        localDetectorRef.current = null;
      }
      setLocalStatus(INITIAL_STATUS);
    };
  }, [localStream, isLocalMuted]);

  // ---------- Remote Caller Stream VAD Lifecycle ----------
  useEffect(() => {
    let cancelled = false;

    async function setupRemoteVAD(stream: MediaStream) {
      if (remoteDetectorRef.current) {
        await remoteDetectorRef.current.stop();
        remoteDetectorRef.current = null;
      }

      if (cancelled) return;

      const detector = new VoiceActivityDetector(
        {},
        {
          onFrame: (result) => {
            if (!cancelled) {
              setRemoteStatus((prev) => ({ ...prev, lastFrame: result }));
            }
          },
          onSpeechStart: () => {
            if (!cancelled) {
              setRemoteStatus((prev) => ({ ...prev, isSpeaking: true }));
            }
          },
          onSpeechAudioFrame: (frame) => {
            if (!cancelled) {
              onRemoteSpeechFrameRef.current?.(frame);
            }
          },
          onSpeechEnd: () => {
            if (!cancelled) {
              setRemoteStatus((prev) => ({ ...prev, isSpeaking: false }));
            }
          },
          onSpeechSegment: (segment) => {
            if (!cancelled) {
              onRemoteSpeechSegmentRef.current?.(segment);
            }
          },
          onError: () => {
            if (!cancelled) {
              setRemoteStatus((prev) => ({ ...prev, state: "error" }));
            }
          },
        }
      );

      remoteDetectorRef.current = detector;

      try {
        await detector.start(stream);
        console.log(`[VIRA][VAD] Remote caller VAD detector attached and running (${stream.getAudioTracks().length} track(s))`);
        if (!cancelled) {
          setRemoteStatus((prev) => ({ ...prev, state: detector.getState() }));
        }
      } catch (err) {
        console.error(`[VIRA][VAD] Remote caller VAD start failed: ${err}`);
        if (!cancelled) {
          setRemoteStatus((prev) => ({ ...prev, state: "error" }));
        }
      }
    }

    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      console.log(`[VIRA][WEBRTC] Remote audio track active (${remoteStream.getAudioTracks().length} track(s)). Attaching VAD...`);
      setupRemoteVAD(remoteStream);
    } else {
      if (remoteStream && remoteStream.getAudioTracks().length === 0) {
        console.warn(`[VIRA][WEBRTC] ERROR: No remote audio track`);
      } else {
        console.log(`[VIRA][VAD] WAITING: No remote speech detected`);
      }
      if (remoteDetectorRef.current) {
        remoteDetectorRef.current.stop();
        remoteDetectorRef.current = null;
      }
      setRemoteStatus(INITIAL_STATUS);
    }

    return () => {
      cancelled = true;
      if (remoteDetectorRef.current) {
        remoteDetectorRef.current.stop();
        remoteDetectorRef.current = null;
      }
      setRemoteStatus(INITIAL_STATUS);
    };
  }, [remoteStream]);

  return {
    localVAD: localStatus,
    remoteVAD: remoteStatus,
    hasRemoteStream: !!remoteStream && remoteStream.getAudioTracks().length > 0,
  };
}
