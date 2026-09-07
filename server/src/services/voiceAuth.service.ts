import fs from "fs";
import path from "path";
import { InferenceSession, Tensor } from "onnxruntime-node";
import { resampleLinear } from "../audio/voiceLiveness/resample";
import { logger } from "../utils/logger";
import { supabaseAdmin } from "./supabaseAdmin";

const MODEL_NAME = "ECAPA-TDNN";
const MODEL_VERSION = "ECAPA-TDNN-v1";
const EMBEDDING_DIMENSION = 192;
const REQUIRED_SAMPLE_RATE = 16000;
const MIN_SPEECH_DURATION_SEC = 2.0;

// Configurable verification thresholds via environment or calibrated defaults
export function getEcapaThresholds() {
  const matchThreshold = Number(process.env.ECAPA_MATCH_THRESHOLD ?? "0.85");
  const mismatchThreshold = Number(process.env.ECAPA_MISMATCH_THRESHOLD ?? "0.70");
  const uncertainThreshold = Number(process.env.ECAPA_UNCERTAIN_THRESHOLD ?? "0.75");
  return { matchThreshold, mismatchThreshold, uncertainThreshold };
}

export type SpeakerMatchLabel = "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled";
export type VerificationDecision = "MATCH" | "MISMATCH" | "UNCERTAIN" | "INSUFFICIENT_AUDIO";

export interface EnrolledVoiceProfile {
  userId: string;
  embedding: Float32Array;
  embeddingModel?: string;
  embeddingVersion?: string;
  modelVersion?: string;
  embeddingDimension?: number;
  enrollmentStatus?: "enrolled" | "not-enrolled" | "pending";
  sampleDurationSeconds?: number;
  enrolledAt?: string;
  updatedAt?: string;
}

export interface VerificationResult {
  similarity: number;
  match: boolean;
  decision: VerificationDecision;
  label: SpeakerMatchLabel;
  modelVersion: string;
  dimension: number;
  confidence: number;
  details?: string;
}

export interface EnrollmentResult {
  success: boolean;
  embedding?: Float32Array;
  embeddingDimension?: number;
  sampleDurationSeconds: number;
  modelVersion: string;
  enrolledAt?: string;
  error?: string;
}

/**
 * Service managing ECAPA-TDNN speaker embedding extraction, L2 normalization,
 * and cosine similarity speaker verification.
 */
export class VoiceAuthService {
  private session: InferenceSession | null = null;
  private isInitialized = false;
  private isModelAvailable = false;
  private initError: string | null = null;

  // In-memory cache of enrolled speaker profiles by user_id
  private enrolledProfiles = new Map<string, EnrolledVoiceProfile>();

  constructor() {
    this.init();
  }

