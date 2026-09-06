/**
 * Voice Activity Detection (VAD) types.
 *
 * Scope reminder: this module answers exactly one question — "is this
 * section of audio speech or not?". It does NOT identify who is speaking,
 * verify a voice, detect cloning/spoofing, or transcribe anything. Those
 * are separate systems that will sit downstream of the VAD in VIRA's
 * future pipeline (see project root instructions).
 */

/** Per-frame classification. Non-speech covers both silence and noise. */
export type VADLabel = "speech" | "silence";

export interface VADConfig {
  /**
   * Sample rate (Hz) of the audio actually being analyzed. Must match the
   * AudioContext's real sampleRate — VoiceActivityDetector fills this in
   * automatically once the context exists, so callers normally omit it.
   */
  sampleRate: number;

  /** Analysis frame size, in milliseconds. Default 20ms — long enough for
   * a stable energy estimate, short enough for responsive start/end
   * detection. */
  frameDurationMs?: number;

  /** Fixed energy floor (dBFS) used when noise adaptation is disabled, and
   * as the initial floor when it's enabled. Default -50. */
  energyThresholdDb?: number;

  /** When true (default), the noise floor slowly tracks the energy of
   * frames classified as non-speech, so the effective threshold adapts to
   * ambient room noise instead of a single fixed value. */
  noiseAdaptationEnabled?: boolean;

  /** How many dB above the (adaptive or fixed) noise floor a frame's
   * energy must be to be considered speech-like. Default 12. */
  noiseMarginDb?: number;

  /** Consecutive speech-like frames required before declaring the start of
   * a speech segment. Filters out brief transient noise. Default 3. */
  minSpeechFrames?: number;

  /** Consecutive non-speech-like frames required before declaring a speech
   * segment ended. Prevents choppy cutoffs during brief pauses within a
   * sentence. Default 8. */
  hangoverFrames?: number;

  /** Lower bound of zero-crossing rate (crossings per sample, 0–1)
   * considered consistent with speech. Default 0.02. */
  zcrSpeechMin?: number;

  /** Upper bound of zero-crossing rate considered consistent with speech.
   * Filters out very high-ZCR noise (hiss, static). Default 0.5. */
  zcrSpeechMax?: number;

  /** When true (default: true), attempts to use Silero VAD neural network inference. */
  useSilero?: boolean;

  /** Positive speech threshold for Silero VAD probability (default: 0.50). */
  positiveSpeechThreshold?: number;

  /** Negative speech threshold for Silero VAD probability (default: 0.35). */
  negativeSpeechThreshold?: number;

  /** Custom model path or URL for silero_vad.onnx. */
  modelPath?: string;
}

export interface VadDiagnosticStatus {
  vadEngine: "silero" | "fallback-rms-zcr";
  modelLoaded: boolean;
  modelVersion: string;
  inferenceAvailable: boolean;
  error?: string | null;
}

/** Result of classifying one analysis frame. */
export interface VADFrameResult {
  /** Smoothed label (after hangover/min-frame logic). */
  label: VADLabel;
  /** Frame RMS energy in dBFS. -Infinity for pure digital silence. */
  energyDb: number;
  /** Zero-crossing rate for this frame, 0–1. */
  zcr: number;
  /** Raw per-frame decision before hangover smoothing is applied. */
  isSpeechFrame: boolean;
  /** Milliseconds since this VAD instance started, at the frame boundary. */
  timestampMs: number;
  /** Silero neural speech probability in [0.0, 1.0] when available. */
  sileroProbability?: number;
  /** Active VAD classification engine. */
  vadEngine?: "silero" | "fallback-rms-zcr";
}

/** One contiguous run of speech, as detected by the smoothing state
 * machine. endMs is null while the segment is still in progress. */
export interface VADSpeechSegment {
  startMs: number;
  endMs: number | null;
  /** Concatenated speech-only PCM for this segment, at `sampleRate`. Set
   * once the segment ends (alongside endMs) — never present on the
   * in-progress segment passed to onSpeechStart-adjacent state, since the
   * audio isn't fully assembled until the segment is over. Only silence
   * bordering the segment is excluded; the segment's own brief trailing
   * hangover is included so words aren't clipped — see
   * speechAudioGate.ts. */
  audio?: Float32Array;
  /** Sample rate of `audio`, when present — the AudioContext's native
   * rate (commonly 48000Hz), not necessarily what downstream models
   * (e.g. 16kHz for ECAPA/Whisper) expect. Resampling is a downstream
   * pipeline concern, deliberately not done here. */
  sampleRate?: number;
}

