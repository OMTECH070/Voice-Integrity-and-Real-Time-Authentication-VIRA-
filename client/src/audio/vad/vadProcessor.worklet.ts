import { VadStateMachine, frameSizeForSampleRate } from "./vadCore";
import { SpeechAudioGate } from "./speechAudioGate";
import type { VADConfig, VADFrameResult } from "./types";

/** Messages the main thread sends into the worklet. */
type InboundMessage =
  | { type: "init"; config: VADConfig }
  | { type: "reset" };

/** Messages the worklet sends back to the main thread. */
export type WorkletOutboundMessage =
  | { type: "frame"; result: VADFrameResult }
  | { type: "audioFrame"; samples: Float32Array; timestampMs: number }
  | { type: "speechAudio"; samples: Float32Array; timestampMs: number };

/**
 * Runs on the audio rendering thread. The Web Audio API calls process()
 * once per 128-sample render quantum (~2.9ms @ 44.1kHz) — too short for a
 * stable energy estimate, so this class buffers quanta into
 * `frameDurationMs`-sized analysis frames before handing each one to
 * VadStateMachine and posting the result back to the main thread.
 *
 * Every analysis frame produces a "frame" message (classification
 * metadata only — label/energy/zcr/timestamp, never raw audio). Separately,
 * SpeechAudioGate decides whether that frame's *audio* is allowed to leave
 * at all: only frames inside a confirmed speech segment ever produce a
 * "speechAudio" message. Pure silence is classified (so meters/visualizers
 * still update) but its samples are never transmitted anywhere.
 *
 * No audio is modified or forwarded to speakers: process() returns without
 * writing to `outputs`, so this node is an observer only.
 */
class VadWorkletProcessor extends AudioWorkletProcessor {
  private vad: VadStateMachine | null = null;
  private gate: SpeechAudioGate | null = null;
  private frameSize = 0;
  private buffer: Float32Array = new Float32Array(0);
  private bufferFill = 0;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);
    this.port.onmessage = (event: MessageEvent<InboundMessage>) => {
      const message = event.data;
      if (message.type === "init") {
        const frameDurationMs = message.config.frameDurationMs ?? 20;
        this.vad = new VadStateMachine(message.config);
        this.gate = new SpeechAudioGate({
          frameDurationMs,
          // Pre-roll must cover exactly the run-up VadStateMachine needs
          // to confirm a segment, so the backfilled audio lines up with
          // the frames that were actually classified as its leading edge.
          preRollFrames: message.config.minSpeechFrames ?? 3,
        });
        this.frameSize = frameSizeForSampleRate(message.config.sampleRate, frameDurationMs);
        this.buffer = new Float32Array(this.frameSize);
        this.bufferFill = 0;
      } else if (message.type === "reset") {
        this.vad?.reset();
        this.gate?.reset();
        this.bufferFill = 0;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    // Not initialized yet, or the track has no channel data this quantum
    // (e.g. momentarily muted/disconnected) — keep the node alive and wait.
    if (!this.vad || !this.gate || this.frameSize === 0) return true;
    const input = inputs[0];
    const channel = input?.[0];
    if (!channel || channel.length === 0) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferFill++] = channel[i];
      if (this.bufferFill >= this.frameSize) {
        this.emitFrame(this.buffer);
        this.bufferFill = 0;
      }
    }

    return true;
  }

  private emitFrame(frame: Float32Array): void {
    const vad = this.vad!;
    const gate = this.gate!;

    const result = vad.processFrame(frame);
    this.port.postMessage({ type: "frame", result } satisfies WorkletOutboundMessage);
    this.port.postMessage({
      type: "audioFrame",
      samples: frame.slice(),
      timestampMs: result.timestampMs,
    } satisfies WorkletOutboundMessage);

    // Gate runs AFTER classification, keyed off the smoothed decision —
    // never off the raw per-frame isSpeechFrame flag — so it matches
    // exactly the segment boundaries onSpeechStart/onSpeechEnd report.
    const chunks = gate.push(frame, vad.isInSpeech, result.timestampMs);
    for (const chunk of chunks) {
      // Transfer, don't copy, across the port — the gate already gave us
      // an independent buffer via frame.slice(), so it's safe to hand its
      // backing ArrayBuffer over rather than clone it again.
      this.port.postMessage(
        {
          type: "speechAudio",
          samples: chunk.samples,
          timestampMs: chunk.timestampMs,
        } satisfies WorkletOutboundMessage,
        [chunk.samples.buffer]
      );
    }
  }
}

registerProcessor("vad-processor", VadWorkletProcessor);
