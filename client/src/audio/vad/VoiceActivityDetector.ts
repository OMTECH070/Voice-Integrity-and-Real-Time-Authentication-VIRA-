import type { VADConfig, VADEvents, VADFrameResult, VADSpeechSegment, VadDiagnosticStatus } from "./types";
import type { WorkletOutboundMessage } from "./vadProcessor.worklet";
import { concatFloat32, resamplePcm } from "./pcm";
import { SileroVadBackend } from "./sileroVadBackend";
import { AdaptiveVadStateMachine } from "./vadCore";
import { SpeechAudioGate } from "./speechAudioGate";

export type VADState = "idle" | "starting" | "running" | "stopped" | "error";

/**
 * Main-thread controller for the VAD subsystem.
 *
 * Owns AudioContext + AudioWorkletNode, resamples microphone audio to 16 kHz,
 * runs real Silero VAD neural network inference, and drives AdaptiveVadStateMachine
 * and SpeechAudioGate to provide robust speech detection and silence gating.
 */
export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private readonly config: Omit<VADConfig, "sampleRate">;
  private readonly events: VADEvents;
  private state: VADState = "idle";
  private currentSegment: VADSpeechSegment | null = null;
  private wasSpeech = false;

  private sileroBackend: SileroVadBackend | null = null;
  private adaptiveStateMachine: AdaptiveVadStateMachine | null = null;
  private speechAudioGate: SpeechAudioGate | null = null;

  // 16 kHz accumulator for 512-sample Silero frames
  private pcm16kBuffer: Float32Array = new Float32Array(0);
  private segmentAudioChunks: Float32Array[] = [];

  constructor(config: Omit<VADConfig, "sampleRate"> = {}, events: VADEvents = {}) {
    this.config = config;
    this.events = events;
  }

  public getState(): VADState {
    return this.state;
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

  /**
   * Attaches the VAD to a live MediaStream and starts classifying frames.
   */
  async start(stream: MediaStream): Promise<void> {
    if (this.state === "running" || this.state === "starting") {
      return;
    }
    this.state = "starting";
    try {
      if (stream.getAudioTracks().length === 0) {
        throw new Error("VoiceActivityDetector: stream has no audio tracks");
      }

      this.audioContext = new AudioContext();
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Initialize Silero VAD neural network backend if enabled (default: true)
      if (this.config.useSilero !== false) {
        this.sileroBackend = new SileroVadBackend({
          positiveSpeechThreshold: this.config.positiveSpeechThreshold,
          negativeSpeechThreshold: this.config.negativeSpeechThreshold,
          modelPath: this.config.modelPath,
        });

        const loaded = await this.sileroBackend.init();
        if (loaded) {
          console.log("[VIRA][VAD] Genuine Silero VAD v5 model successfully loaded.");
        } else {
          console.warn("[VIRA][VAD] Failed to load Silero model, active engine set to fallback-rms-zcr:", this.sileroBackend.getStatus().error);
        }
      }

      // Initialize Adaptive state machine (at 16 kHz standard)
      this.adaptiveStateMachine = new AdaptiveVadStateMachine(
        {
          sampleRate: 16000,
          frameDurationMs: 32, // 512 samples @ 16kHz is 32ms
          ...this.config,
        },
        this.sileroBackend ?? undefined
      );

      // Initialize SpeechAudioGate: 32ms frame, ~300ms pre-roll (10 frames)
      this.speechAudioGate = new SpeechAudioGate({
        frameDurationMs: 32,
        preRollFrames: Math.round(300 / 32),
      });

      const workletUrl = new URL("./vadProcessor.worklet.ts", import.meta.url);
      await this.audioContext.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(this.audioContext, "vad-processor");
      this.workletNode.port.onmessage = async (event: MessageEvent<WorkletOutboundMessage>) => {
        const message = event.data;
        if (message.type === "audioFrame") {
          await this.processIncomingAudio(message.samples, message.timestampMs);
        } else if (message.type === "frame" && (!this.sileroBackend || !this.sileroBackend.isAvailable())) {
          // Acoustic fallback if Silero is unavailable
          this.handleFrame(message.result);
        } else if (message.type === "speechAudio" && (!this.sileroBackend || !this.sileroBackend.isAvailable())) {
          this.handleSpeechAudio(message.samples, message.timestampMs);
        }
      };

      this.workletNode.onprocessorerror = () => {
        this.state = "error";
        this.events.onError?.(new Error("VoiceActivityDetector: worklet processor error"));
      };

      this.workletNode.port.postMessage({
        type: "init",
        config: { ...this.config, sampleRate: this.audioContext.sampleRate },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.workletNode);

      this.state = "running";
    } catch (err) {
      this.state = "error";
      const error = err instanceof Error ? err : new Error(String(err));
      this.events.onError?.(error);
      throw error;
    }
  }

  /**
   * Resamples incoming audio quanta to 16 kHz and executes Silero VAD inference on 512-sample frames.
   */
  private async processIncomingAudio(samples: Float32Array, _timestampMs: number): Promise<void> {
    if (!this.audioContext || !this.adaptiveStateMachine || !this.speechAudioGate) return;

    // Resample native AudioContext rate to 16 kHz for Silero
    const resampled = resamplePcm(samples, this.audioContext.sampleRate, 16000);

    // Buffer into 512-sample frames
    const combined = new Float32Array(this.pcm16kBuffer.length + resampled.length);
    combined.set(this.pcm16kBuffer, 0);
    combined.set(resampled, this.pcm16kBuffer.length);
    this.pcm16kBuffer = combined;

    while (this.pcm16kBuffer.length >= 512) {
      const frame512 = this.pcm16kBuffer.subarray(0, 512);
      this.pcm16kBuffer = this.pcm16kBuffer.slice(512);

      let speechProbability: number | undefined;

      if (this.sileroBackend?.isAvailable()) {
        try {
          const sileroResult = await this.sileroBackend.process(frame512);
          speechProbability = sileroResult.speechProbability;
        } catch (err) {
          console.warn("[VIRA][VAD] Silero inference error:", err);
        }
      }

      const frameResult = this.adaptiveStateMachine.processFrame(frame512, speechProbability);
      this.handleFrame(frameResult);

      // Gate speech audio using SpeechAudioGate
      const inSpeechNow = frameResult.label === "speech";
      const gatedChunks = this.speechAudioGate.push(frame512, inSpeechNow, frameResult.timestampMs);
      for (const chunk of gatedChunks) {
        this.handleSpeechAudio(chunk.samples, chunk.timestampMs);
      }
    }
  }

  private handleFrame(result: VADFrameResult): void {
    this.events.onFrame?.(result);

    const isSpeechNow = result.label === "speech";
    if (isSpeechNow && !this.wasSpeech) {
      const engine = result.vadEngine || "unknown";
      const probStr = result.sileroProbability !== undefined ? ` sileroProb=${result.sileroProbability.toFixed(3)}` : "";
      console.log(`[VIRA][VAD] Speech started at timestamp ${result.timestampMs}ms [${engine}${probStr}] (energy=${result.energyDb.toFixed(1)} dBFS, zcr=${result.zcr.toFixed(3)})`);
      this.currentSegment = { startMs: result.timestampMs, endMs: null };
      this.events.onSpeechStart?.(result.timestampMs);
    } else if (!isSpeechNow && this.wasSpeech && this.currentSegment) {
      this.currentSegment.endMs = result.timestampMs;
      const durationMs = this.currentSegment.endMs - this.currentSegment.startMs;
      console.log(`[VIRA][VAD] Speech ended at timestamp ${result.timestampMs}ms (segment duration: ${durationMs}ms)`);
      if (this.segmentAudioChunks.length > 0) {
        const audio = concatFloat32(this.segmentAudioChunks);
        const sampleRate = this.audioContext?.sampleRate ?? 16000;
        this.currentSegment.audio = audio;
        this.currentSegment.sampleRate = sampleRate;

        this.events.onSpeechSegment?.({
          pcm: audio,
          sampleRate,
          durationMs,
          startMs: this.currentSegment.startMs,
          endMs: this.currentSegment.endMs,
        });
      }
      this.segmentAudioChunks = [];
      this.events.onSpeechEnd?.(this.currentSegment);
      this.currentSegment = null;
    }
    this.wasSpeech = isSpeechNow;
  }

  /**
   * Handles a gated speech-audio chunk from the gate.
   */
  private handleSpeechAudio(samples: Float32Array, timestampMs: number): void {
    this.segmentAudioChunks.push(samples);
    this.events.onSpeechAudioFrame?.({
      samples,
      sampleRate: 16000,
      timestampMs,
    });
  }

  /**
   * Stops classification and releases resources.
   */
  async stop(): Promise<void> {
    if (this.currentSegment && this.segmentAudioChunks.length > 0) {
      const audio = concatFloat32(this.segmentAudioChunks);
      const sampleRate = 16000;
      const endMs = this.currentSegment.startMs + (audio.length / sampleRate) * 1000;
      this.currentSegment.endMs = endMs;
      this.currentSegment.audio = audio;
      this.currentSegment.sampleRate = sampleRate;
      this.events.onSpeechSegment?.({
        pcm: audio,
        sampleRate,
        durationMs: endMs - this.currentSegment.startMs,
        startMs: this.currentSegment.startMs,
        endMs,
      });
      this.events.onSpeechEnd?.(this.currentSegment);
    }

    if (this.sileroBackend) {
      await this.sileroBackend.release();
      this.sileroBackend = null;
    }

    this.sourceNode?.disconnect();
    this.workletNode?.disconnect();
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.onprocessorerror = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
    this.sourceNode = null;
    this.workletNode = null;
    this.audioContext = null;
    this.adaptiveStateMachine = null;
    this.speechAudioGate = null;
    this.wasSpeech = false;
    this.currentSegment = null;
    this.segmentAudioChunks = [];
    this.pcm16kBuffer = new Float32Array(0);
    this.state = "stopped";
  }
}
