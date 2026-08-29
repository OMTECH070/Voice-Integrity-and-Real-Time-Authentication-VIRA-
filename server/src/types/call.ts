import { UserId } from "./user";

export type CallId = string;

/**
 * Server-tracked call lifecycle. The client has its own richer CallState
 * (it also tracks WebRTC connection phases like CONNECTING/CONNECTED which
 * are purely local negotiation detail the server doesn't need to know).
 */
export type ServerCallStatus =
  | "ringing"
  | "accepted"
  | "rejected"
  | "ended";

export interface CallSession {
  callId: CallId;
  callerId: UserId;
  calleeId: UserId;
  status: ServerCallStatus;
  createdAt: number;
}

export type CallErrorCode =
  | "USER_UNAVAILABLE"
  | "USER_BUSY"
  | "CANNOT_CALL_SELF"
  | "CALL_NOT_FOUND"
  | "NOT_AUTHORIZED_FOR_CALL";

export interface CallError {
  code: CallErrorCode;
  message: string;
}
