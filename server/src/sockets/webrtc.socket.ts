import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket-events";
import { presenceService } from "../services/presence.service";

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

/**
 * Pure relay: the server never inspects or modifies SDP/ICE payloads,
 * it only forwards them to the intended recipient by userId. Actual
 * audio never passes through this server — it flows peer-to-peer once
 * negotiation completes.
 */
export function registerWebRTCHandlers(_io: TypedServer, socket: TypedSocket): void {
  socket.on("webrtc:offer", ({ toUserId, offer }) => {
    const fromUserId = socket.data.userId;
    if (!fromUserId) return;
    const target = presenceService.getById(toUserId);
    if (!target) return;
    socket.to(target.socketId).emit("webrtc:offer", { fromUserId, offer });
  });

  socket.on("webrtc:answer", ({ toUserId, answer }) => {
    const fromUserId = socket.data.userId;
    if (!fromUserId) return;
    const target = presenceService.getById(toUserId);
    if (!target) return;
    socket.to(target.socketId).emit("webrtc:answer", { fromUserId, answer });
  });

  socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
    const fromUserId = socket.data.userId;
    if (!fromUserId) return;
    const target = presenceService.getById(toUserId);
    if (!target) return;
    socket
      .to(target.socketId)
      .emit("webrtc:ice-candidate", { fromUserId, candidate });
  });
}
