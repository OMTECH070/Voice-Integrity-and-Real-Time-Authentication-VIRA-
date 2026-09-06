/**
 * Voice-liveness ("is this voice AI-generated?") types.
 *
 * Scope reminder, same spirit as the client-side VAD: this module answers
 * one question — "how likely is this speech to be synthetic/spoofed
 * rather than a live human voice?" — for whatever audio it's given. It
 * does NOT do voice activity detection (that already happened upstream,
 * see client/src/audio/vad/), does not transcribe anything (that's
 * Whisper's job, and it isn't part of this feature at all — see the
 * README), and does not know or care about billing/entitlements. Where
 * this module sits in your call pipeline, and whether it's gated behind
 * a subscription, is a decision for the layer that calls it, not for
 * this module itself.
 */

/** One ~2-3 second window of speech-only PCM, ready for the model. */
export interface AudioChunk {
  /** Mono PCM, resampled to the model's expected rate (see resample.ts). */
  samples: Float32Array;
  sampleRate: number;
  /** ms since the analyzer started, at the start of this chunk. */
  startMs: number;
  /** ms since the analyzer started, at the end of this chunk. */
  endMs: number;
}

/** Result of running one chunk through the model backend. */
export interface VoiceLivenessResult {
  /** 0 = confidently human/live, 1 = confidently synthetic/spoofed.
   * Deliberately a continuous score, not a boolean — callers decide their
   * own threshold and how to present it (e.g. "likely AI" above 0.7). */
  spoofScore: number;
  /** Convenience label derived from spoofScore at the backend's own
   * default threshold. Callers who want a different threshold should use
   * spoofScore directly rather than relying on this. */
  label: "live" | "likely-synthetic" | "uncertain";
  /** Speaker embedding for this chunk (ECAPA-TDNN output), if the backend
   * computed one. Not required for the spoof decision itself, but useful
   * downstream (e.g. "is this the same voice as 30 seconds ago"). */
  embedding: Float32Array | null;
  /** ms since the analyzer started, matching the AudioChunk this came
   * from — lets callers correlate a score with a point in the call. */
  atMs: number;
  /** How long inference actually took, for latency monitoring. */
  inferenceMs: number;
  /** Raw output tensor shape from ONNX Runtime (e.g. [1, 1] or [1, 2]). */
  rawOutputShape?: number[];
  /** Raw output values directly produced by model before final classification. */
  rawOutputValues?: number[];
}

/**
 * Pluggable inference backend. The analyzer (VoiceLivenessAnalyzer) never
 * talks to ONNX Runtime, a model file, or a GPU directly — it only calls
 * this interface, the same way vadCore never talked to AudioWorklet
 * directly. That keeps the decision logic testable with a fake backend
 * and swappable between environments (Node/onnxruntime-node on the
 * server, or onnxruntime-web in the browser) without touching the core.
 */
export interface VoiceLivenessBackend {
  /** Sample rate this backend's models expect. The analyzer resamples
   * every chunk to this rate before calling analyze(). */
  readonly requiredSampleRate: number;
  /** Runs one chunk through the model(s) and returns a result. Backends
   * that aren't configured yet (no model files present) should reject
   * with a clear error rather than silently returning a fake score. */
  analyze(chunk: AudioChunk): Promise<VoiceLivenessResult>;
}

export interface VoiceLivenessConfig {
  /** Target chunk duration, in ms, before a window is sent to the
   * backend. Real anti-spoof/speaker models need a few seconds of audio
   * to be reliable — this is not a per-VAD-frame (20ms) setting. */
  chunkDurationMs?: number;
  /** spoofScore threshold above which the default `label` becomes
   * "likely-synthetic". Below (threshold - uncertaintyBand) is "live";
   * the band between is "uncertain". */
  spoofThreshold?: number;
  /** Half-width of the "uncertain" band around spoofThreshold. */
  uncertaintyBand?: number;
}

export interface VoiceLivenessEvents {
  /** Fired once per completed chunk analysis — the live, real-time score
   * consumers wire up to a UI badge or a socket emit. */
  onResult?: (result: VoiceLivenessResult) => void;
  /** Fired if the backend throws (e.g. model not configured, or a
   * runtime inference error). The analyzer keeps running afterward — one
   * bad chunk shouldn't kill the whole call's analysis. */
  onError?: (error: Error) => void;
}
