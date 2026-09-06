import fs from "fs";
import path from "path";
import { OnnxNodeVoiceLivenessBackend } from "../audio/voiceLiveness/adapters/onnxNodeBackend";
import { resampleLinear } from "../audio/voiceLiveness/resample";
import { logger } from "../utils/logger";
import { wav2vec2AntiSpoof } from "../audio/voiceLiveness/wav2vec2AntiSpoof";

const MODEL_VERSION = "AASIST-v1";
const REQUIRED_SAMPLE_RATE = 16000;
const REQUIRED_INPUT_LENGTH = 64600; // 64,600 samples @ 16kHz (~4.0375 seconds)
const DEFAULT_SPOOF_THRESHOLD = 0.70;
const DEFAULT_UNCERTAINTY_BAND = 0.15;

export interface AnalysisWindowRequest {
  callId: string;
  speakerDirection: "local" | "remote";
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  samples: Float32Array;
  sampleRate: number;
}

export interface AnalysisWindowResponse {
  callId: string;
  speakerDirection: "local" | "remote";
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  processingLatencyMs: number;
  status: "analyzed" | "error";
  spoofScore: number;
  label: "live" | "likely-synthetic" | "uncertain";
  modelVersion: string;
  wav2vec2Score?: number | null;
  wav2vec2Status?: string;
  error?: string;
}

/**
 * Service managing singleton AASIST model lifecycle, asynchronous inference execution,
 * and per-call queue backpressure.
 */
export class VoiceLivenessService {
  private backend: OnnxNodeVoiceLivenessBackend | null = null;
  private isInitialized = false;
  private initError: string | null = null;

  /** Per-call FIFO queue with matching request-callback pairs to prevent callback drops. */
  private queuePerCall = new Map<
    string,
    Array<{
      request: AnalysisWindowRequest;
      onComplete: (response: AnalysisWindowResponse) => void;
    }>
  >();
  private activePerCall = new Set<string>();

  constructor() {
    this.init();
  }

