import { InferenceSession, Tensor } from "onnxruntime-node";
import type { AudioChunk, VoiceLivenessBackend, VoiceLivenessResult } from "../types";

export interface OnnxNodeBackendConfig {
  /** Path to an ECAPA-TDNN (or similar) speaker-embedding model, exported
   * to ONNX. Optional — omit if you only want the spoof score and don't
   * need embeddings. */
  ecapaModelPath?: string;
  /** Path to an anti-spoof / deepfake-voice classifier, exported to ONNX
   * (e.g. an AASIST or RawNet2 checkpoint trained on ASVspoof). Required
   * — this is what actually produces spoofScore. */
  antispoofModelPath: string;
  /** Input tensor name the antispoof model expects. Varies by export —
   * check your model with e.g. Netron before setting this. Common
   * default for many public exports is "input". */
  antispoofInputName?: string;
  /** Output tensor name holding the spoof logit/probability. */
  antispoofOutputName?: string;
  /**
   * Some anti-spoof architectures (AASIST among them) require EXACTLY
   * this many input samples per inference call — not "up to", not
   * "at least", exactly — because they use a learned positional embedding
   * sized for the node count that length produces internally. Feeding a
   * different length either crashes or silently produces nonsense.
   *
   * When set, analyze() pads (by tiling, matching the model's own
   * training-time convention) or crops (truncating to the first N
   * samples) every chunk to this length before inference — mirroring
   * AASIST's own data_utils.py `pad()` function exactly, so behavior at
   * inference time matches how the model was evaluated during training.
   *
   * Leave unset for architectures that accept variable-length input.
   */
  antispoofRequiredInputLength?: number;
  ecapaInputName?: string;
  ecapaOutputName?: string;
  spoofThreshold?: number;
  uncertaintyBand?: number;
}

/**
 * Real inference backend using onnxruntime-node (CPU execution provider
 * — no GPU required, which is what makes this deployable on a plain
 * Render instance). This class does NOT ship any model weights — you
 * must supply your own ONNX-exported checkpoints:
 *
 *  - Anti-spoof: a checkpoint trained on ASVspoof-style data (AASIST and
 *    RawNet2 are the standard open baselines) exported to ONNX.
 *  - Speaker embedding (optional): an ECAPA-TDNN checkpoint (e.g. from
 *    SpeechBrain's spkrec-ecapa-voxceleb) exported to ONNX.
 *
 * See the module README for where to source and export these, and how
 * to inspect a checkpoint's actual input/output tensor names (they vary
 * by export tool and are NOT guessed here) before setting
 * antispoofInputName / antispoofOutputName below.
 *
 * Until real files are supplied, InferenceSession.create() will reject
 * with a file-not-found error the first time analyze() runs — the
 * README covers that explicitly so it isn't mistaken for a bug.
 */
export class OnnxNodeVoiceLivenessBackend implements VoiceLivenessBackend {
  readonly requiredSampleRate = 16000;

  private readonly config: Required<
    Pick<OnnxNodeBackendConfig, "antispoofModelPath" | "spoofThreshold" | "uncertaintyBand">
  > &
    OnnxNodeBackendConfig;

  private antispoofSession: InferenceSession | null = null;
  private ecapaSession: InferenceSession | null = null;
  private sessionsReady: Promise<void> | null = null;

  constructor(config: OnnxNodeBackendConfig) {
    this.config = {
      antispoofInputName: "input",
      antispoofOutputName: "spoof_prob",
      ecapaInputName: "input",
      ecapaOutputName: "embedding",
      spoofThreshold: 0.7,
      uncertaintyBand: 0.15,
      ...config,
    };
  }

  /** Lazily loads model sessions on first use, once, and reuses them —
   * session creation (reading + initializing the ONNX graph) is
   * comparatively expensive and should not happen per-chunk. */
  private async ensureSessions(): Promise<void> {
    if (!this.sessionsReady) {
      this.sessionsReady = (async () => {
        this.antispoofSession = await InferenceSession.create(this.config.antispoofModelPath);
        if (this.config.ecapaModelPath) {
          this.ecapaSession = await InferenceSession.create(this.config.ecapaModelPath);
        }
      })();
    }
    return this.sessionsReady;
  }

