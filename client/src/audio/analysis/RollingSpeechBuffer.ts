import { concatFloat32 } from "../vad/pcm";
import type { VADAudioFrame } from "../vad/types";
import type { AnalysisWindow, RollingSpeechBufferConfig } from "./types";

const DEFAULT_TARGET_DURATION_MS = 3000; // 3 seconds
const DEFAULT_HOP_DURATION_MS = 1500; // 1.5 seconds stride (50% overlap)
const DEFAULT_MAX_BUFFER_DURATION_MS = 10000; // 10 seconds max memory bound

/**
 * Accumulates gated speech-only PCM frames and emits sliding analysis windows
 * of fixed duration (e.g., 3 seconds) with a configurable stride (e.g., 1.5 seconds).
 *
 * Design:
 * - Only fed speech-classified frames (never silence).
 * - Enforces memory limits: older frames beyond max capacity are pruned.
 * - Slices independent Float32Array copies for each emitted AnalysisWindow.
 * - Sequence numbers monotonically increment for tracking on the server.
 */
export class RollingSpeechBuffer {
  private readonly targetDurationMs: number;
  private readonly hopDurationMs: number;
  private readonly maxBufferDurationMs: number;

  private chunks: Float32Array[] = [];
  private totalBufferedSamples = 0;
  private sampleRate: number | null = null;
  private sequenceNumber = 0;
  private oldestSampleTimestampMs = 0;

  constructor(config: RollingSpeechBufferConfig = {}) {
    this.targetDurationMs = config.targetWindowDurationMs ?? DEFAULT_TARGET_DURATION_MS;
    this.hopDurationMs = config.hopDurationMs ?? DEFAULT_HOP_DURATION_MS;
    this.maxBufferDurationMs = config.maxBufferDurationMs ?? DEFAULT_MAX_BUFFER_DURATION_MS;

    if (this.hopDurationMs <= 0) {
      throw new Error("RollingSpeechBuffer: hopDurationMs must be greater than 0");
    }
    if (this.targetDurationMs < this.hopDurationMs) {
      throw new Error("RollingSpeechBuffer: targetWindowDurationMs must be >= hopDurationMs");
    }
  }

  /**
   * Push a speech frame into the rolling buffer.
   * Emits zero or more analysis windows if enough speech audio has accumulated.
   */
  push(frame: VADAudioFrame): AnalysisWindow[] {
    return this.pushSamples(frame.samples, frame.sampleRate, frame.timestampMs);
  }

