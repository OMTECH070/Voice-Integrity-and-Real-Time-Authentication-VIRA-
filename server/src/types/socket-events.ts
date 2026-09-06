import { CallError, CallId } from "./call";
import { UserDTO, UserId } from "./user";

/**
 * Minimal structural types for WebRTC signaling payloads. We avoid pulling
 * in the DOM lib on the server just for these two shapes — Socket.IO only
 * ever sees them as plain JSON, so a structural type is all we need and it
 * keeps this file compatible with both dom and non-dom TS libs.
 */
export interface SessionDescriptionPayload {
  type: "offer" | "answer";
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type SpeakerDirection = "local" | "remote";

export interface VoiceAnalysisChunkPayload {
  callId: CallId;
  speakerDirection: SpeakerDirection;
  sampleRate: number;
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  /** Binary Float32Array PCM buffer */
  pcm: Buffer | ArrayBufferLike | ArrayBufferView;
}

export type FusedIntegrityStatus =
  | "analyzing"
  | "human-verified"
  | "possible-ai"
  | "speaker-mismatch"
  | "uncertain"
  | "not-enrolled"
  | "analysis-unavailable";

export interface VoiceAnalysisResultPayload {
  callId: CallId;
  speakerDirection: SpeakerDirection;
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  processingLatencyMs: number;
  status: "received" | "analyzed" | "error" | "unavailable";
  // AASIST Anti-Spoof
  spoofScore?: number;
  label?: "live" | "likely-synthetic" | "uncertain";
  // ECAPA Speaker Verification
  speakerSimilarity?: number;
  speakerMatch?: boolean;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled";
  // Fused Voice Integrity Assessment
  integrityStatus?: FusedIntegrityStatus;
  confidence?: number;
  reason?: string;
  isSmoothed?: boolean;
  calibrationVersion?: string;
  modelVersion?: string;
  wav2vec2Score?: number | null;
  wav2vec2Status?: string;
  voiceStatus?: "LISTENING" | "SPEECH_DETECTED" | "PROCESSING" | "VERIFIED" | "MISMATCH" | "SPOOF_DETECTED" | "UNCERTAIN";
  speakerMatchDecision?: "MATCH" | "MISMATCH" | "UNCERTAIN" | "INSUFFICIENT_AUDIO";
  transcriptSnippet?: string;
  transcriptStatus?: string;
  callRiskScore?: number;
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH";
  detectedRiskSignals?: string[];
  voiceIntegrityScore?: number;
  voiceIntegrityLevel?: "LOW" | "MEDIUM" | "HIGH";
  contributingFactors?: { voiceIntegrity: string[]; callRisk: string[] };
  error?: string;
}

export interface VoiceEnrollPayload {
  sampleRate: number;
  sampleDurationSeconds: number;
  pcm: Buffer | ArrayBufferLike | ArrayBufferView;
  allowOverwrite?: boolean;
}

export interface VoiceEnrollResultPayload {
  success: boolean;
  userId: UserId;
  sampleDurationSeconds: number;
  modelVersion: string;
  enrolledAt?: string;
  error?: string;
}

/** Events the CLIENT emits, received by the SERVER. */
export interface ClientToServerEvents {
  /** username here carries the account's display name — actual identity
   * targeting uses accountId (the real Supabase account id), never this
   * field. See presence.service.ts for why. */
  "presence:register": (payload: { accountId: string; username: string }) => void;

  "call:request": (payload: { toUserId: UserId }) => void;
  "call:accept": (payload: { callId: CallId }) => void;
  "call:reject": (payload: { callId: CallId }) => void;
  "call:end": (payload: { callId: CallId }) => void;

  "webrtc:offer": (payload: {
    toUserId: UserId;
    offer: SessionDescriptionPayload;
  }) => void;
  "webrtc:answer": (payload: {
    toUserId: UserId;
    answer: SessionDescriptionPayload;
  }) => void;
  "webrtc:ice-candidate": (payload: {
    toUserId: UserId;
    candidate: IceCandidatePayload;
  }) => void;

  /** Real-time speech analysis window transport. */
  "voice:analysis-chunk": (payload: VoiceAnalysisChunkPayload) => void;

  /** Voice biometric enrollment. */
  "voice:enroll": (payload: VoiceEnrollPayload) => void;
}

/** Events the SERVER emits, received by the CLIENT. */
export interface ServerToClientEvents {
  "presence:users": (payload: { users: UserDTO[] }) => void;
  "presence:self": (payload: { self: UserDTO }) => void;

  "call:incoming": (payload: { callId: CallId; from: UserDTO }) => void;
  "call:ringing": (payload: { callId: CallId; to: UserDTO }) => void;
  "call:accepted": (payload: { callId: CallId; by: UserDTO }) => void;
  "call:rejected": (payload: { callId: CallId; by: UserDTO }) => void;
  "call:ended": (payload: { callId: CallId; by: UserDTO | null }) => void;
  "call:error": (payload: CallError) => void;

  "webrtc:offer": (payload: {
    fromUserId: UserId;
    offer: SessionDescriptionPayload;
  }) => void;
  "webrtc:answer": (payload: {
    fromUserId: UserId;
    answer: SessionDescriptionPayload;
  }) => void;
  "webrtc:ice-candidate": (payload: {
    fromUserId: UserId;
    candidate: IceCandidatePayload;
  }) => void;

  /** Real-time speech analysis result / telemetry transport. */
  "voice:analysis-result": (payload: VoiceAnalysisResultPayload) => void;

  /** Voice enrollment result. */
  "voice:enroll-result": (payload: VoiceEnrollResultPayload) => void;
}

export interface InterServerEvents {
  // Not used in this single-instance version; reserved for future scaling.
}

export interface SocketData {
  userId: UserId;
}
