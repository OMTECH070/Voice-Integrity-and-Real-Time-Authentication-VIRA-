import { PresenceStatus, User, UserId } from "../types/user";

/**
 * In-memory presence store. Deliberately not Redis: this is a single
 * Node process serving a small number of concurrent test users, so a Map
 * is simpler, faster, and has zero extra moving parts to run locally.
 * If this ever needs to scale across multiple server instances, this
 * class is the one place that would need to change.
 *
 * IDENTITY NOTE: `id` is now the real Supabase account id supplied by
 * the client at registration time (see presence.socket.ts) — this
 * service no longer generates its own random id. This is what lets the
 * calling system target users by their actual persistent account,
 * consistent with the identity model in supabase/schema.sql.
 *
 * KNOWN LIMITATION: if the same account registers from a second socket
 * (e.g. a second browser tab) before the first disconnects, the second
 * registration replaces the first in `usersById`; the first socket's
 * stale mapping is proactively removed below so its eventual disconnect
 * doesn't wrongly tear down the new session. This is "last connection
 * wins" — there's no true multi-device presence yet. Acceptable
 * simplification for this stage, not a full fix.
 */
class PresenceService {
  private usersById: Map<UserId, User> = new Map();
  private userIdBySocketId: Map<string, UserId> = new Map();

  register(accountId: UserId, socketId: string, username: string): User {
    const existing = this.usersById.get(accountId);
    if (existing) {
      this.userIdBySocketId.delete(existing.socketId);
    }

    const user: User = { id: accountId, username, socketId, status: "available" };
    this.usersById.set(accountId, user);
    this.userIdBySocketId.set(socketId, accountId);
    return user;
  }

  getBySocketId(socketId: string): User | undefined {
    const userId = this.userIdBySocketId.get(socketId);
    if (!userId) return undefined;
    return this.usersById.get(userId);
  }

  getById(userId: UserId): User | undefined {
    return this.usersById.get(userId);
  }

  setStatus(userId: UserId, status: PresenceStatus): void {
    const user = this.usersById.get(userId);
    if (user) user.status = status;
  }

  removeBySocketId(socketId: string): User | undefined {
    const userId = this.userIdBySocketId.get(socketId);
    if (!userId) return undefined;
    const user = this.usersById.get(userId);
    this.usersById.delete(userId);
    this.userIdBySocketId.delete(socketId);
    return user;
  }

  listAll(): User[] {
    return Array.from(this.usersById.values());
  }
}

// Single shared instance for the process lifetime.
export const presenceService = new PresenceService();
