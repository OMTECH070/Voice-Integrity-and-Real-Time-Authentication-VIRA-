import { CallError, CallId } from "./call";
import { UserDTO, UserId } from "./user";

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
  pcm: ArrayBufferLike | ArrayBufferView;
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
  // Wav2Vec2 Anti-Spoof
  wav2vec2Status?: "READY" | "NOT_READY" | "ERROR";
  wav2vec2Score?: number | null;
  // ECAPA Speaker Verification
  speakerSimilarity?: number;
  speakerMatch?: boolean;
  speakerMatchLabel?: "match" | "likely-match" | "mismatch" | "uncertain" | "not-enrolled";
  // Conversational Risk & Signals
  callRiskScore?: number;
  callRiskLevel?: "LOW" | "MEDIUM" | "HIGH";
  conversationalSignals?: string[];
  // Fused Voice Integrity Assessment & XGBoost
  integrityStatus?: FusedIntegrityStatus;
  voiceIntegrityScore?: number;
  confidence?: number;
  reason?: string;
  isSmoothed?: boolean;
  calibrationVersion?: string;
  modelVersion?: string;
  error?: string;
}

export interface VoiceEnrollPayload {
  sampleRate: number;
  sampleDurationSeconds: number;
  pcm: ArrayBufferLike | ArrayBufferView;
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

/** Events this CLIENT emits, received by the server. */
export interface ClientToServerEvents {
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

/** Events the server emits, received by THIS CLIENT. */
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
