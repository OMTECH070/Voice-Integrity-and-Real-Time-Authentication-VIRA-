import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket-events";
import { toUserDTO } from "../types/user";
import { presenceService } from "../services/presence.service";
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

function broadcastUserList(io: TypedServer): void {
  const users = presenceService.listAll().map(toUserDTO);
  io.emit("presence:users", { users });
}

export function registerPresenceHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("presence:register", ({ accountId, username }) => {
    const trimmedUsername = username.trim();
    if (!accountId || trimmedUsername.length === 0) {
      logger.warn(`Rejected invalid registration from ${socket.id}`);
      return;
    }

    const user = presenceService.register(accountId, socket.id, trimmedUsername);
    socket.data.userId = user.id;

    logger.info(`User registered: ${user.username} (${user.id})`);

    socket.emit("presence:self", { self: toUserDTO(user) });
    broadcastUserList(io);
  });

  socket.on("disconnect", () => {
    const removed = presenceService.removeBySocketId(socket.id);
    if (removed) {
      logger.info(`User disconnected: ${removed.username} (${removed.id})`);
      broadcastUserList(io);
    }
  });
}

export { broadcastUserList };
