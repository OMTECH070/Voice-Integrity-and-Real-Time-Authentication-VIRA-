import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  VoiceAnalysisChunkPayload,
  VoiceEnrollPayload,
} from "../types/socket-events";
import { callService } from "../services/call.service";
import { voiceLivenessService } from "../services/voiceLiveness.service";
import { voiceAuthService } from "../services/voiceAuth.service";
import { voiceIntegrityService } from "../services/voiceIntegrity.service";
import { transcriptionService } from "../services/transcription.service";
import { callRiskService } from "../services/callRisk.service";
import { xgboostIntegrityService } from "../services/xgboostIntegrity.service";
import { datasetService } from "../services/dataset.service";
import { logger } from "../utils/logger";

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Maximum allowable PCM payload size in bytes (5 MB ~ 25 seconds @ 48kHz Float32 mono). */
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 96000;
const MIN_WINDOW_DURATION_MS = 500;
const MAX_WINDOW_DURATION_MS = 6000;
/** Maximum allowable audio stream timeline timestamp (24 hours in ms). Rejects wildly future timestamps. */
const MAX_AUDIO_STREAM_TIMESTAMP_MS = 24 * 60 * 60 * 1000;

/** Maximum analysis chunks permitted per second per direction per socket (stride is 1.5s -> ~0.67/s). */
const MAX_CHUNKS_PER_SECOND = 4;

interface CallAnalysisSession {
  lastSequenceNumber: { local: number; remote: number };
  lastTimestampMs: { local: number; remote: number };
  chunksReceived: { local: number; remote: number };
  lastActiveMs: number;
}

export interface VoiceChunkValidationParams {
  callId: string;
  userId: string;
  speakerDirection: "local" | "remote";
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  sampleRate: number;
  byteLength: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface RateLimitTracker {
  count: number;
  windowStartMs: number;
}

/** In-memory tracking of active call analysis sessions. Bounded and pruned on call end. */
const activeAnalysisSessions = new Map<string, CallAnalysisSession>();

/** Per-socket rate limiter map to prevent chunk flooding / CPU exhaustion. */
const rateLimits = new Map<string, RateLimitTracker>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let tracker = rateLimits.get(key);

  if (!tracker || now - tracker.windowStartMs >= 1000) {
    tracker = { count: 1, windowStartMs: now };
    rateLimits.set(key, tracker);
    return true;
  }

  tracker.count++;
  if (tracker.count > MAX_CHUNKS_PER_SECOND) {
    return false;
  }

  return true;
}

