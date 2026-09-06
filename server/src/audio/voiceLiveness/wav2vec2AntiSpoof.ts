import fs from "fs";
import path from "path";
import { InferenceSession, Tensor } from "onnxruntime-node";
import { resampleLinear } from "./resample";
import { logger } from "../../utils/logger";

export type Wav2Vec2Status =
  | "READY"
  | "NOT_READY"
  | "MODEL_NOT_FOUND"
  | "INFERENCE_ERROR";

export interface Wav2Vec2InferenceResult {
  ready: boolean;
  status: Wav2Vec2Status;
  spoofScore: number | null;
  learnedFeatures: Float32Array | null;
  featureDimension: number;
  modelVersion: string;
  reason: string;
}

export interface Wav2Vec2Config {
  modelPath?: string;
  sampleRate?: number;
}

const DEFAULT_MODEL_VERSION = "Wav2Vec2-AntiSpoof-Head-v1";
const REQUIRED_SAMPLE_RATE = 16000;

/**
 * Wav2Vec2-based Anti-Spoofing Architecture.
 *
 * NOTE: Wav2Vec2 by itself is a foundational acoustic representation, NOT an
 * automatic deepfake/anti-spoof detector. True anti-spoof classification requires
 * a fine-tuned downstream classification head trained specifically on synthetic speech,
 * replay attacks, and voice conversions (e.g. ASVspoof 2021 / In-the-Wild).
 *
 * If no trained checkpoint is found, this class explicitly marks its state as
 * NOT_READY / MODEL_NOT_FOUND and never fabricates scores.
 */
export class Wav2Vec2AntiSpoofClassifier {
  private session: InferenceSession | null = null;
  private status: Wav2Vec2Status = "NOT_READY";
  private resolvedPath: string | null = null;
  private reason = "Wav2Vec2 anti-spoof classifier requires a trained downstream checkpoint";

  constructor(config?: Wav2Vec2Config) {
    this.resolveAndInit(config?.modelPath);
  }

  private resolveModelPath(explicitPath?: string): string | null {
    const envPath = process.env.VIRA_WAV2VEC2_MODEL_PATH;
    const candidates = [
      ...(explicitPath ? [path.resolve(explicitPath)] : []),
      ...(envPath ? [path.resolve(envPath)] : []),
      path.resolve(process.cwd(), "models/wav2vec2_antispoof.onnx"),
      path.resolve(process.cwd(), "server/models/wav2vec2_antispoof.onnx"),
      path.resolve(__dirname, "../../../models/wav2vec2_antispoof.onnx"),
      path.resolve(__dirname, "../../../../models/wav2vec2_antispoof.onnx"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  public async resolveAndInit(explicitPath?: string): Promise<boolean> {
    this.resolvedPath = this.resolveModelPath(explicitPath);

    if (!this.resolvedPath) {
      this.status = "NOT_READY";
      this.reason =
        "REQUIRES_CHECKPOINT: Wav2Vec2 anti-spoof model checkpoint not found. Operating in verified AASIST-only mode.";
      return false;
    }

    try {
      this.session = await InferenceSession.create(this.resolvedPath);
      this.status = "READY";
      this.reason = "Wav2Vec2 anti-spoof classifier successfully initialized";
      logger.info(`Wav2Vec2AntiSpoof: Loaded checkpoint from ${this.resolvedPath}`);
      return true;
    } catch (err) {
      this.status = "INFERENCE_ERROR";
      this.reason = err instanceof Error ? err.message : String(err);
      logger.warn(`Wav2Vec2AntiSpoof: Failed to initialize checkpoint: ${this.reason}`);
      return false;
    }
  }

  public isReady(): boolean {
    return this.status === "READY" && this.session !== null;
  }

  public getStatus(): { status: Wav2Vec2Status; ready: boolean; reason: string; modelPath: string | null } {
    return {
      status: this.status,
      ready: this.isReady(),
      reason: this.reason,
      modelPath: this.resolvedPath,
    };
  }

  /**
   * Run inference if a real trained checkpoint is available.
   * If not ready, explicitly returns null spoofScore without fabricating synthetic results.
   */
  public async analyzeSpeech(
    samples: Float32Array,
    sampleRate: number
  ): Promise<Wav2Vec2InferenceResult> {
    if (!this.isReady() || !this.session) {
      return {
        ready: false,
        status: this.status,
        spoofScore: null,
        learnedFeatures: null,
        featureDimension: 0,
        modelVersion: DEFAULT_MODEL_VERSION,
        reason: this.reason,
      };
    }

    try {
      // 1. Resample to 16 kHz if necessary
      const resampled =
        sampleRate === REQUIRED_SAMPLE_RATE
          ? samples
          : resampleLinear(samples, sampleRate, REQUIRED_SAMPLE_RATE);

      const inputTensor = new Tensor("float32", resampled, [1, resampled.length]);
      const inputName = this.session.inputNames[0] ?? "input";

      const outputs = await this.session.run({ [inputName]: inputTensor });

      // Extract spoof score and features
      const scoreOutput = outputs["score"] ?? outputs[this.session.outputNames[0]];
      const featOutput = outputs["features"] ?? (this.session.outputNames.length > 1 ? outputs[this.session.outputNames[1]] : null);

      let spoofScore = 0.5;
      if (scoreOutput) {
        const data = scoreOutput.data as Float32Array;
        spoofScore = data[0];
      }

      let learnedFeatures: Float32Array | null = null;
      let featureDimension = 0;
      if (featOutput) {
        learnedFeatures = featOutput.data as Float32Array;
        featureDimension = learnedFeatures.length;
      }

      return {
        ready: true,
        status: "READY",
        spoofScore,
        learnedFeatures,
        featureDimension,
        modelVersion: DEFAULT_MODEL_VERSION,
        reason: "Inference executed successfully",
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        ready: false,
        status: "INFERENCE_ERROR",
        spoofScore: null,
        learnedFeatures: null,
        featureDimension: 0,
        modelVersion: DEFAULT_MODEL_VERSION,
        reason: errMsg,
      };
    }
  }
}

export const wav2vec2AntiSpoof = new Wav2Vec2AntiSpoofClassifier();
