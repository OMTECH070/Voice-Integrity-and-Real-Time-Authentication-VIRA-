import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket-events";
import { registerPresenceHandlers } from "./presence.socket";
import { registerCallHandlers } from "./call.socket";
import { registerWebRTCHandlers } from "./webrtc.socket";
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

export function registerSocketHandlers(io: TypedServer): void {
  io.on("connection", (socket: TypedSocket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Order matters: call handlers' disconnect listener needs presence
    // data (the disconnecting user's identity) to still exist, so it must
    // run before presence's own disconnect listener removes that user.
    registerCallHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerWebRTCHandlers(io, socket);
  });
}