  private resolveModelPath(): string | null {
    const envPath = process.env.VIRA_AASIST_MODEL_PATH;
    const candidates = [
      ...(envPath ? [path.resolve(envPath)] : []),
      path.resolve(process.cwd(), "models/aasist.onnx"),
      path.resolve(process.cwd(), "server/models/aasist.onnx"),
      path.resolve(__dirname, "../../models/aasist.onnx"),
      path.resolve(__dirname, "../../../models/aasist.onnx"),
      path.resolve(__dirname, "../../../../models/aasist.onnx"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  public init(): boolean {
    if (this.isInitialized && this.backend) return true;

    try {
      const modelPath = this.resolveModelPath();
      if (!modelPath) {
        this.initError = "AASIST model file (aasist.onnx) not found in expected model paths.";
        logger.warn(`VoiceLivenessService: ${this.initError}`);
        return false;
      }

      this.backend = new OnnxNodeVoiceLivenessBackend({
        antispoofModelPath: modelPath,
        antispoofInputName: "input",
        antispoofOutputName: "spoof_prob",
        antispoofRequiredInputLength: REQUIRED_INPUT_LENGTH,
        spoofThreshold: DEFAULT_SPOOF_THRESHOLD,
        uncertaintyBand: DEFAULT_UNCERTAINTY_BAND,
      });

      this.isInitialized = true;
      this.initError = null;
      logger.info(`VoiceLivenessService: AASIST backend configured using model at ${modelPath}`);
      return true;
    } catch (err) {
      this.initError = err instanceof Error ? err.message : String(err);
      logger.error(`VoiceLivenessService initialization failed: ${this.initError}`);
      return false;
    }
  }

  /**
   * Queue an analysis request for a speech window.
   * Emits the result via callback once inference completes.
   */
  public enqueueAnalysis(
    request: AnalysisWindowRequest,
    onComplete: (response: AnalysisWindowResponse) => void
  ): void {
    const { callId } = request;
    if (!this.queuePerCall.has(callId)) {
      this.queuePerCall.set(callId, []);
    }

    const queue = this.queuePerCall.get(callId)!;
    // Bound the queue to prevent memory backlog if inference is slower than stride
    if (queue.length >= 2) {
      queue.shift(); // Drop older unstarted request in favor of freshest speech window
    }
    queue.push({ request, onComplete });

    this.processNext(callId);
  }

  private async processNext(callId: string): Promise<void> {
    if (this.activePerCall.has(callId)) {
      return;
    }

    const queue = this.queuePerCall.get(callId);
    if (!queue || queue.length === 0) {
      this.queuePerCall.delete(callId);
      return;
    }

    const item = queue.shift()!;
    this.activePerCall.add(callId);

    try {
      const result = await this.executeInference(item.request);
      item.onComplete(result);
    } catch (err) {
      logger.error(`AASIST queue processing error for call ${callId}: ${err}`);
    } finally {
      this.activePerCall.delete(callId);
      // Process next queued window if available
      this.processNext(callId);
    }
  }

  /**
   * Performs the actual audio resampling and ONNX model execution.
   */
  public async executeInference(request: AnalysisWindowRequest): Promise<AnalysisWindowResponse> {
    const startTime = Date.now();
    const {
      callId,
      speakerDirection,
      sequenceNumber,
      timestampMs,
      durationMs,
      samples,
      sampleRate,
    } = request;

    if (!this.backend || !this.isInitialized) {
      const ok = this.init();
      if (!ok || !this.backend) {
        return {
          callId,
          speakerDirection,
          sequenceNumber,
          timestampMs,
          durationMs,
          processingLatencyMs: Date.now() - startTime,
          status: "error",
          spoofScore: 0.5,
          label: "uncertain",
          modelVersion: MODEL_VERSION,
          error: this.initError ?? "AASIST model backend is not initialized",
        };
      }
    }

    try {
      // 1. Resample to AASIST required 16,000 Hz if needed
      const resampledSamples =
        sampleRate === REQUIRED_SAMPLE_RATE
          ? samples
          : resampleLinear(samples, sampleRate, REQUIRED_SAMPLE_RATE);

      // Compute acoustic metrics
      let sum = 0;
      let sumSq = 0;
      let peak = 0;
      let min = Infinity;
      let max = -Infinity;
      let zeroCount = 0;

      for (let i = 0; i < resampledSamples.length; i++) {
        const val = resampledSamples[i];
        if (val < min) min = val;
        if (val > max) max = val;
        const abs = Math.abs(val);
        if (abs > peak) peak = abs;
        if (val === 0) zeroCount++;
        sum += val;
        sumSq += val * val;
      }
      const mean = sum / (resampledSamples.length || 1);
      const rms = Math.sqrt(sumSq / (resampledSamples.length || 1));
      const isNonZeroSpeech = peak > 1e-4;

      const first10 = Array.from(resampledSamples.slice(0, 10)).map((v) => Number(v.toFixed(4)));
      const last10 = Array.from(resampledSamples.slice(-10)).map((v) => Number(v.toFixed(4)));

      console.log(`[VIRA][AASIST] inference started #${sequenceNumber}`);
      console.log(
        `[VIRA][AASIST] window=${sequenceNumber} callId=${callId} dir=${speakerDirection} ` +
          `sampleRateBefore=${sampleRate}Hz sampleRateAfter=${REQUIRED_SAMPLE_RATE}Hz ` +
          `sampleCount=${resampledSamples.length} duration=${(durationMs / 1000).toFixed(2)}s ` +
          `min=${min === Infinity ? 0 : min.toFixed(5)} max=${max === -Infinity ? 0 : max.toFixed(5)} ` +
          `mean=${mean.toFixed(5)} rms=${rms.toFixed(5)} peak=${peak.toFixed(5)} ` +
          `zeroCount=${zeroCount} nonZeroSpeech=${isNonZeroSpeech} ` +
          `inputShape=[1, ${resampledSamples.length}]`
      );
      console.log(`[VIRA][AASIST] window=${sequenceNumber} first10Samples=${JSON.stringify(first10)}`);
      console.log(`[VIRA][AASIST] window=${sequenceNumber} last10Samples=${JSON.stringify(last10)}`);

      // 2. Execute inference via OnnxNodeVoiceLivenessBackend
      const result = await this.backend.analyze({
        samples: resampledSamples,
        sampleRate: REQUIRED_SAMPLE_RATE,
        startMs: timestampMs,
        endMs: timestampMs + durationMs,
      });

      const processingLatencyMs = Date.now() - startTime;
      console.log(`[VIRA][AASIST] inference completed #${sequenceNumber}`);
      console.log(
        `[VIRA][AASIST] window=${sequenceNumber} rawOutputTensorShape=${JSON.stringify(result.rawOutputShape ?? [1, 1])} ` +
          `rawOutputValues=${JSON.stringify(result.rawOutputValues ?? [result.spoofScore])} ` +
          `extractedSpoofScore=${result.spoofScore.toFixed(4)} (${Math.round(result.spoofScore * 100)}%)`
      );

      const wav2vec2Result = await wav2vec2AntiSpoof.analyzeSpeech(samples, sampleRate);

      return {
        callId,
        speakerDirection,
        sequenceNumber,
        timestampMs,
        durationMs,
        processingLatencyMs,
        status: "analyzed",
        spoofScore: result.spoofScore,
        label: result.label,
        modelVersion: MODEL_VERSION,
        wav2vec2Score: wav2vec2Result.spoofScore,
        wav2vec2Status: wav2vec2Result.status,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`AASIST inference error for call ${callId}, window #${sequenceNumber}: ${errorMsg}`);

      return {
        callId,
        speakerDirection,
        sequenceNumber,
        timestampMs,
        durationMs,
        processingLatencyMs: Date.now() - startTime,
        status: "error",
        spoofScore: 0.5,
        label: "uncertain",
        modelVersion: MODEL_VERSION,
        error: errorMsg,
      };
    }
  }

  /**
   * Direct synchronous analysis of audio samples for validation and testing.
   */
  public async analyze(
    samples: Float32Array,
    sampleRate: number
  ): Promise<{
    spoofScore: number;
    label: "live" | "likely-synthetic" | "uncertain";
    processingLatencyMs: number;
    error?: string;
  }> {
    const res = await this.executeInference({
      callId: "direct-analysis",
      speakerDirection: "remote",
      sequenceNumber: 0,
      timestampMs: Date.now(),
      durationMs: (samples.length / sampleRate) * 1000,
      samples,
      sampleRate,
    });
    return {
      spoofScore: res.spoofScore,
      label: res.label,
      processingLatencyMs: res.processingLatencyMs,
      error: res.error,
    };
  }

  public getBackend(): OnnxNodeVoiceLivenessBackend | null {
    return this.backend;
  }

  public isReady(): boolean {
    return this.isInitialized && this.backend !== null;
  }

  public getModelStatus(): {
    available: boolean;
    modelVersion: string;
    modelPath: string | null;
    error: string | null;
  } {
    return {
      available: this.isReady(),
      modelVersion: MODEL_VERSION,
      modelPath: this.resolveModelPath(),
      error: this.initError,
    };
  }

  /**
   * Cleans up queued and active state when a call session ends.
   */
  public cleanupSession(callId: string): void {
    this.queuePerCall.delete(callId);
    this.activePerCall.delete(callId);
  }
}

export const voiceLivenessService = new VoiceLivenessService();
