import type { AudioChunk } from "./types";

/**
 * Accumulates a stream of small speech-only PCM pieces (e.g. the ~20ms
 * gated frames the client-side VAD hands over) into fixed-duration
 * windows suitable for a speaker-embedding / anti-spoof model — those
 * models need real audio context (seconds, not milliseconds) to produce
 * a meaningful score, unlike the VAD's own frame-by-frame decision.
 *
 * Deliberately has no dependency on sockets, ONNX Runtime, or any
 * particular audio source — it just consumes Float32Array pieces plus
 * their timing and emits complete AudioChunks when a window fills up.
 * Same "pure core, thin adapter" shape as the client's vadCore.ts and
 * speechAudioGate.ts, and for the same reason: testable in plain Node,
 * reusable from any transport.
 */
export class SpeechChunkBuffer {
  private readonly sampleRate: number;
  private readonly targetSamples: number;
  private pieces: Float32Array[] = [];
  private samplesInWindow = 0;
  private windowStartMs: number | null = null;

  constructor(sampleRate: number, chunkDurationMs: number) {
    this.sampleRate = sampleRate;
    this.targetSamples = Math.max(1, Math.round((sampleRate * chunkDurationMs) / 1000));
  }

  /**
   * Feed one piece of speech PCM (already gated — see speechAudioGate.ts
   * on the client — never raw/unfiltered audio) at the given timestamp.
   * Returns a complete AudioChunk once enough audio has accumulated,
   * otherwise null. Silence gaps between speech bursts do NOT reset the
   * window — a window is "N seconds of actual speech", not "N seconds of
   * wall-clock time" — so a few short utterances can combine into one
   * analysis window instead of each being too short to score reliably.
   */
  push(piece: Float32Array, timestampMs: number): AudioChunk | null {
    if (piece.length === 0) return null;
    if (this.windowStartMs === null) this.windowStartMs = timestampMs;

    this.pieces.push(piece);
    this.samplesInWindow += piece.length;

    if (this.samplesInWindow < this.targetSamples) return null;

    const chunk: AudioChunk = {
      samples: this.flatten(),
      sampleRate: this.sampleRate,
      startMs: this.windowStartMs,
      endMs: timestampMs,
    };
    this.reset();
    return chunk;
  }

  /**
   * Flushes whatever partial audio has accumulated as a final (possibly
   * short) chunk — call this when a call/segment ends so the last few
   * seconds of speech aren't silently dropped. Returns null if nothing
   * was buffered.
   */
  flush(nowMs: number): AudioChunk | null {
    if (this.pieces.length === 0 || this.windowStartMs === null) return null;
    const chunk: AudioChunk = {
      samples: this.flatten(),
      sampleRate: this.sampleRate,
      startMs: this.windowStartMs,
      endMs: nowMs,
    };
    this.reset();
    return chunk;
  }

  private flatten(): Float32Array {
    if (this.pieces.length === 1) return this.pieces[0];
    let total = 0;
    for (const p of this.pieces) total += p.length;
    const out = new Float32Array(total);
    let offset = 0;
    for (const p of this.pieces) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  private reset(): void {
    this.pieces = [];
    this.samplesInWindow = 0;
    this.windowStartMs = null;
  }
}
