import type { VADConfig, VADFrameResult, VADLabel, VadDiagnosticStatus } from "./types";
import type { SileroVadBackend } from "./sileroVadBackend";

type ResolvedConfig = Required<VADConfig>;

const DEFAULTS: Omit<ResolvedConfig, "sampleRate"> = {
  frameDurationMs: 20,
  energyThresholdDb: -50,
  noiseAdaptationEnabled: true,
  noiseMarginDb: 12,
  minSpeechFrames: 3,
  hangoverFrames: 8,
  zcrSpeechMin: 0.02,
  zcrSpeechMax: 0.5,
  useSilero: true,
  positiveSpeechThreshold: 0.50,
  negativeSpeechThreshold: 0.35,
  modelPath: "/models/silero_vad.onnx",
};

/** Rate at which the adaptive noise floor moves toward newly observed
 * non-speech energy. Small on purpose — the floor should track slow
 * changes in room noise, not flicker with every quiet frame. */
const NOISE_FLOOR_ADAPTATION_RATE = 0.05;

/**
 * Root-mean-square energy of a frame, in dBFS (0 dBFS = full-scale sine).
 * Returns -Infinity for a frame of exact digital silence.
 */
export function computeRmsDb(frame: Float32Array): number {
  if (frame.length === 0) return -Infinity;
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    sumSquares += frame[i] * frame[i];
  }
  const rms = Math.sqrt(sumSquares / frame.length);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Zero-crossing rate: fraction of adjacent sample pairs that change sign.
 * Voiced/unvoiced speech tends to sit in a mid range; steady tones, DC
 * offset, and some noise sit outside it, so it's used alongside energy
 * rather than on its own.
 */
export function computeZeroCrossingRate(frame: Float32Array): number {
  if (frame.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if (frame[i] >= 0 !== frame[i - 1] >= 0) crossings++;
  }
  return crossings / (frame.length - 1);
}

/** Number of samples an analysis frame should hold, given a sample rate
 * and desired frame duration. */
export function frameSizeForSampleRate(
  sampleRate: number,
  frameDurationMs: number
): number {
  return Math.max(1, Math.round((sampleRate * frameDurationMs) / 1000));
}

/**
 * Stateful per-stream VAD decision engine.
 *
 * Deliberately has no dependency on Web Audio / AudioWorklet — it just
 * consumes Float32Array frames and returns a classification. That keeps it
 * usable from an AudioWorkletProcessor, a ScriptProcessorNode, an offline
 * buffer, or a plain unit test, and keeps the "is this speech" logic in one
 * place instead of duplicated between real-time and test code paths.
 */
export class VadStateMachine {
  private readonly config: ResolvedConfig;
  private noiseFloorDb: number;
  private consecutiveSpeechFrames = 0;
  private consecutiveSilenceFrames = 0;
  private inSpeech = false;
  private frameCount = 0;

  constructor(config: VADConfig) {
    this.config = { ...DEFAULTS, ...config };
    this.noiseFloorDb = this.config.energyThresholdDb;
  }

  /** Clears all running state (as if freshly constructed) without
   * discarding the configuration. Useful when reusing an instance across
   * calls instead of allocating a new one. */
  reset(): void {
    this.consecutiveSpeechFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.inSpeech = false;
    this.frameCount = 0;
    this.noiseFloorDb = this.config.energyThresholdDb;
  }

  /**
   * Classifies one analysis frame and advances internal state.
   * Frames are expected to be `frameSizeForSampleRate(...)` samples long,
   * but any length (including empty, for defensive callers) is handled
   * without throwing.
   */
  processFrame(frame: Float32Array, sileroProbability?: number): VADFrameResult {
    const energyDb = computeRmsDb(frame);
    const zcr = computeZeroCrossingRate(frame);
    const timestampMs = this.frameCount * this.config.frameDurationMs;
    this.frameCount++;

    let isSpeechFrame: boolean;
    let vadEngine: "silero" | "fallback-rms-zcr";

    if (sileroProbability !== undefined && this.config.useSilero !== false) {
      // Authoritative Silero VAD neural probability
      const threshold = this.config.positiveSpeechThreshold ?? 0.50;
      isSpeechFrame = sileroProbability >= threshold;
      vadEngine = "silero";
    } else {
      // Acoustic fallback (RMS dBFS + ZCR)
      const threshold = this.config.noiseAdaptationEnabled
        ? this.noiseFloorDb + this.config.noiseMarginDb
        : this.config.energyThresholdDb;

      const energyIsSpeechLike = energyDb > threshold;
      const zcrIsSpeechLike =
        zcr >= this.config.zcrSpeechMin && zcr <= this.config.zcrSpeechMax;
      isSpeechFrame = energyIsSpeechLike && zcrIsSpeechLike;
      vadEngine = "fallback-rms-zcr";
    }

    if (isSpeechFrame) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveSpeechFrames = 0;
      if (this.config.noiseAdaptationEnabled && Number.isFinite(energyDb)) {
        this.noiseFloorDb =
          this.noiseFloorDb * (1 - NOISE_FLOOR_ADAPTATION_RATE) +
          energyDb * NOISE_FLOOR_ADAPTATION_RATE;
      }
    }