  async analyze(chunk: AudioChunk): Promise<VoiceLivenessResult> {
    if (chunk.sampleRate !== this.requiredSampleRate) {
      throw new Error(
        `OnnxNodeVoiceLivenessBackend expects ${this.requiredSampleRate}Hz audio, got ` +
          `${chunk.sampleRate}Hz. Resample before calling analyze() — see resample.ts.`
      );
    }

    await this.ensureSessions();
    const start = Date.now();

    const antispoofInput = this.config.antispoofRequiredInputLength
      ? this.fitToLength(chunk.samples, this.config.antispoofRequiredInputLength)
      : chunk.samples;
    const inputTensor = new Tensor("float32", antispoofInput, [1, antispoofInput.length]);

    const antispoofOutputs = await this.antispoofSession!.run({
      [this.config.antispoofInputName!]: inputTensor,
    });
    const rawTensor = antispoofOutputs[this.config.antispoofOutputName!];
    const spoofScore = this.extractSpoofScore(rawTensor);
    const rawOutputShape = rawTensor ? Array.from(rawTensor.dims) : [1, 1];
    const rawOutputValues = rawTensor ? Array.from(rawTensor.data as Float32Array) : [spoofScore];

    let embedding: Float32Array | null = null;
    if (this.ecapaSession) {
      const ecapaInputName = this.config.ecapaInputName ?? this.ecapaSession.inputNames[0];
      const ecapaOutputName = this.config.ecapaOutputName ?? this.ecapaSession.outputNames[0];
      const ecapaOutputs = await this.ecapaSession.run({
        [ecapaInputName]: inputTensor,
      });
      const raw = ecapaOutputs[ecapaOutputName];
      embedding = raw ? (raw.data as Float32Array) : null;
    }

    return {
      spoofScore,
      label: this.labelFor(spoofScore),
      embedding,
      atMs: chunk.endMs,
      inferenceMs: Date.now() - start,
      rawOutputShape,
      rawOutputValues,
    };
  }

  /** Model outputs vary (raw logit vs. already-sigmoided probability vs.
   * a [live, spoof] 2-class softmax). This handles the common shapes;
   * adjust once you know your specific checkpoint's output format.
   *
   * The AASIST export produced by export_to_onnx.py (see the module
   * README) always hits the single-scalar branch below — softmax and
   * class-selection are baked into that export's ONNX graph itself, so
   * the model already outputs one calibrated [0,1] spoof probability. */
  private extractSpoofScore(output: Tensor | undefined): number {
    if (!output) {
      throw new Error(
        `Anti-spoof model produced no "${this.config.antispoofOutputName}" output — ` +
          "check antispoofOutputName matches your model's actual output tensor name."
      );
    }
    const data = output.data as Float32Array;
    if (data.length === 1) {
      // Single scalar — assume already a 0..1 probability (sigmoid output).
      return this.clamp01(data[0]);
    }
    if (data.length === 2) {
      // [live_logit, spoof_logit] — softmax and take the spoof class.
      const [live, spoof] = data;
      const maxLogit = Math.max(live, spoof);
      const expLive = Math.exp(live - maxLogit);
      const expSpoof = Math.exp(spoof - maxLogit);
      return expSpoof / (expLive + expSpoof);
    }
    throw new Error(
      `Unexpected anti-spoof output shape (${data.length} values) — extractSpoofScore ` +
        "needs updating for this model's actual output format."
    );
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  /**
   * Pads (by tiling) or crops audio to exactly `length` samples — mirrors
   * AASIST's own data_utils.py `pad()` so inference-time framing matches
   * how the model was evaluated during training, rather than guessing at
   * zero-padding (which the model was never trained on and can score
   * unpredictably against).
   */
  private fitToLength(samples: Float32Array, length: number): Float32Array {
    if (samples.length === length) return samples;
    if (samples.length > length) return samples.slice(0, length);
    if (samples.length === 0) return new Float32Array(length); // nothing to tile; zero-fill

    const out = new Float32Array(length);
    for (let offset = 0; offset < length; offset += samples.length) {
      out.set(samples.subarray(0, Math.min(samples.length, length - offset)), offset);
    }
    return out;
  }

  private labelFor(spoofScore: number): VoiceLivenessResult["label"] {
    const { spoofThreshold, uncertaintyBand } = this.config;
    if (spoofScore >= spoofThreshold) return "likely-synthetic";
    if (spoofScore <= spoofThreshold - uncertaintyBand) return "live";
    return "uncertain";
  }
}
