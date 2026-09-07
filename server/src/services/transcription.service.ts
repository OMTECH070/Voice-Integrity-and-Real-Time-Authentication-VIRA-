import { logger } from "../utils/logger";

export type TranscriptionProvider = "deepgram" | "whisper" | "groq" | "gemini" | "mock" | "local";

export interface TranscriptSegment {
  id?: string;
  callId: string;
  speakerId?: string;
  speakerDirection: "local" | "remote";
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence?: number;
  createdAt: string;
}

export interface TranscriptionConfig {
  provider?: TranscriptionProvider;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export interface TranscriptionResult {
  success: boolean;
  segment?: TranscriptSegment;
  provider: TranscriptionProvider;
  model: string;
  error?: string;
}

/**
 * Converts Float32Array PCM samples (range -1.0 to 1.0) to signed 16-bit
 * little-endian linear16 PCM buffer for Deepgram raw audio ingestion.
 */
export function float32ToLinear16Pcm(samples: Float32Array): Buffer {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
}

/**
 * Real-Time Call Audio Transcription Service integrating Deepgram's pre-recorded
 * /v1/listen API for speech window transcription.
 */
export class TranscriptionService {
  private provider: TranscriptionProvider;
  private apiKey: string | null = null;
  private model: string;
  private fetchFn: typeof fetch;
  private callTranscripts = new Map<string, TranscriptSegment[]>();
  private callQueues = new Map<string, Promise<void>>();

  constructor(config?: TranscriptionConfig) {
    this.provider =
      config?.provider ??
      (process.env.TRANSCRIPTION_PROVIDER as TranscriptionProvider) ??
      (process.env.DEEPGRAM_API_KEY ? "deepgram" : "mock");
    this.apiKey =
      config?.apiKey ??
      process.env.DEEPGRAM_API_KEY ??
      process.env.TRANSCRIPTION_API_KEY ??
      null;
    this.model =
      config?.model ??
      process.env.TRANSCRIPTION_MODEL ??
      (this.provider === "deepgram" ? "nova-2" : this.provider === "whisper" ? "whisper-1" : "mock-v1");
    this.fetchFn = config?.fetchFn ?? globalThis.fetch;
  }

  public getProviderStatus(): {
    provider: TranscriptionProvider;
    model: string;
    hasApiKey: boolean;
    ready: boolean;
  } {
    const requiresKey =
      this.provider === "deepgram" ||
      this.provider === "whisper" ||
      this.provider === "groq" ||
      this.provider === "gemini";
    return {
      provider: this.provider,
      model: this.model,
      hasApiKey: !!this.apiKey,
      ready: requiresKey ? !!this.apiKey : true,
    };
  }

  /**
   * Transcribes a chunk of speech audio using Deepgram /v1/listen API or configured provider.
   * Serializes requests per callId to maintain chronological transcript integrity.
   */
  public async transcribeSpeechChunk(
    callId: string,
    samples: Float32Array,
    sampleRate: number,
    startTimeMs: number,
    endTimeMs: number,
    speakerDirection: "local" | "remote" = "remote",
    speakerId?: string
  ): Promise<TranscriptionResult> {
    // Check for empty audio
    if (!samples || samples.length === 0) {
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        error: "Audio buffer is empty",
      };
    }

    // Check API key requirement
    if (
      (this.provider === "deepgram" ||
        this.provider === "whisper" ||
        this.provider === "groq" ||
        this.provider === "gemini") &&
      !this.apiKey
    ) {
      logger.warn(`TranscriptionService: ${this.provider} requires DEEPGRAM_API_KEY. Set in server/.env.`);
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        error: "REQUIRES_EXTERNAL_API_KEY: DEEPGRAM_API_KEY not configured",
      };
    }

    // Serialize per-call execution to preserve segment ordering
    const previousTask = this.callQueues.get(callId) ?? Promise.resolve();

    const currentTask = (async () => {
      await previousTask.catch(() => {});
      return this.executeTranscription(
        callId,
        samples,
        sampleRate,
        startTimeMs,
        endTimeMs,
        speakerDirection,
        speakerId
      );
    })();

    this.callQueues.set(
      callId,
      currentTask.then(() => {}).catch(() => {})
    );

    return currentTask;
  }

  private async executeTranscription(
    callId: string,
    samples: Float32Array,
    sampleRate: number,
    startTimeMs: number,
    endTimeMs: number,
    speakerDirection: "local" | "remote",
    speakerId?: string
  ): Promise<TranscriptionResult> {
    const createdAt = new Date().toISOString();
    let recognizedText = "";
    let confidence = 0.95;

    if (this.provider === "mock") {
      recognizedText = "";
    } else if (this.provider === "deepgram") {
      try {
        const rawPcmBuffer = float32ToLinear16Pcm(samples);
        const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(
          this.model
        )}&smart_format=true&language=en&encoding=linear16&sample_rate=${sampleRate}`;

        const response = await this.fetchFn(url, {
          method: "POST",
          headers: {
            Authorization: `Token ${this.apiKey}`,
            "Content-Type": "audio/raw",
          },
          body: rawPcmBuffer,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          logger.warn(
            `Deepgram API returned HTTP ${response.status} ${response.statusText} for call ${callId}: ${errorBody.slice(0, 200)}`
          );
          return {
            success: false,
            provider: this.provider,
            model: this.model,
            error: `Deepgram API HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const data: any = await response.json();
        const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
        recognizedText =
          typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
        confidence = typeof alternative?.confidence === "number" ? alternative.confidence : 0.0;

        logger.info(
          `[VIRA][DEEPGRAM] Transcription request completed | callId=${callId} | chars=${recognizedText.length} | confidence=${confidence.toFixed(2)}`
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`Deepgram API network error on call ${callId}: ${errMsg}`);
        return {
          success: false,
          provider: this.provider,
          model: this.model,
          error: errMsg,
        };
      }
    } else {
      // Unimplemented / other external provider fallback
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        error: `Provider ${this.provider} is not currently configured`,
      };
    }

    const segment: TranscriptSegment = {
      callId,
      speakerId,
      speakerDirection,
      text: recognizedText,
      startTimeMs,
      endTimeMs,
      confidence,
      createdAt,
    };

    let segments = this.callTranscripts.get(callId);
    if (!segments) {
      segments = [];
      this.callTranscripts.set(callId, segments);
    }
    segments.push(segment);

    return {
      success: true,
      segment,
      provider: this.provider,
      model: this.model,
    };
  }

  /**
   * Append a completed text segment directly (e.g. from speech recognition or test fixtures).
   */
  public addTranscriptSegment(segment: TranscriptSegment): void {
    let segments = this.callTranscripts.get(segment.callId);
    if (!segments) {
      segments = [];
      this.callTranscripts.set(segment.callId, segments);
    }
    segments.push(segment);
  }

  public getCallTranscript(callId: string): TranscriptSegment[] {
    return this.callTranscripts.get(callId) ?? [];
  }

  public clearCallTranscript(callId: string): void {
    this.callTranscripts.delete(callId);
    this.callQueues.delete(callId);
  }
}

export const transcriptionService = new TranscriptionService();