    if (!this.inSpeech && this.consecutiveSpeechFrames >= this.config.minSpeechFrames) {
      this.inSpeech = true;
    } else if (
      this.inSpeech &&
      this.consecutiveSilenceFrames >= this.config.hangoverFrames
    ) {
      this.inSpeech = false;
    }

    const label: VADLabel = this.inSpeech ? "speech" : "silence";

    return { label, energyDb, zcr, isSpeechFrame, timestampMs, sileroProbability, vadEngine };
  }

  /** Whether the smoothed state machine currently considers itself inside
   * a speech segment (post hangover, not the raw per-frame decision). */
  get isInSpeech(): boolean {
    return this.inSpeech;
  }
}

export interface AdaptiveVadConfig extends VADConfig {
  initialWaitMs?: number;
  silenceEndMs?: number;
  minSpeechMs?: number;
  prePaddingMs?: number;
  postPaddingMs?: number;
  maxWaitMs?: number;
}

export interface AdaptiveVADFrameResult extends VADFrameResult {
  sessionState: import("./types").VADSessionState;
  totalSpeechMs: number;
  elapsedMs: number;
}

/**
 * Adaptive VAD Session Engine
 *
 * Implements an adaptive VAD state machine that:
 * 1. Never prematurely rejects users during the first 0–5s of initial silence (WAITING_FOR_SPEECH).
 * 2. Seamlessly transitions:
 *    WAITING_FOR_SPEECH -> SPEECH_DETECTED -> COLLECTING_SPEECH -> SPEECH_COMPLETE -> PROCESSING
 * 3. Handles short inter-word pauses without chunk cutting.
 * 4. Accumulates speech segments in strict chronological order.
 * 5. Only declares INSUFFICIENT_AUDIO after a reasonable overall timeout (maxWaitMs).
 */
export class AdaptiveVadStateMachine {
  private readonly core: VadStateMachine;
  private readonly timingConfig: Required<import("./types").VADTimingConfig>;
  private readonly sampleRate: number;
  private readonly frameDurationMs: number;
  private sileroBackend: SileroVadBackend | null = null;

  private sessionState: import("./types").VADSessionState = "WAITING_FOR_SPEECH";
  private totalSpeechMs = 0;
  private elapsedMs = 0;
  private currentSilenceDurationMs = 0;
  private hasSeenSpeech = false;

  // Chronologically ordered speech pieces (Float32Array)
  private speechSegments: Float32Array[] = [];
  // Rolling pre-speech padding buffer
  private prePaddingBuffer: Float32Array[] = [];
  private prePaddingMaxFrames: number;

  constructor(config: AdaptiveVadConfig, sileroBackend?: SileroVadBackend) {
    this.sampleRate = config.sampleRate;
    this.frameDurationMs = config.frameDurationMs ?? 20;
    this.core = new VadStateMachine(config);
    if (sileroBackend) {
      this.sileroBackend = sileroBackend;
    }

    const initialWaitMs = config.initialWaitMs ?? 5000;
    const silenceEndMs = config.silenceEndMs ?? 800;
    const minSpeechMs = config.minSpeechMs ?? 2000;
    const prePaddingMs = config.prePaddingMs ?? 300;
    const postPaddingMs = config.postPaddingMs ?? 400;
    const maxWaitMs = config.maxWaitMs ?? 15000;

    this.timingConfig = {
      initialWaitMs,
      silenceEndMs,
      minSpeechMs,
      prePaddingMs,
      postPaddingMs,
      maxWaitMs,
    };

    this.prePaddingMaxFrames = Math.max(1, Math.round(prePaddingMs / this.frameDurationMs));
  }

  public setSileroBackend(backend: SileroVadBackend): void {
    this.sileroBackend = backend;
  }

  public getSileroBackend(): SileroVadBackend | null {
    return this.sileroBackend;
  }

