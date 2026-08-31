import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket-events";
import { toUserDTO } from "../types/user";
import { presenceService } from "../services/presence.service";
import { callService } from "../services/call.service";
import { getRelationship } from "../services/contacts.service";
import { broadcastUserList } from "./presence.socket";
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

export function registerCallHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("call:request", async ({ toUserId }) => {
    const callerId = socket.data.userId;
    if (!callerId) return;

    const caller = presenceService.getById(callerId);
    const callee = presenceService.getById(toUserId);

    if (!caller) return;

    if (callerId === toUserId) {
      socket.emit("call:error", {
        code: "CANNOT_CALL_SELF",
        message: "You cannot call yourself.",
      });
      return;
    }

    if (!callee) {
      socket.emit("call:error", {
        code: "USER_UNAVAILABLE",
        message: "That user is not online.",
      });
      return;
    }

    if (
      caller.status === "in-call" ||
      callService.getActiveCallForUser(callerId)
    ) {
      socket.emit("call:error", {
        code: "USER_BUSY",
        message: "You are already in a call.",
      });
      return;
    }

    if (
      callee.status === "in-call" ||
      callService.getActiveCallForUser(toUserId)
    ) {
      socket.emit("call:error", {
        code: "USER_BUSY",
        message: `${callee.username} is currently in another call.`,
      });
      return;
    }

    const session = callService.createSession(callerId, toUserId);

    // Known/unknown is checked FROM THE CALLEE'S perspective: does the
    // caller's account id exist in the callee's contacts? This is why
    // it's awaited here before emitting call:incoming — the badge must
    // be present the moment the notification appears, not added after.
    const relationship = await getRelationship(toUserId, callerId);

    logger.info(
      `Call requested: ${caller.username} -> ${callee.username} (${session.callId}, caller is ${relationship} to callee)`
    );

    io.to(callee.socketId).emit("call:incoming", {
      callId: session.callId,
      from: toUserDTO(caller),
      relationship,
    });
    socket.emit("call:ringing", {
      callId: session.callId,
      to: toUserDTO(callee),
    });
  });

  socket.on("call:accept", ({ callId }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    const session = callService.getSession(callId);
    if (!session || session.calleeId !== userId) {
      socket.emit("call:error", {
        code: "CALL_NOT_FOUND",
        message: "This call no longer exists.",
      });
      return;
    }

    const callee = presenceService.getById(session.calleeId);
    const caller = presenceService.getById(session.callerId);
    if (!callee || !caller) return;

    callService.updateStatus(callId, "accepted");
    presenceService.setStatus(caller.id, "in-call");
    presenceService.setStatus(callee.id, "in-call");
    broadcastUserList(io);

    logger.info(`Call accepted: ${session.callId}`);

    io.to(caller.socketId).emit("call:accepted", {
      callId,
      by: toUserDTO(callee),
    });
  });

  socket.on("call:reject", ({ callId }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    const session = callService.getSession(callId);
    if (!session || session.calleeId !== userId) return;

    const callee = presenceService.getById(session.calleeId);
    const caller = presenceService.getById(session.callerId);

    callService.endSession(callId);
    logger.info(`Call rejected: ${callId}`);

    if (caller && callee) {
      io.to(caller.socketId).emit("call:rejected", {
        callId,
        by: toUserDTO(callee),
      });
    }
  });

  socket.on("call:end", ({ callId }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    const session = callService.getSession(callId);
    if (!session) return;
    if (session.callerId !== userId && session.calleeId !== userId) {
      socket.emit("call:error", {
        code: "NOT_AUTHORIZED_FOR_CALL",
        message: "You are not part of this call.",
      });
      return;
    }

    const endedBy = presenceService.getById(userId);
    const otherUserId =
      session.callerId === userId ? session.calleeId : session.callerId;
    const otherUser = presenceService.getById(otherUserId);

    callService.endSession(callId);
    presenceService.setStatus(session.callerId, "available");
    presenceService.setStatus(session.calleeId, "available");
    broadcastUserList(io);

    logger.info(`Call ended: ${callId} by ${endedBy?.username ?? userId}`);

    if (otherUser) {
      io.to(otherUser.socketId).emit("call:ended", {
        callId,
        by: endedBy ? toUserDTO(endedBy) : null,
      });
    }
  });

  // If a user disconnects mid-call, the other party must be notified and
  // freed up rather than left thinking they're still "in a call" forever.
  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (!userId) return;

    const session = callService.endActiveCallForUser(userId);
    if (!session) return;

    const otherUserId =
      session.callerId === userId ? session.calleeId : session.callerId;
    const otherUser = presenceService.getById(otherUserId);
    const disconnectedUser = presenceService.getById(userId);

    presenceService.setStatus(session.callerId, "available");
    presenceService.setStatus(session.calleeId, "available");
    broadcastUserList(io);

    if (otherUser) {
      io.to(otherUser.socketId).emit("call:ended", {
        callId: session.callId,
        by: disconnectedUser ? toUserDTO(disconnectedUser) : null,
      });
    }
  });
}