function toFloat32Array(raw: Buffer | ArrayBufferLike | ArrayBufferView): Float32Array {
  if (raw instanceof Float32Array) return raw;
  if (raw instanceof ArrayBuffer) return new Float32Array(raw);
  const view = raw as ArrayBufferView;
  if (view.byteOffset % 4 === 0) {
    return new Float32Array(view.buffer, view.byteOffset, view.byteLength / 4);
  }
  const copy = new Uint8Array(view.byteLength);
  copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

export function validateAndTrackChunk(params: VoiceChunkValidationParams): ValidationResult {
  const {
    callId,
    speakerDirection,
    sequenceNumber,
    timestampMs,
    durationMs,
    sampleRate,
    byteLength,
  } = params;

  // 1. Direction validation
  if (speakerDirection !== "local" && speakerDirection !== "remote") {
    return { valid: false, reason: `Invalid speakerDirection "${speakerDirection}"` };
  }

  // 2. Sample rate validation
  if (
    typeof sampleRate !== "number" ||
    !Number.isFinite(sampleRate) ||
    sampleRate < MIN_SAMPLE_RATE ||
    sampleRate > MAX_SAMPLE_RATE
  ) {
    return { valid: false, reason: `Invalid sampleRate ${sampleRate}` };
  }

  // 3. Duration validation
  if (
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < MIN_WINDOW_DURATION_MS ||
    durationMs > MAX_WINDOW_DURATION_MS
  ) {
    return { valid: false, reason: `Invalid durationMs ${durationMs}` };
  }

  // 4. Sequence number validation (monotonic non-negative integer)
  if (typeof sequenceNumber !== "number" || !Number.isInteger(sequenceNumber) || sequenceNumber < 0) {
    return { valid: false, reason: `Invalid sequenceNumber ${sequenceNumber}` };
  }

  // 5. Audio stream timestamp validation (relative audio timeline, non-negative, bounded)
  if (
    typeof timestampMs !== "number" ||
    !Number.isFinite(timestampMs) ||
    timestampMs < 0 ||
    timestampMs > MAX_AUDIO_STREAM_TIMESTAMP_MS
  ) {
    return { valid: false, reason: `Rejected invalid/wildly-future timestampMs ${timestampMs}` };
  }

  // 6. Binary PCM size & alignment validation
  if (byteLength === 0 || byteLength > MAX_PAYLOAD_BYTES) {
    return { valid: false, reason: `Rejected PCM payload with invalid byteLength ${byteLength}` };
  }
  if (byteLength % 4 !== 0) {
    return { valid: false, reason: `Rejected PCM payload with misaligned byteLength ${byteLength}` };
  }

  // 7. Call-scoped session progression
  let analysisSession = activeAnalysisSessions.get(callId);
  if (!analysisSession) {
    analysisSession = {
      lastSequenceNumber: { local: -1, remote: -1 },
      lastTimestampMs: { local: -1, remote: -1 },
      chunksReceived: { local: 0, remote: 0 },
      lastActiveMs: Date.now(),
    };
    activeAnalysisSessions.set(callId, analysisSession);
  }

  // Sequence monotonicity check (strict monotonic increase per direction within call)
  if (
    analysisSession.lastSequenceNumber[speakerDirection] >= 0 &&
    sequenceNumber <= analysisSession.lastSequenceNumber[speakerDirection]
  ) {
    return {
      valid: false,
      reason: `Rejected non-monotonic/replayed sequenceNumber ${sequenceNumber} (last: ${analysisSession.lastSequenceNumber[speakerDirection]})`,
    };
  }

  // Timestamp monotonicity check (stream timestamp cannot travel backwards)
  if (
    analysisSession.lastTimestampMs[speakerDirection] >= 0 &&
    timestampMs < analysisSession.lastTimestampMs[speakerDirection]
  ) {
    return {
      valid: false,
      reason: `Rejected out-of-order/replayed timestampMs ${timestampMs} (last: ${analysisSession.lastTimestampMs[speakerDirection]})`,
    };
  }

  // Update session tracking on successful validation
  analysisSession.lastSequenceNumber[speakerDirection] = sequenceNumber;
  analysisSession.lastTimestampMs[speakerDirection] = timestampMs;
  analysisSession.chunksReceived[speakerDirection]++;
  analysisSession.lastActiveMs = Date.now();

  return { valid: true };
}

export function registerVoiceHandlers(_io: TypedServer, socket: TypedSocket): void {
  // Voice Enrollment
  socket.on("voice:enroll", async (payload: VoiceEnrollPayload) => {
    const userId = socket.data.userId;
    if (!userId) {
      logger.warn(`Rejected unauthorized voice:enroll from unauthenticated socket ${socket.id}`);
      socket.emit("voice:enroll-result", {
        success: false,
        userId: "unknown",
        sampleDurationSeconds: 0,
        modelVersion: "ECAPA-TDNN-v1",
        error: "Unauthorized: User is not authenticated",
      });
      return;
    }

    if (!payload || !payload.pcm || typeof payload.sampleRate !== "number" || typeof payload.sampleDurationSeconds !== "number") {
      logger.warn(`Rejected malformed voice:enroll payload from user ${userId}`);
      socket.emit("voice:enroll-result", {
        success: false,
        userId,
        sampleDurationSeconds: 0,
        modelVersion: "ECAPA-TDNN-v1",
        error: "Malformed enrollment payload",
      });
      return;
    }

    const { sampleRate, sampleDurationSeconds, pcm, allowOverwrite } = payload;
    const samples = toFloat32Array(pcm);

    const result = await voiceAuthService.enrollUser(
      userId,
      samples,
      sampleRate,
      sampleDurationSeconds,
      allowOverwrite ?? false
    );

    console.log(
      `[VIRA][ECAPA][ENROLL] userId=${userId} embeddingCreated=${result.success} ` +
        `embeddingDimensions=${result.embedding ? result.embedding.length : 0}`
    );

    // SECURITY & PRIVACY MANDATE: Never expose stored biometric embeddings to client
    socket.emit("voice:enroll-result", {
      success: result.success,
      userId,
      sampleDurationSeconds: result.sampleDurationSeconds,
      modelVersion: result.modelVersion,
      enrolledAt: result.success ? new Date().toISOString() : undefined,
      error: result.error,
    });
  });

  // Real-time voice analysis chunk
  socket.on("voice:analysis-chunk", (payload: VoiceAnalysisChunkPayload) => {
    const startTime = Date.now();
    const userId = socket.data.userId;

    if (!userId) {
      logger.warn(`Rejected unauthenticated voice:analysis-chunk from socket ${socket.id}`);
      return;
    }

    // 1. Validate payload structure
    if (!payload || typeof payload !== "object") {
      logger.warn(`Rejected malformed voice:analysis-chunk from user ${userId}`);
      return;
    }

    const {
      callId,
      speakerDirection,
      sampleRate,
      sequenceNumber,
      timestampMs,
      durationMs,
      pcm,
    } = payload;

    logger.info(
      `[VIRA][PIPELINE] Audio chunk received | callId=${callId} | sequence=${sequenceNumber} | durationMs=${durationMs}`
    );

    // 2. Validate call session authorization
    const session = callService.getSession(callId);
    if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
      logger.warn(
        `Rejected voice:analysis-chunk for unauthorized/invalid callId ${callId} from user ${userId}`
      );
      return;
    }

    // 3. Binary PCM existence check
    if (!pcm) {
      logger.warn(`Missing PCM payload from user ${userId}`);
      return;
    }

    const byteLength =
      pcm instanceof ArrayBuffer
        ? pcm.byteLength
        : (pcm as Uint8Array | Buffer).byteLength ?? 0;

    // 4. Rate Limiting Check (per socket + call + direction)
    const rateLimitKey = `${socket.id}:${callId}:${speakerDirection}`;
    if (!checkRateLimit(rateLimitKey)) {
      logger.warn(`Rate limit exceeded for voice chunks on call ${callId} (${speakerDirection})`);
      return;
    }

    // 5. Comprehensive Parameter, Monotonic Sequence & Audio Stream Timestamp Validation
    const validation = validateAndTrackChunk({
      callId,
      userId,
      speakerDirection,
      sequenceNumber,
      timestampMs,
      durationMs,
      sampleRate,
      byteLength,
    });

    if (!validation.valid) {
      logger.warn(`[VIRA][PIPELINE] ${validation.reason} from user ${userId}`);
      return;
    }

    logger.info(
      `[VIRA][PIPELINE] Audio chunk accepted | callId=${callId} | sequence=${sequenceNumber} | timestampMs=${timestampMs} | direction=${speakerDirection}`
    );

    // 6. Execute Real End-to-End ML Pipeline on the REMOTE caller's speech window
    if (speakerDirection === "remote") {
      logger.info(
        `[VIRA][PIPELINE] Analysis fanout started | callId=${callId} | sequence=${sequenceNumber} | durationMs=${durationMs}`
      );
      const samples = toFloat32Array(pcm);

      // Determine the other participant's ID for speaker verification lookup
      const remoteUserId = session.callerId === userId ? session.calleeId : session.callerId;
      
      voiceLivenessService.enqueueAnalysis(
        {
          callId,
          speakerDirection,
          sequenceNumber,
          timestampMs,
          durationMs,
          samples,
          sampleRate,
        },
        async (result) => {
          // 1. ECAPA-TDNN Speaker Verification
          const enrolledProfile = await voiceAuthService.getEnrolledProfileAsync(remoteUserId);
          let speakerSimilarity: number | undefined;
          let speakerMatch: boolean | undefined;
          let speakerMatchLabel: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled" | undefined = enrolledProfile
            ? "uncertain"
            : "not-enrolled";

          if (enrolledProfile && voiceAuthService.isReady()) {
            try {
              const currentEmbedding = await voiceAuthService.extractEmbedding(samples, sampleRate);
              const verification = voiceAuthService.verifySpeaker(enrolledProfile, currentEmbedding);
              speakerSimilarity = verification.similarity;
              speakerMatch = verification.match;
              speakerMatchLabel = verification.label;
            } catch (err) {
              logger.warn(`Speaker verification failed for remote user ${remoteUserId}: ${err}`);
            }
          }

          // 2. Real-time Voice Integrity Fusion (AASIST + ECAPA + Temporal Smoothing)
          const fusion = voiceIntegrityService.assessWindow(
            callId,
            result.spoofScore,
            speakerSimilarity,
            !!enrolledProfile,
            timestampMs
          );

          // 3. Speech-to-Text Transcription (Deepgram / Whisper / Pluggable)
          let transcriptSnippet: string | undefined;
          let transcriptStatus: string = "PROCESSED";
          try {
            const transcriptRes = await transcriptionService.transcribeSpeechChunk(
              callId,
              samples,
              sampleRate,
              timestampMs,
              timestampMs + durationMs,
              speakerDirection,
              remoteUserId
            );
            if (transcriptRes.success && transcriptRes.segment) {
              transcriptSnippet = transcriptRes.segment.text;
            }
          } catch (err) {
            transcriptStatus = "ERROR";
            logger.warn(`Transcription error on call ${callId}: ${err}`);
          }

          // 4. Multi-Signal Call Risk Analysis (Social Engineering / Financial / Urgency)
          const callTranscripts = transcriptionService.getCallTranscript(callId);
          const riskAssessment = callRiskService.analyzeTranscript(callId, callTranscripts);
          logger.info(
            `[VIRA][RISK] Transcript analyzed | callId=${callId} | risk=${riskAssessment.riskLevel} | score=${riskAssessment.riskScore}`
          );

          // 5. XGBoost / Multi-Signal Calibrated Baseline Scoring
          let sumSq = 0;
          for (let i = 0; i < samples.length; i++) {
            sumSq += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sumSq / (samples.length || 1));
          const speechDurationSec = durationMs / 1000.0;

          const fusedIntegrityAndRisk = xgboostIntegrityService.evaluateIntegrityAndRisk({
            ecapaSimilarity: speakerSimilarity !== undefined ? speakerSimilarity : null,
            aasistSpoofScore: result.spoofScore,
            wav2vec2SpoofScore: result.wav2vec2Score ?? null,
            vadSpeechRatio: 0.95,
            speechDurationSec,
            transcriptRiskScore: riskAssessment.riskScore,
            hasMoneyRequest: riskAssessment.signalCounts.MONEY_REQUEST > 0 || riskAssessment.signalCounts.PAYMENT_REQUEST > 0,
            hasUrgencySignal: riskAssessment.signalCounts.URGENCY > 0 || riskAssessment.signalCounts.PRESSURE_TACTIC > 0,
            hasCredentialRequest: riskAssessment.signalCounts.CREDENTIAL_REQUEST > 0,
            isSpeakerMismatch: speakerMatch === false,
            audioRmsEnergy: Math.min(1.0, rms * 4),
            acousticConfidence: fusion.confidence,
          });

          // 6. Persist candidate dataset sample into ML Dataset Collection
          logger.info(`[VIRA][DATASET] Sample ingestion attempted | callId=${callId}`);
          try {
            await datasetService.ingestSample({
              callId,
              speakerId: remoteUserId,
              speakerDirection: "remote",
              features: {
                ecapaSimilarity: speakerSimilarity !== undefined ? speakerSimilarity : null,
                aasistSpoofScore: result.spoofScore,
                wav2vec2SpoofScore: result.wav2vec2Score ?? null,
                vadSpeechRatio: 0.95,
                speechDurationSec,
                transcriptRiskScore: riskAssessment.riskScore,
                hasMoneyRequest: riskAssessment.signalCounts.MONEY_REQUEST > 0 || riskAssessment.signalCounts.PAYMENT_REQUEST > 0,
                hasUrgencySignal: riskAssessment.signalCounts.URGENCY > 0 || riskAssessment.signalCounts.PRESSURE_TACTIC > 0,
                hasCredentialRequest: riskAssessment.signalCounts.CREDENTIAL_REQUEST > 0,
                isSpeakerMismatch: speakerMatch === false,
                audioRmsEnergy: Math.min(1.0, rms * 4),
                acousticConfidence: fusion.confidence,
              },
              rawEcapaSimilarity: speakerSimilarity,
              hasEnrolledProfile: !!enrolledProfile,
              audioQualitySnr: 25.0,
              modelConfidence: fusion.confidence,
              modelVersions: {
                aasist: result.modelVersion,
                ecapa: "ECAPA-TDNN-v1",
                silero: "Silero-VAD-v5",
                wav2vec2: result.wav2vec2Status ?? "NOT_READY",
                xgboost: fusedIntegrityAndRisk.modelSource,
              },
              metadata: {
                timestampMs,
                sequenceNumber: result.sequenceNumber,
                transcriptText: transcriptSnippet ?? "",
                primaryRiskAssessment: riskAssessment.primaryAssessment,
              },
            });
          } catch (err) {
            logger.warn(`Dataset sample ingestion failed for call ${callId}: ${err}`);
          }

          // 7. Emit complete real-time telemetry result to client
          socket.emit("voice:analysis-result", {
            callId: result.callId,
            speakerDirection: result.speakerDirection,
            sequenceNumber: result.sequenceNumber,
            timestampMs: result.timestampMs,
            durationMs: result.durationMs,
            processingLatencyMs: result.processingLatencyMs,
            status: result.status,
            spoofScore: result.spoofScore,
            label: result.label,
            speakerSimilarity,
            speakerMatch,
            speakerMatchLabel,
            integrityStatus: fusion.integrityStatus,
            confidence: fusion.confidence,
            reason: fusion.reason,
            isSmoothed: fusion.isSmoothed,
            calibrationVersion: fusion.calibrationVersion,
            modelVersion: result.modelVersion,
            wav2vec2Score: result.wav2vec2Score,
            wav2vec2Status: result.wav2vec2Status,
            transcriptSnippet,
            transcriptStatus,
            callRiskScore: riskAssessment.riskScore,
            callRiskLevel: riskAssessment.riskLevel === "HIGH RISK" ? "HIGH" : riskAssessment.riskLevel === "MEDIUM RISK" ? "MEDIUM" : "LOW",
            detectedRiskSignals: riskAssessment.detectedSignals,
            voiceIntegrityScore: fusedIntegrityAndRisk.voiceIntegrityScore,
            voiceIntegrityLevel: fusedIntegrityAndRisk.voiceIntegrityLevel,
            contributingFactors: fusedIntegrityAndRisk.contributingFactors,
            error: result.error,
          });
        }
      );
    } else {
      // Local stream telemetry acknowledgment without anti-spoof inference
      socket.emit("voice:analysis-result", {
        callId,
        speakerDirection,
        sequenceNumber,
        timestampMs,
        durationMs,
        processingLatencyMs: Date.now() - startTime,
        status: "received",
      });
    }
  });

  socket.on("disconnect", () => {
    // Prune rate limit entries for this socket
    for (const key of rateLimits.keys()) {
      if (key.startsWith(`${socket.id}:`)) {
        rateLimits.delete(key);
      }
    }
  });
}

/** Clean up analysis session state when a call ends. */
export function cleanupVoiceAnalysisSession(callId: string): void {
  activeAnalysisSessions.delete(callId);
  voiceLivenessService.cleanupSession(callId);
  voiceIntegrityService.cleanupSession(callId);
  transcriptionService.clearCallTranscript(callId);
  for (const key of rateLimits.keys()) {
    if (key.includes(`:${callId}:`)) {
      rateLimits.delete(key);
    }
  }
}
