import { logger } from "../utils/logger";

export interface RemoteMlAnalysisResult {
  embedding: Float32Array;
  spoofScore: number;
  embeddingDimension: number;
  sampleRate: number;
  sampleCount: number;
  durationSeconds: number;
  inferenceLatencyMs: number;
}

export interface RemoteMlChunkContext {
  callId?: string;
  sequence?: number;
}

interface RailwayAnalyzeResponse {
  status?: string;
  embedding?: number[];
  embedding_dimension?: number;
  spoof_score?: number;
  sample_rate?: number;
  sample_count?: number;
  duration_seconds?: number;
  inference_latency_ms?: number;
}

export class RemoteMlService {
  private readonly defaultTimeoutMs = 2500;

  /** Checks if both VIRA_ML_URL and VIRA_ML_API_KEY are defined. */
  public isConfigured(): boolean {
    const url = process.env.VIRA_ML_URL?.trim();
    const apiKey = process.env.VIRA_ML_API_KEY?.trim();
    return Boolean(url && apiKey);
  }

  public getApiUrl(): string | null {
    const url = process.env.VIRA_ML_URL?.trim();
    if (!url) return null;
    return `${url.replace(/\/+$/, "")}/analyze`;
  }

  /**
   * Dispatches speech audio window to the remote Railway ML service.
   * Returns a typed result if successful, or null on any failure/timeout (triggering local fallback).
   */
  public async analyzeChunk(
    samples: Float32Array,
    sampleRate: number,
    context?: RemoteMlChunkContext
  ): Promise<RemoteMlAnalysisResult | null> {
    const callId = context?.callId ?? "unknown";
    const sequence = context?.sequence ?? 0;

    const url = this.getApiUrl();
    const apiKey = process.env.VIRA_ML_API_KEY?.trim();

    if (!url || !apiKey) {
      return null;
    }

    const startTime = Date.now();
    logger.info(`[VIRA][ML-CLIENT] Railway request started | callId=${callId} | sequence=${sequence}`);

    try {
      // 1. Encode Float32Array to base64 preserving bit fidelity
      const base64Pcm = Buffer.from(
        samples.buffer,
        samples.byteOffset,
        samples.byteLength
      ).toString("base64");

      // 2. Dispatch with AbortSignal.timeout(2500)
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          sample_rate: sampleRate,
          pcm_base64: base64Pcm,
          pcm_format: "f32le",
        }),
        signal: AbortSignal.timeout(this.defaultTimeoutMs),
      });

      if (!response.ok) {
        await response.text().catch(() => "");
        logger.warn(
          `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=HTTP ${response.status} ${response.statusText}`
        );
        return null;
      }

      // 3. Parse and validate JSON schema
      const data = (await response.json()) as RailwayAnalyzeResponse | null;

      if (!data || typeof data !== "object") {
        logger.warn(
          `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=Invalid JSON response`
        );
        return null;
      }

      if (data.status !== "success") {
        logger.warn(
          `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=Status not success (${data.status})`
        );
        return null;
      }

      if (!Array.isArray(data.embedding) || data.embedding.length !== 192) {
        logger.warn(
          `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=Invalid embedding dimension (expected 192, got ${data.embedding?.length})`
        );
        return null;
      }

      const spoofScore = Number(data.spoof_score);
      if (!Number.isFinite(spoofScore) || spoofScore < 0 || spoofScore > 1) {
        logger.warn(
          `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=Invalid spoof score (${data.spoof_score})`
        );
        return null;
      }

      const latencyMs = Date.now() - startTime;
      logger.info(
        `[VIRA][ML-CLIENT] Railway inference successful | callId=${callId} | sequence=${sequence} | latencyMs=${latencyMs}`
      );

      return {
        embedding: new Float32Array(data.embedding),
        spoofScore,
        embeddingDimension: data.embedding.length,
        sampleRate: data.sample_rate ?? sampleRate,
        sampleCount: data.sample_count ?? samples.length,
        durationSeconds: data.duration_seconds ?? samples.length / sampleRate,
        inferenceLatencyMs: data.inference_latency_ms ?? latencyMs,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.name === "TimeoutError" ? "Request timeout (2500ms exceeded)" : err.message : String(err);
      logger.warn(
        `[VIRA][ML-CLIENT] Railway inference failed | callId=${callId} | sequence=${sequence} | reason=${errorMsg}`
      );
      return null;
    }
  }
}

export const remoteMlService = new RemoteMlService();
