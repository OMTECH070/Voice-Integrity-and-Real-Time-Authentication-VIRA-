/**
 * Real-time speech analysis and windowing types for VIRA.
 */

export interface RollingSpeechBufferConfig {
  /** Target duration of each analysis window in milliseconds. Default 3000ms (3s). */
  targetWindowDurationMs?: number;
  /** Stride / hop duration between successive analysis windows in milliseconds. Default 1500ms (1.5s). */
  hopDurationMs?: number;
  /** Maximum speech duration in milliseconds retained in memory before dropping oldest. Default 10000ms (10s). */
  maxBufferDurationMs?: number;
}

export interface AnalysisWindow {
  /** Speech-only PCM samples (Float32Array). */
  pcm: Float32Array;
  /** Audio sample rate in Hz. */
  sampleRate: number;
  /** Duration of this analysis window in milliseconds. */
  durationMs: number;
  /** Start timestamp of this window in milliseconds relative to session. */
  startMs: number;
  /** End timestamp of this window in milliseconds relative to session. */
  endMs: number;
  /** Monotonically increasing sequence number for this stream. */
  sequenceNumber: number;
}
