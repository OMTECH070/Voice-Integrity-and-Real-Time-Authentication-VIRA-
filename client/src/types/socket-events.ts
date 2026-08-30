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
}