  private resolveModelPath(): string | null {
    const envPath = process.env.VIRA_ECAPA_MODEL_PATH;
    const candidates = [
      ...(envPath ? [path.resolve(envPath)] : []),
      path.resolve(process.cwd(), "models/ecapa.onnx"),
      path.resolve(process.cwd(), "server/models/ecapa.onnx"),
      path.resolve(__dirname, "../../models/ecapa.onnx"),
      path.resolve(__dirname, "../../../models/ecapa.onnx"),
      path.resolve(__dirname, "../../../../models/ecapa.onnx"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  public async init(): Promise<boolean> {
    if (this.isInitialized && this.session) return true;

    const modelPath = this.resolveModelPath();
    if (!modelPath) {
      this.isInitialized = true;
      this.isModelAvailable = false;
      this.initError =
        "ECAPA-TDNN model file (ecapa.onnx) not found in server/models/. Place an ONNX-exported ECAPA-TDNN model at server/models/ecapa.onnx to enable real-world speaker embedding extraction.";
      logger.warn(`VoiceAuthService: ${this.initError}`);
      return false;
    }

    try {
      this.session = await InferenceSession.create(modelPath);
      this.isInitialized = true;
      this.isModelAvailable = true;
      this.initError = null;
      logger.info(`VoiceAuthService: ECAPA-TDNN model loaded successfully from ${modelPath}`);
      return true;
    } catch (err) {
      this.isInitialized = true;
      this.isModelAvailable = false;
      this.initError = err instanceof Error ? err.message : String(err);
      logger.error(`VoiceAuthService: Failed to load ECAPA-TDNN model: ${this.initError}`);
      return false;
    }
  }

  public isReady(): boolean {
    return this.isModelAvailable && this.session !== null;
  }

  public getModelStatus(): {
    available: boolean;
    modelName: string;
    modelVersion: string;
    dimension: number;
    error: string | null;
  } {
    return {
      available: this.isModelAvailable,
      modelName: MODEL_NAME,
      modelVersion: MODEL_VERSION,
      dimension: EMBEDDING_DIMENSION,
      error: this.initError,
    };
  }

  /**
   * L2-normalizes an embedding vector.
   * v_norm = v / sqrt(sum(v_i^2) + eps)
   */
  public l2Normalize(vec: Float32Array): Float32Array {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq) + 1e-12;
    const normalized = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      normalized[i] = vec[i] / norm;
    }
    return normalized;
  }

  /**
   * Computes cosine similarity between two speaker embeddings.
   * Both vectors should be non-empty and matching dimension.
   */
  public computeCosineSimilarity(
    a: Float32Array | number[],
    b: Float32Array | number[]
  ): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const valA = a[i];
      const valB = b[i];
      dot += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator < 1e-12) return 0;