/** One analysis frame's worth of raw speech PCM, handed over in real time
 * as it's classified — for streaming consumers (e.g. a live ECAPA/Whisper
 * socket) that want audio the moment it's gated, not just a per-segment
 * summary. Only ever fired for frames inside a confirmed speech segment;
 * silence is never captured or forwarded (see speechAudioGate.ts). */
export interface VADAudioFrame {
  samples: Float32Array;
  sampleRate: number;
  timestampMs: number;
}

/** Complete speech-only segment produced when an utterance concludes. */
export interface SpeechSegment {
  /** Speech-only audio PCM (Float32Array) with silence removed and leading pre-roll preserved. */
  pcm: Float32Array;
  /** Explicit sample rate in Hz (e.g. 48000 or 16000). */
  sampleRate: number;
  /** Duration of speech in milliseconds. */
  durationMs: number;
  /** Start timestamp in ms relative to the analyzer timeline. */
  startMs: number;
  /** End timestamp in ms relative to the analyzer timeline. */
  endMs: number;
}

export interface VADTimingConfig {
  /** Initial wait time in ms during which silence is tolerated before expecting speech (default: 5000ms). */
  initialWaitMs?: number;
  /** Silence duration in ms to declare utterance complete (default: 800ms). */
  silenceEndMs?: number;
  /** Minimum accumulated speech in ms required for valid utterance (default: 2000ms). */
  minSpeechMs?: number;
  /** Pre-speech audio padding in ms retained to avoid clipping start of words (default: 300ms). */
  prePaddingMs?: number;
  /** Post-speech audio padding in ms retained to avoid clipping trailing phonemes (default: 400ms). */
  postPaddingMs?: number;
  /** Maximum overall wait time in ms before declaring INSUFFICIENT_AUDIO (default: 15000ms). */
  maxWaitMs?: number;
}

export const VAD_TIMING_DEFAULTS = {
  VAD_INITIAL_WAIT_MS: 5000,
  VAD_SILENCE_END_MS: 800,
  VAD_MIN_SPEECH_MS: 2000,
  VAD_PRE_PADDING_MS: 300,
  VAD_POST_PADDING_MS: 400,
  VAD_MAX_WAIT_MS: 15000,
} as const;

export type VADSessionState =
  | "WAITING_FOR_SPEECH"
  | "SPEECH_DETECTED"
  | "COLLECTING_SPEECH"
  | "SPEECH_COMPLETE"
  | "PROCESSING"
  | "INSUFFICIENT_AUDIO";

export type PipelineStage =
  | "VAD"
  | "ECAPA"
  | "AASIST"
  | "WAV2VEC2"
  | "TRANSCRIPTION"
  | "RISK_ANALYSIS"
  | "XGBOOST"
  | "DATABASE";

export type PipelineErrorCode =
  | "WAITING_FOR_SPEECH"
  | "SPEECH_DETECTED"
  | "PROCESSING"
  | "INSUFFICIENT_AUDIO"
  | "VAD_ERROR"
  | "MODEL_ERROR"
  | "TRANSCRIPTION_ERROR"
  | "DATABASE_ERROR"
  | "SPOOF_DETECTED"
  | "SPEAKER_MISMATCH"
  | "UNCERTAIN";

export interface PipelineError {
  stage: PipelineStage;
  code: PipelineErrorCode;
  message: string;
  timestampMs: number;
}

export interface VADEvents {
  /** Fired for every analysis frame — useful for live meters/visualizers.
   * Carries classification metadata only, never raw audio, regardless of
   * label. */
  onFrame?: (result: VADFrameResult) => void;
  /** Fired once when a speech segment begins. */
  onSpeechStart?: (atMs: number) => void;
  /** Fired for every frame of gated (speech-only) audio in real time,
   * while a segment is in progress. Bypasses segment assembly on purpose
   * for low-latency streaming consumers. */
  onSpeechAudioFrame?: (frame: VADAudioFrame) => void;
  /** Fired once when a speech segment ends (with its start/end times, and
   * — unless the segment produced no audio — the assembled speech-only
   * PCM for the whole utterance). */
  onSpeechEnd?: (segment: VADSpeechSegment) => void;
  /** Clean structured callback for completed speech-only PCM segments
   * designed as the input interface for downstream ML pipelines (ECAPA / AASIST). */
  onSpeechSegment?: (segment: SpeechSegment) => void;
  /** Fired whenever the adaptive session state transitions (e.g. WAITING_FOR_SPEECH -> SPEECH_DETECTED). */
  onSessionStateChange?: (state: VADSessionState, detail?: { totalSpeechMs: number; elapsedMs: number }) => void;
  /** Fired on setup/runtime errors (e.g. AudioWorklet failed to load). */
  onError?: (error: Error) => void;
}
