import { randomUUID } from "crypto";
import { PresenceStatus, User, UserId } from "../types/user";

/**
 * In-memory presence store. Deliberately not Redis: this is a single
 * Node process serving a small number of concurrent test users, so a Map
 * is simpler, faster, and has zero extra moving parts to run locally.
 * If this ever needs to scale across multiple server instances, this
 * class is the one place that would need to change.
 */
class PresenceService {
  private usersById: Map<UserId, User> = new Map();
  private userIdBySocketId: Map<string, UserId> = new Map();

  register(socketId: string, username: string): User {
    const id = randomUUID();
    const user: User = { id, username, socketId, status: "available" };
    this.usersById.set(id, user);
    this.userIdBySocketId.set(socketId, id);
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