    const similarity = dot / denominator;
    return Math.min(1.0, Math.max(-1.0, similarity));
  }

  /**
   * Extracts a normalized 192-dim speaker embedding from speech PCM audio.
   */
  public async extractEmbedding(
    samples: Float32Array,
    sampleRate: number
  ): Promise<Float32Array> {
    if (!this.session || !this.isModelAvailable) {
      throw new Error(this.initError ?? "ECAPA-TDNN model is not loaded");
    }

    if (samples.length === 0) {
      throw new Error("Cannot extract embedding from empty audio buffer");
    }

    // 1. Resample to 16 kHz
    const resampled =
      sampleRate === REQUIRED_SAMPLE_RATE
        ? samples
        : resampleLinear(samples, sampleRate, REQUIRED_SAMPLE_RATE);

    // 2. Format tensor [1, num_samples]
    const inputTensor = new Tensor("float32", resampled, [1, resampled.length]);
    const inputName = this.session.inputNames[0] ?? "input";

    const outputs = await this.session.run({ [inputName]: inputTensor });
    const outputName = this.session.outputNames[0] ?? "embedding";
    const rawOutput = outputs[outputName];

    if (!rawOutput) {
      throw new Error(`ECAPA model produced no output tensor for "${outputName}"`);
    }

    const rawData = rawOutput.data as Float32Array;
    return this.l2Normalize(rawData);
  }

  /**
   * Enrolls a user with speech PCM samples.
   * Stricly requires genuine ECAPA-TDNN inference; never fabricates fake/random vectors.
   */
  public async enrollUser(
    userId: string,
    samples: Float32Array,
    sampleRate: number,
    sampleDurationSeconds: number,
    allowOverwrite: boolean = false
  ): Promise<EnrollmentResult> {
    if (!userId) {
      return { success: false, sampleDurationSeconds, modelVersion: MODEL_VERSION, error: "User ID is required" };
    }

    if (this.enrolledProfiles.has(userId) && !allowOverwrite) {
      return {
        success: false,
        sampleDurationSeconds,
        modelVersion: MODEL_VERSION,
        error: "Voice profile already exists. Explicit confirmation required to overwrite.",
      };
    }

    if (samples.length === 0 || sampleDurationSeconds < MIN_SPEECH_DURATION_SEC) {
      return {
        success: false,
        sampleDurationSeconds,
        modelVersion: MODEL_VERSION,
        error: `Insufficient speech duration for voice enrollment (minimum ${MIN_SPEECH_DURATION_SEC}s required)`,
      };
    }

    try {
      if (!this.isReady()) {
        await this.init();
      }

      if (!this.isModelAvailable) {
        return {
          success: false,
          sampleDurationSeconds,
          modelVersion: MODEL_VERSION,
          error: this.initError ?? "ECAPA-TDNN model is not configured on server",
        };
      }

      const embedding = await this.extractEmbedding(samples, sampleRate);
      const nowIso = new Date().toISOString();

      const profile: EnrolledVoiceProfile = {
        userId,
        embedding,
        embeddingModel: MODEL_NAME,
        embeddingVersion: MODEL_VERSION,
        embeddingDimension: embedding.length,
        enrollmentStatus: "enrolled",
        sampleDurationSeconds,
        enrolledAt: nowIso,
        updatedAt: nowIso,
      };

      this.enrolledProfiles.set(userId, profile);
      logger.info(`VoiceAuthService: Enrolled voice profile for user ${userId} (${embedding.length}-dim)`);

      if (supabaseAdmin) {
        try {
          await (supabaseAdmin as any)
            .from("voice_profiles")
            .upsert(
              {
                user_id: userId,
                embedding: Array.from(embedding),
                sample_duration_seconds: sampleDurationSeconds,
                model_version: MODEL_VERSION,
                enrolled_at: nowIso,
                updated_at: nowIso,
              },
              { onConflict: "user_id" }
            );
          logger.info(`VoiceAuthService: Persisted enrolled voice profile to database for user ${userId}`);
        } catch (dbErr) {
          logger.warn(`VoiceAuthService: Could not persist voice profile to database for user ${userId}: ${dbErr}`);
        }
      }

      return {
        success: true,
        embedding,
        embeddingDimension: embedding.length,
        sampleDurationSeconds,
        modelVersion: MODEL_VERSION,
        enrolledAt: nowIso,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        sampleDurationSeconds,
        modelVersion: MODEL_VERSION,
        error: errorMsg,
      };
    }
  }

  public hasProfile(userId: string): boolean {
    return this.enrolledProfiles.has(userId);
  }

  public deleteProfile(userId: string): boolean {
    return this.enrolledProfiles.delete(userId);
  }

  public setEnrolledProfile(
    userId: string,
    embeddingOrProfile: Float32Array | number[] | Partial<EnrolledVoiceProfile>
  ): void {
    const nowIso = new Date().toISOString();
    let rawVec: Float32Array;

    if (embeddingOrProfile instanceof Float32Array) {
      rawVec = embeddingOrProfile;
    } else if (Array.isArray(embeddingOrProfile)) {
      rawVec = new Float32Array(embeddingOrProfile);
    } else if (embeddingOrProfile && typeof embeddingOrProfile === "object" && "embedding" in embeddingOrProfile && embeddingOrProfile.embedding) {
      rawVec = embeddingOrProfile.embedding instanceof Float32Array
        ? embeddingOrProfile.embedding
        : new Float32Array(embeddingOrProfile.embedding);
    } else {
      rawVec = new Float32Array(EMBEDDING_DIMENSION);
    }

    const normalized = this.l2Normalize(rawVec);
    const profile: EnrolledVoiceProfile = {
      userId,
      embedding: normalized,
      embeddingModel: MODEL_NAME,
      embeddingVersion: MODEL_VERSION,
      embeddingDimension: normalized.length,
      enrollmentStatus: "enrolled",
      sampleDurationSeconds: 3.0,
      enrolledAt: nowIso,
      updatedAt: nowIso,
    };

    this.enrolledProfiles.set(userId, profile);
  }

  public getEnrolledProfile(userId: string): Float32Array | null {
    const profile = this.enrolledProfiles.get(userId);
    return profile ? profile.embedding : null;
  }

  public async getEnrolledProfileAsync(userId: string): Promise<Float32Array | null> {
    const memory = this.getEnrolledProfile(userId);
    if (memory) return memory;

    if (!supabaseAdmin) return null;

    try {
      // Check voice_profiles table
      const { data: vpData } = await (supabaseAdmin as any)
        .from("voice_profiles")
        .select("embedding")
        .eq("user_id", userId)
        .maybeSingle();

      if (vpData?.embedding && Array.isArray(vpData.embedding)) {
        this.setEnrolledProfile(userId, vpData.embedding);
        logger.info(`VoiceAuthService: Loaded enrolled voice profile for ${userId} from voice_profiles table`);
        return this.getEnrolledProfile(userId);
      }
    } catch (err) {
      logger.warn(`VoiceAuthService: Database lookup failed for user ${userId}: ${err}`);
    }

    return null;
  }

  public getFullEnrolledProfile(userId: string): EnrolledVoiceProfile | null {
    return this.enrolledProfiles.get(userId) ?? null;
  }

  /**
   * Verifies incoming speaker audio embedding against the expected enrolled identity.
   * Strictly avoids comparing against every database user unless an explicit identification
   * mode is requested.
   *
   * Thresholds:
   * - similarity >= MATCH_THRESHOLD: MATCH (match = true)
   * - similarity < MISMATCH_THRESHOLD: MISMATCH (match = false)
   * - between MISMATCH and MATCH: UNCERTAIN (match = false) - Never false match.
   */
  public verifySpeaker(
    enrolled: Float32Array | number[] | { embedding: Float32Array | number[] },
    currentEmbedding: Float32Array | number[],
    speechDurationSec?: number
  ): VerificationResult {
    const { matchThreshold, mismatchThreshold, uncertainThreshold } = getEcapaThresholds();

    // Check for insufficient audio
    if (!currentEmbedding || currentEmbedding.length === 0 || (speechDurationSec !== undefined && speechDurationSec < 0.5)) {
      return {
        similarity: 0,
        match: false,
        decision: "INSUFFICIENT_AUDIO",
        label: "uncertain",
        modelVersion: MODEL_VERSION,
        dimension: currentEmbedding ? currentEmbedding.length : 0,
        confidence: 0,
        details: "Insufficient speech duration for speaker verification",
      };
    }

    const enrolledEmbedding =
      enrolled && typeof enrolled === "object" && "embedding" in enrolled
        ? enrolled.embedding
        : (enrolled as Float32Array | number[]);

    const similarity = this.computeCosineSimilarity(enrolledEmbedding, currentEmbedding);

    let decision: VerificationDecision;
    let label: SpeakerMatchLabel;
    let confidence: number;

    if (similarity >= matchThreshold) {
      decision = "MATCH";
      label = "match";
      confidence = Math.min(1.0, (similarity - matchThreshold) / (1.0 - matchThreshold) * 0.5 + 0.5);
    } else if (similarity >= uncertainThreshold) {
      decision = "UNCERTAIN";
      label = "likely-match";
      confidence = 0.5;
    } else if (similarity < mismatchThreshold) {
      decision = "MISMATCH";
      label = "mismatch";
      confidence = Math.min(1.0, (mismatchThreshold - similarity) / mismatchThreshold * 0.5 + 0.5);
    } else {
      decision = "UNCERTAIN";
      label = "uncertain";
      confidence = 0.4;
    }

    return {
      similarity,
      match: decision === "MATCH",
      decision,
      label,
      modelVersion: MODEL_VERSION,
      dimension: currentEmbedding.length,
      confidence,
      details: `Similarity ${(similarity * 100).toFixed(1)}% (Match >= ${(matchThreshold * 100).toFixed(0)}%, Mismatch < ${(mismatchThreshold * 100).toFixed(0)}%)`,
    };
  }
}

export const voiceAuthService = new VoiceAuthService();
