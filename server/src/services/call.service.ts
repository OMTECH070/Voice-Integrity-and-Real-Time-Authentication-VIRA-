import { randomUUID } from "crypto";
import { CallId, CallSession, ServerCallStatus } from "../types/call";
import { UserId } from "../types/user";

/**
 * Tracks active call sessions in memory. A "session" exists from the
 * moment a call is requested until it ends (accepted-then-hung-up,
 * rejected, or timed out) — it is NOT a call history log, just live state.
 */
class CallService {
  private sessionsById: Map<CallId, CallSession> = new Map();
  /** userId -> callId, so we can quickly check "is this user already in a call?" */
  private activeCallByUserId: Map<UserId, CallId> = new Map();

  createSession(callerId: UserId, calleeId: UserId): CallSession {
    const callId = randomUUID();
    const session: CallSession = {
      callId,
      callerId,
      calleeId,
      status: "ringing",
      createdAt: Date.now(),
    };
    this.sessionsById.set(callId, session);
    this.activeCallByUserId.set(callerId, callId);
    this.activeCallByUserId.set(calleeId, callId);
    return session;
  }

  getSession(callId: CallId): CallSession | undefined {
    return this.sessionsById.get(callId);
  }

  getActiveCallForUser(userId: UserId): CallSession | undefined {
    const callId = this.activeCallByUserId.get(userId);
    if (!callId) return undefined;
    return this.sessionsById.get(callId);
  }

  updateStatus(callId: CallId, status: ServerCallStatus): void {
    const session = this.sessionsById.get(callId);
    if (session) session.status = status;
  }

  /** Ends and removes the session entirely, freeing both users. */
  endSession(callId: CallId): CallSession | undefined {
    const session = this.sessionsById.get(callId);
    if (!session) return undefined;
    this.activeCallByUserId.delete(session.callerId);
    this.activeCallByUserId.delete(session.calleeId);
    this.sessionsById.delete(callId);
    return session;
  }

  /** Used on disconnect: find and end whatever call this user was part of. */
  endActiveCallForUser(userId: UserId): CallSession | undefined {
    const callId = this.activeCallByUserId.get(userId);
    if (!callId) return undefined;
    return this.endSession(callId);
  }
}

export const callService = new CallService();
