/**
 * Decides which raw PCM frames are allowed to leave the VAD subsystem.
 *
 * This is the enforcement point for one rule: silence audio is never
 * captured or transmitted, only speech-classified PCM leaves the VAD.
 * Everything else in this file exists to make that rule work without
 * clipping the first word of an utterance.
 *
 * Why a pre-roll is needed: VadStateMachine only flips `isInSpeech` to
 * true after `minSpeechFrames` consecutive speech-like frames — that's
 * deliberate debounce logic to reject transient noise, but it means the
 * first (minSpeechFrames - 1) frames of real speech have already gone by,
 * classified non-speech, by the time the segment is confirmed. Dropping
 * them would chop the leading edge off every utterance. So this class
 * keeps a short rolling buffer of recent non-speech frames and, the
 * instant a segment is confirmed, backfills exactly those frames (and no
 * others) before continuing with the live stream.
 *
 * Frames outside a confirmed segment are held only long enough to serve
 * as potential pre-roll for the *next* segment, then discarded — they are
 * never handed back to a caller as "speechAudio".
 *
 * Deliberately has no Web Audio / AudioWorklet dependency (same reasoning
 * as vadCore.ts): a plain class over Float32Arrays, unit-testable in
 * plain Node, and reusable from the AudioWorkletProcessor.
 */

export interface SpeechAudioGateConfig {
  /** Duration of one analysis frame, in ms — used only to timestamp
   * backfilled pre-roll frames correctly relative to "now". */
  frameDurationMs: number;
  /** How many trailing non-speech frames to keep on hand as potential
   * pre-roll. Should match (or slightly exceed) VADConfig.minSpeechFrames,
   * since that's exactly how many frames precede a confirmed segment. */
  preRollFrames: number;
}

/** One chunk of PCM cleared to leave the VAD, with the timestamp (ms since
 * the owning VAD instance started) it corresponds to. */
export interface GatedAudioChunk {
  samples: Float32Array;
  timestampMs: number;
}

export class SpeechAudioGate {
  private readonly frameDurationMs: number;
  private readonly preRollCapacity: number;
  private preRoll: Float32Array[] = [];
  private wasInSpeech = false;

  constructor(config: SpeechAudioGateConfig) {
    this.frameDurationMs = config.frameDurationMs;
    this.preRollCapacity = Math.max(0, config.preRollFrames);
  }

  /** Clears buffered pre-roll and speech state without changing config —
   * mirrors VadStateMachine.reset() so the pair can be reset together. */
  reset(): void {
    this.preRoll = [];
    this.wasInSpeech = false;
  }

  /**
   * Feed one analysis frame alongside the VAD's smoothed decision for it
   * (`VadStateMachine.isInSpeech` *after* processing that same frame).
   *
   * `frame` is copied defensively — the gate never retains a reference
   * into a caller-owned working buffer that might be overwritten next
   * frame — and the returned chunks own independent buffers, safe to
   * transfer across a MessagePort.
   *
   * Returns zero, one, or several chunks (more than one only on the
   * frame that confirms a new segment, when pre-roll is flushed first).
   * Callers must transmit exactly these chunks and nothing else; the raw
   * `frame` argument itself must never be forwarded directly.
   */
  push(frame: Float32Array, inSpeechNow: boolean, timestampMs: number): GatedAudioChunk[] {
    const out: GatedAudioChunk[] = [];

    if (inSpeechNow && !this.wasInSpeech) {
      // Segment just confirmed: hand over the backfilled leading edge
      // first, oldest frame first, so chunk order matches audio order.
      const preRollMs = this.preRoll.length * this.frameDurationMs;
      for (let i = 0; i < this.preRoll.length; i++) {
        out.push({
          samples: this.preRoll[i],
          timestampMs: timestampMs - preRollMs + i * this.frameDurationMs,
        });
      }
      this.preRoll = [];
    }

    if (inSpeechNow) {
      // Live frame, part of an in-progress (or just-started) segment.
      // Note this also covers the state machine's hangover tail — a few
      // near-silent frames right after speech before the segment is
      // declared over — on purpose, so trailing phonemes aren't clipped.
      out.push({ samples: frame.slice(), timestampMs });
    } else {
      // Not part of any confirmed segment: never emitted. Only kept
      // around, briefly, in case it turns out to be the start of the
      // next one.
      this.preRoll.push(frame.slice());
      if (this.preRoll.length > this.preRollCapacity) {
        this.preRoll.shift();
      }
    }

    this.wasInSpeech = inSpeechNow;
    return out;
  }
}
