/**
 * Silero VAD v5 Neural Network Inference Backend
 *
 * Implements genuine Silero VAD v5 ONNX neural network inference.
 * - Input: 16 kHz Mono Float32Array chunks (512 samples / 32 ms)
 * - Internal architecture: 64-sample rolling context + 512-sample frame = 576 samples [1, 576]
 * - Recurrent hidden state: [2, 1, 128] Float32 tensor
 * - Sample rate tensor: [16000n] (int64)
 * - Output: Speech probability scalar in [0.0, 1.0]
 *
 * Exposes honest diagnostic status:
 * vadEngine: "silero" | "fallback-rms-zcr"
 * modelLoaded: boolean
 * modelVersion: "Silero-VAD-v5"
 * inferenceAvailable: boolean
 */

import * as ortWeb from "onnxruntime-web";
import type { VadDiagnosticStatus } from "./types";

export interface SileroVadConfig {
  positiveSpeechThreshold?: number; // default: 0.50
  negativeSpeechThreshold?: number; // default: 0.35
  modelPath?: string;
}

export interface SileroFrameOutput {
  speechProbability: number;
  isSpeech: boolean;
}

export class SileroVadBackend {
  private session: any = null;
  private ort: any = ortWeb;
  private stateTensor: any = null;
  private srTensor: any = null;
  private contextTail: Float32Array = new Float32Array(64);

  private config: Required<SileroVadConfig>;
  private status: VadDiagnosticStatus = {
    vadEngine: "fallback-rms-zcr",
    modelLoaded: false,
    modelVersion: "Silero-VAD-v5",
    inferenceAvailable: false,
    error: null,
  };

  constructor(config: SileroVadConfig = {}) {
    this.config = {
      positiveSpeechThreshold: config.positiveSpeechThreshold ?? 0.50,
      negativeSpeechThreshold: config.negativeSpeechThreshold ?? 0.35,
      modelPath: config.modelPath ?? "/models/silero_vad.onnx",
    };
  }

  public getStatus(): VadDiagnosticStatus {
    return { ...this.status };
  }

  public isAvailable(): boolean {
    return this.status.modelLoaded && this.status.inferenceAvailable && this.session !== null;
  }

  /**
   * Initializes the ONNX Runtime session using onnxruntime-web.
   * In the browser, fetches the model via HTTP/fetch.
   * In tests or custom contexts, accepts an ArrayBuffer or Uint8Array.
   */
  public async init(customModelPathOrBuffer?: string | ArrayBuffer | Uint8Array): Promise<boolean> {
    try {
      this.ort = ortWeb;

      // Configure WASM options for browser WebAssembly inference
      if (this.ort.env?.wasm) {
        this.ort.env.wasm.numThreads = 1;
        this.ort.env.wasm.proxy = false;
      }

      let modelData: ArrayBuffer | Uint8Array;
      if (
        customModelPathOrBuffer instanceof ArrayBuffer ||
        (typeof Uint8Array !== "undefined" && customModelPathOrBuffer instanceof Uint8Array)
      ) {
        modelData = customModelPathOrBuffer;
      } else {
        const url = (typeof customModelPathOrBuffer === "string" ? customModelPathOrBuffer : null) || this.config.modelPath;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch Silero model from ${url} (HTTP ${response.status} ${response.statusText})`);
        }
        modelData = await response.arrayBuffer();
      }

      this.session = await this.ort.InferenceSession.create(modelData);

      // Initialize recurrent state: [2, 1, 128] and sample rate [16000n]
      this.resetState();

      this.status = {
        vadEngine: "silero",
        modelLoaded: true,
        modelVersion: "Silero-VAD-v5",
        inferenceAvailable: true,
        error: null,
      };

      return true;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      this.status = {
        vadEngine: "fallback-rms-zcr",
        modelLoaded: false,
        modelVersion: "Silero-VAD-v5",
        inferenceAvailable: false,
        error: errorMsg,
      };
      this.session = null;
      return false;
    }
  }

  /**
   * Resets the recurrent LSTM hidden state and rolling context buffer.
   */
  public resetState(): void {
    if (!this.ort) return;

    this.contextTail.fill(0);
    const zeroState = new Float32Array(2 * 1 * 128);
    this.stateTensor = new this.ort.Tensor("float32", zeroState, [2, 1, 128]);
    this.srTensor = new this.ort.Tensor("int64", [16000n]);
  }

  /**
   * Processes a 512-sample audio chunk at 16,000 Hz.
   * Prepends the 64-sample context to create a 576-sample tensor [1, 576].
   */
  public async process(frame512: Float32Array): Promise<SileroFrameOutput> {
    if (!this.isAvailable()) {
      throw new Error(`Silero VAD inference is not available: ${this.status.error || "Model not loaded"}`);
    }

    if (frame512.length !== 512) {
      throw new Error(`Silero VAD requires frame length of 512 samples @ 16kHz, received ${frame512.length}`);
    }

    // Construct 576-sample input: [64 context samples] + [512 current samples]
    const frame576 = new Float32Array(576);
    frame576.set(this.contextTail, 0);
    frame576.set(frame512, 64);

    // Save trailing 64 samples for the next frame
    this.contextTail.set(frame576.subarray(512, 576));

    const inputTensor = new this.ort.Tensor("float32", frame576, [1, 576]);

    const feeds: Record<string, any> = {
      input: inputTensor,
      state: this.stateTensor,
      sr: this.srTensor,
    };

    const results = await this.session.run(feeds);

    // Update recurrent state
    if (results.stateN) {
      this.stateTensor = results.stateN;
    }

    const outputData = results.output?.data;
    if (!outputData || outputData.length === 0) {
      throw new Error("Silero model returned empty output tensor");
    }

    const speechProbability = Number(outputData[0]);
    const isSpeech = speechProbability >= this.config.positiveSpeechThreshold;

    return {
      speechProbability,
      isSpeech,
    };
  }

  /**
   * Releases allocated ONNX session resources.
   */
  public async release(): Promise<void> {
    if (this.session && typeof this.session.release === "function") {
      try {
        await this.session.release();
      } catch {
        // ignore release errors
      }
    }
    this.session = null;
    this.status = {
      vadEngine: "fallback-rms-zcr",
      modelLoaded: false,
      modelVersion: "Silero-VAD-v5",
      inferenceAvailable: false,
      error: "Session released",
    };
  }
}
