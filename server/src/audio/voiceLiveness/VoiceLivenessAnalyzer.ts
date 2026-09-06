import { SpeechChunkBuffer } from "./chunkBuffer";
import { resampleLinear } from "./resample";
import { NotConfiguredBackend } from "./adapters/mockBackend";
import type { VoiceLivenessBackend, VoiceLivenessConfig, VoiceLivenessEvents } from "./types";

const DEFAULT_CHUNK_DURATION_MS = 2500;

/**
 * Consumes a stream of gated speech-only PCM pieces (the same shape the
 * client's SpeechAudioGate produces — never raw/unfiltered audio) at
 * whatever sample rate they arrive at, buffers them into fixed-duration
 * windows, resamples each window to the backend's expected rate, and
 * runs it through the backend to produce a periodic liveness score.
 *
 * This class knows nothing about sockets, HTTP, subscriptions, or where
 * its input audio came from — same separation of concerns as the
 * client's VoiceActivityDetector, so it's independently testable and
 * reusable regardless of transport.
 */
export class VoiceLivenessAnalyzer {
  private readonly backend: VoiceLivenessBackend;
  private readonly events: VoiceLivenessEvents;
  private readonly chunkDurationMs: number;
  private buffer: SpeechChunkBuffer | null = null;
  private sourceSampleRate: number | null = null;

  constructor(
    backend: VoiceLivenessBackend = new NotConfiguredBackend(),
    events: VoiceLivenessEvents = {},
    config: VoiceLivenessConfig = {}
  ) {
    this.backend = backend;
    this.events = events;
    this.chunkDurationMs = config.chunkDurationMs ?? DEFAULT_CHUNK_DURATION_MS;
  }

  /**
   * Feed one piece of gated speech PCM. `sourceSampleRate` is whatever
   * rate the audio actually arrives at — it only needs to be passed
   * once; subsequent calls may omit it (kept from the first call) unless
   * it changes mid-stream, which would indicate a caller bug upstream.
   */
  push(piece: Float32Array, timestampMs: number, sourceSampleRate: number): void {
    if (this.sourceSampleRate === null) {
      this.sourceSampleRate = sourceSampleRate;
      this.buffer = new SpeechChunkBuffer(sourceSampleRate, this.chunkDurationMs);
    } else if (sourceSampleRate !== this.sourceSampleRate) {
      this.events.onError?.(
        new Error(
          `VoiceLivenessAnalyzer: source sample rate changed mid-stream ` +
            `(${this.sourceSampleRate}Hz -> ${sourceSampleRate}Hz) — this should not happen ` +
            "for a single call/session and likely indicates a caller bug."
        )
      );
      return;
    }

    const chunk = this.buffer!.push(piece, timestampMs);
    if (chunk) this.analyzeChunk(chunk.samples, chunk.sampleRate, chunk.startMs, chunk.endMs);
  }

  /** Flushes any partial buffered audio as a final chunk — call when the
   * call/session ends so the last few seconds aren't dropped. */
  flush(nowMs: number): void {
    if (!this.buffer) return;
    const chunk = this.buffer.flush(nowMs);
    if (chunk) this.analyzeChunk(chunk.samples, chunk.sampleRate, chunk.startMs, chunk.endMs);
  }

  private analyzeChunk(
    samples: Float32Array,
    sampleRate: number,
    startMs: number,
    endMs: number
  ): void {
    const resampled = resampleLinear(samples, sampleRate, this.backend.requiredSampleRate);
    this.backend
      .analyze({ samples: resampled, sampleRate: this.backend.requiredSampleRate, startMs, endMs })
      .then((result) => this.events.onResult?.(result))
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.events.onError?.(error);
      });
  }
}