  public getVadDiagnosticStatus(): VadDiagnosticStatus {
    if (this.sileroBackend) {
      return this.sileroBackend.getStatus();
    }
    return {
      vadEngine: "fallback-rms-zcr",
      modelLoaded: false,
      modelVersion: "Silero-VAD-v5",
      inferenceAvailable: false,
      error: null,
    };
  }

  public reset(): void {
    this.core.reset();
    this.sileroBackend?.resetState();
    this.sessionState = "WAITING_FOR_SPEECH";
    this.totalSpeechMs = 0;
    this.elapsedMs = 0;
    this.currentSilenceDurationMs = 0;
    this.hasSeenSpeech = false;
    this.speechSegments = [];
    this.prePaddingBuffer = [];
  }

  public getSessionState(): import("./types").VADSessionState {
    return this.sessionState;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public getTotalSpeechMs(): number {
    return this.totalSpeechMs;
  }

  public getElapsedMs(): number {
    return this.elapsedMs;
  }

  public getSpeechPcm(): Float32Array {
    if (this.speechSegments.length === 0) return new Float32Array(0);
    if (this.speechSegments.length === 1) return this.speechSegments[0];

    let totalLen = 0;
    for (const s of this.speechSegments) totalLen += s.length;
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const s of this.speechSegments) {
      merged.set(s, offset);
      offset += s.length;
    }
    return merged;
  }

  public async processFrameWithSilero(frame16k: Float32Array): Promise<AdaptiveVADFrameResult> {
    let sileroProb: number | undefined;
    if (this.sileroBackend?.isAvailable()) {
      try {
        const out = await this.sileroBackend.process(frame16k);
        sileroProb = out.speechProbability;
      } catch (err) {
        console.warn("[VIRA][VAD] Silero inference error, falling back to acoustic gate:", err);
      }
    }
    return this.processFrame(frame16k, sileroProb);
  }

  public processFrame(frame: Float32Array, sileroProbability?: number): AdaptiveVADFrameResult {
    const frameResult = this.core.processFrame(frame, sileroProbability);
    this.elapsedMs += this.frameDurationMs;

    const isSpeech = frameResult.label === "speech";

    if (isSpeech) {
      this.currentSilenceDurationMs = 0;
      this.totalSpeechMs += this.frameDurationMs;

      if (!this.hasSeenSpeech) {
        this.hasSeenSpeech = true;
        this.sessionState = "SPEECH_DETECTED";

        // Flush pre-speech padding buffer in chronological order
        for (const pad of this.prePaddingBuffer) {
          this.speechSegments.push(pad);
        }
        this.prePaddingBuffer = [];
      } else {
        this.sessionState = "COLLECTING_SPEECH";
      }

      // Store speech frame in chronological order
      this.speechSegments.push(frame.slice());
    } else {
      // Non-speech / silence frame
      this.currentSilenceDurationMs += this.frameDurationMs;

      if (!this.hasSeenSpeech) {
        // In the initial silence window
        this.prePaddingBuffer.push(frame.slice());
        if (this.prePaddingBuffer.length > this.prePaddingMaxFrames) {
          this.prePaddingBuffer.shift();
        }

        // Check if overall wait timeout exceeded
        if (this.elapsedMs >= this.timingConfig.maxWaitMs) {
          this.sessionState = "INSUFFICIENT_AUDIO";
        } else {
          // Remain in WAITING_FOR_SPEECH even if 4-5s have passed!
          this.sessionState = "WAITING_FOR_SPEECH";
        }
      } else {
        // Speech was previously detected; we are in a pause or post-speech
        if (this.currentSilenceDurationMs <= this.timingConfig.postPaddingMs) {
          // Retain post-speech padding frames so trailing phonemes aren't clipped
          this.speechSegments.push(frame.slice());
        }

        if (this.currentSilenceDurationMs >= this.timingConfig.silenceEndMs) {
          if (this.totalSpeechMs >= this.timingConfig.minSpeechMs) {
            this.sessionState = "SPEECH_COMPLETE";
          } else if (this.elapsedMs >= this.timingConfig.maxWaitMs) {
            this.sessionState = "INSUFFICIENT_AUDIO";
          } else {
            // Speech was too brief, keep waiting/collecting
            this.sessionState = "WAITING_FOR_SPEECH";
          }
        } else {
          // Brief pause between words: stay in COLLECTING_SPEECH
          this.sessionState = "COLLECTING_SPEECH";
        }
      }
    }

    return {
      ...frameResult,
      sessionState: this.sessionState,
      totalSpeechMs: this.totalSpeechMs,
      elapsedMs: this.elapsedMs,
    };
  }
}
