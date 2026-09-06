import type { AudioChunk, VoiceLivenessBackend, VoiceLivenessResult } from "../types";

/**
 * Throws on every call. This is the default backend until real model
 * files are wired up — the point is that VoiceLivenessAnalyzer never
 * silently fabricates a "live" or "synthetic" verdict just because no
 * model is configured. A paying user seeing a real-looking score that's
 * actually a stub would be worse than a clear error.
 */
export class NotConfiguredBackend implements VoiceLivenessBackend {
  readonly requiredSampleRate = 16000;

  async analyze(): Promise<VoiceLivenessResult> {
    throw new Error(
      "VoiceLivenessBackend not configured: no anti-spoof/ECAPA model is " +
        "loaded. Provide a real backend (see adapters/onnxNodeBackend.ts) " +
        "before wiring this up to paying users."
    );
  }
}

/**
 * Deterministic fake backend for unit tests and local wiring/plumbing
 * checks — NEVER use this in anything a user sees. It has no idea
 * whether audio is synthetic; it just derives a stable, reproducible
 * score from the chunk's energy so tests can assert on analyzer
 * behavior (chunking, event firing, error handling) without needing
 * real model weights.
 */
export class MockVoiceLivenessBackend implements VoiceLivenessBackend {
  readonly requiredSampleRate = 16000;
  /** ms of artificial delay per call, to exercise inferenceMs timing in
   * tests without needing a real model. */
  private readonly simulatedLatencyMs: number;

  constructor(simulatedLatencyMs = 0) {
    this.simulatedLatencyMs = simulatedLatencyMs;
  }

  async analyze(chunk: AudioChunk): Promise<VoiceLivenessResult> {
    const start = Date.now();
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    let sumSquares = 0;
    for (let i = 0; i < chunk.samples.length; i++) {
      sumSquares += chunk.samples[i] * chunk.samples[i];
    }
    const rms = chunk.samples.length > 0 ? Math.sqrt(sumSquares / chunk.samples.length) : 0;
    // Arbitrary, meaningless-but-stable mapping — purely so tests have a
    // deterministic number to assert against.
    const spoofScore = Math.min(1, Math.max(0, 1 - rms * 4));

    return {
      spoofScore,
      label: spoofScore > 0.7 ? "likely-synthetic" : spoofScore < 0.3 ? "live" : "uncertain",
      embedding: null,
      atMs: chunk.endMs,
      inferenceMs: Date.now() - start,
    };
  }
}
