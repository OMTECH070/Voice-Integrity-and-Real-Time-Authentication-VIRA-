import { UserDTO, UserId } from "./user";
import { CallerRelationship } from "./contacts";

export type CallId = string;

/**
 * Client-local call state machine. Richer than the server's ServerCallStatus
 * because the client also tracks WebRTC negotiation phases (CONNECTING /
 * CONNECTED) that are purely local to the peer connection and never need
 * to be known by the server.
 *
 * Valid transitions (enforced in useCallState, not just by convention):
 *   IDLE      -> CALLING (caller requests) | RINGING (callee receives)
 *   CALLING   -> ACCEPTED | REJECTED | ENDED (error/timeout/cancel)
 *   RINGING   -> ACCEPTED | REJECTED
 *   ACCEPTED  -> CONNECTING
 *   CONNECTING-> CONNECTED | ENDED (ICE/negotiation failure)
 *   CONNECTED -> ENDED
 *   REJECTED  -> IDLE
 *   ENDED     -> IDLE
 */
export type CallState =
  | "IDLE"
  | "CALLING"
  | "RINGING"
  | "ACCEPTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REJECTED"
  | "ENDED";

export interface ActiveCallInfo {
  callId: CallId;
  remoteUser: UserDTO;
  /** Was this client the one who placed the call? */
  isCaller: boolean;
  /** Only meaningful on the callee side (isCaller: false) — undefined
   * for the caller, since a caller isn't shown a badge about themselves. */
  relationship?: CallerRelationship;
}

export type CallErrorCode =
  | "USER_UNAVAILABLE"
  | "USER_BUSY"
  | "CANNOT_CALL_SELF"
  | "CALL_NOT_FOUND"
  | "NOT_AUTHORIZED_FOR_CALL"
  | "MIC_PERMISSION_DENIED"
  | "NO_MICROPHONE"
  | "WEBRTC_CONNECTION_FAILED"
  | "SOCKET_DISCONNECTED";

export interface CallError {
  code: CallErrorCode;
  message: string;
}

export const CALL_ERROR_MESSAGES: Record<CallErrorCode, string> = {
  USER_UNAVAILABLE: "That user is not online.",
  USER_BUSY: "That user is currently busy.",
  CANNOT_CALL_SELF: "You cannot call yourself.",
  CALL_NOT_FOUND: "This call no longer exists.",
  NOT_AUTHORIZED_FOR_CALL: "You are not part of this call.",
  MIC_PERMISSION_DENIED: "Microphone access was denied. Please allow microphone access and try again.",
  NO_MICROPHONE: "No microphone was found on this device.",
  WEBRTC_CONNECTION_FAILED: "The call connection failed. Please try again.",
  SOCKET_DISCONNECTED: "Lost connection to the server.",
};

export type UserIdRef = UserId;