  /**
   * Push raw speech PCM samples directly.
   */
  pushSamples(samples: Float32Array, sampleRate: number, timestampMs: number): AnalysisWindow[] {
    if (samples.length === 0) return [];

    if (this.sampleRate === null) {
      this.sampleRate = sampleRate;
      this.oldestSampleTimestampMs = timestampMs;
    } else if (this.sampleRate !== sampleRate) {
      // If sample rate changed, reset accumulation to avoid mixing rates
      this.reset();
      this.sampleRate = sampleRate;
      this.oldestSampleTimestampMs = timestampMs;
    }

    if (this.chunks.length === 0) {
      this.oldestSampleTimestampMs = timestampMs;
    }

    this.chunks.push(samples);
    this.totalBufferedSamples += samples.length;

    const currentDurationMs = (this.totalBufferedSamples / sampleRate) * 1000;
    const targetSamples = Math.round((this.targetDurationMs * sampleRate) / 1000);
    const hopSamples = Math.round((this.hopDurationMs * sampleRate) / 1000);
    const maxSamples = Math.round((this.maxBufferDurationMs * sampleRate) / 1000);

    const windows: AnalysisWindow[] = [];

    // Produce windows as long as we have at least targetSamples available
    while (this.totalBufferedSamples >= targetSamples) {
      const flattened = concatFloat32(this.chunks);
      const windowPcm = flattened.slice(0, targetSamples);

      const startMs = this.oldestSampleTimestampMs;
      const endMs = startMs + this.targetDurationMs;
      // Calculate acoustic statistics on the emitted window
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < windowPcm.length; i++) {
        const absVal = Math.abs(windowPcm[i]);
        if (absVal > peak) peak = absVal;
        sumSq += windowPcm[i] * windowPcm[i];
      }
      const rms = Math.sqrt(sumSq / (windowPcm.length || 1));
      const isNonZeroSpeech = peak > 1e-4;

      const seq = this.sequenceNumber++;

      console.log(
        `[VIRA][BUFFER] WINDOW_READY window=${seq} duration=${(this.targetDurationMs / 1000).toFixed(1)}s ` +
          `(samples=${windowPcm.length}, sampleRate=${sampleRate}Hz, rms=${rms.toFixed(5)}, peak=${peak.toFixed(4)}, nonZeroSpeech=${isNonZeroSpeech})`
      );
      console.log(`[VIRA][BUFFER] speech duration = ${Math.round(currentDurationMs)} ms`);
      console.log(`[VIRA][BUFFER] analysis window ready #${seq}`);
      console.log(`[VIRA][BUFFER] window start = ${startMs} ms`);
      console.log(`[VIRA][BUFFER] window end = ${endMs} ms`);

      windows.push({
        pcm: windowPcm,
        sampleRate,
        durationMs: this.targetDurationMs,
        startMs,
        endMs,
        sequenceNumber: seq,
      });

      // Advance buffer by hopSamples (retain remaining 1.5s overlapping samples)
      const remainingSamples = flattened.length - hopSamples;
      if (remainingSamples > 0) {
        const remainingPcm = flattened.slice(hopSamples);
        this.chunks = [remainingPcm];
        this.totalBufferedSamples = remainingPcm.length;
        this.oldestSampleTimestampMs += this.hopDurationMs;
        console.log(
          `[VIRA][BUFFER] next analysis window scheduled (buffered ${Math.round((this.totalBufferedSamples / sampleRate) * 1000)} ms retained)`
        );
      } else {
        this.chunks = [];
        this.totalBufferedSamples = 0;
        this.oldestSampleTimestampMs += (flattened.length / sampleRate) * 1000;
        console.log(`[VIRA][BUFFER] next analysis window scheduled (buffer reset)`);
      }
    }

    if (windows.length === 0 && this.totalBufferedSamples > 0) {
      console.log(
        `[VIRA][BUFFER] ${(currentDurationMs / 1000).toFixed(1)} / ${(this.targetDurationMs / 1000).toFixed(1)} seconds`
      );
      console.log(
        `[VIRA][BUFFER] speech duration = ${Math.round(currentDurationMs)} ms (buffering ${(currentDurationMs / 1000).toFixed(2)}s / ${(this.targetDurationMs / 1000).toFixed(1)}s)`
      );
    }

    // Safety: prevent unbounded growth if targetSamples is very large
    if (this.totalBufferedSamples > maxSamples) {
      const flattened = concatFloat32(this.chunks);
      const excess = flattened.length - maxSamples;
      const trimmed = flattened.slice(excess);
      this.chunks = [trimmed];
      this.totalBufferedSamples = trimmed.length;
      this.oldestSampleTimestampMs += (excess / sampleRate) * 1000;
    }

    return windows;
  }

  /**
   * Returns current accumulated speech duration in milliseconds.
   */
  getBufferedDurationMs(): number {
    if (!this.sampleRate || this.sampleRate === 0) return 0;
    return (this.totalBufferedSamples / this.sampleRate) * 1000;
  }

  /**
   * Resets all accumulated buffer state and clears sequence numbers.
   */
  reset(): void {
    this.chunks = [];
    this.totalBufferedSamples = 0;
    this.sampleRate = null;
    this.sequenceNumber = 0;
    this.oldestSampleTimestampMs = 0;
  }
}
