import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket";
import { WebRTCPeer } from "../services/webrtcPeer";
import { useWebRTC } from "./useWebRTC";
import { UserDTO } from "../types/user";
import { IceCandidatePayload } from "../types/socket-events";
import {
  ActiveCallInfo,
  CALL_ERROR_MESSAGES,
  CallError,
  CallState,
} from "../types/call";

const REJECTED_STATE_DISPLAY_MS = 3000;
const ENDED_STATE_DISPLAY_MS = 2000;

export interface UseCallManagerResult {
  self: UserDTO | null;
  users: UserDTO[];
  callState: CallState;
  activeCall: ActiveCallInfo | null;
  error: CallError | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  register: (accountId: string, username: string) => void;
  callUser: (toUserId: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  dismissError: () => void;
}

export function useCallManager(): UseCallManagerResult {
  const [self, setSelf] = useState<UserDTO | null>(null);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [error, setError] = useState<CallError | null>(null);

  const peerRef = useRef<WebRTCPeer | null>(null);
  // ICE candidates that arrive before our peer connection exists yet
  // (can happen if the remote side's negotiation races ahead of ours).
  const pendingCandidatesRef = useRef<IceCandidatePayload[]>([]);

  const webrtc = useWebRTC();
  const socket = getSocket();

  const resetCallState = useCallback(() => {
    webrtc.cleanup(peerRef.current);
    peerRef.current = null;
    pendingCandidatesRef.current = [];
    setActiveCall(null);
    setCallState("IDLE");
  }, [webrtc]);

  const showError = useCallback((err: CallError) => {
    setError(err);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  // ---------- Socket event wiring (registered once) ----------
  useEffect(() => {
    socket.on("presence:self", ({ self: selfDto }) => setSelf(selfDto));
    socket.on("presence:users", ({ users: list }) => setUsers(list));

    socket.on("call:incoming", ({ callId, from, relationship }) => {
      setActiveCall({ callId, remoteUser: from, isCaller: false, relationship });
      setCallState("RINGING");
    });

    socket.on("call:ringing", ({ callId, to }) => {
      setActiveCall({ callId, remoteUser: to, isCaller: true });
    });

    socket.on("call:accepted", async ({ by }) => {
      setCallState("ACCEPTED");
      setCallState("CONNECTING");

      const peer = webrtc.createPeer({
        onIceCandidate: (candidate) => {
          socket.emit("webrtc:ice-candidate", { toUserId: by.id, candidate });
        },
      });
      peerRef.current = peer;

      const micResult = await webrtc.acquireLocalAudio(peer);
      if (!micResult.ok) {
        showError({
          code: micResult.errorCode,
          message: CALL_ERROR_MESSAGES[micResult.errorCode],
        });
        resetCallState();
        return;
      }

      const offer = await peer.createOffer();
      socket.emit("webrtc:offer", {
        toUserId: by.id,
        offer: { type: "offer", sdp: offer.sdp ?? "" },
      });
    });

    socket.on("call:rejected", () => {
      setCallState("REJECTED");
      setTimeout(resetCallState, REJECTED_STATE_DISPLAY_MS);
    });

    socket.on("call:ended", () => {
      setCallState("ENDED");
      webrtc.cleanup(peerRef.current);
      peerRef.current = null;
      setTimeout(resetCallState, ENDED_STATE_DISPLAY_MS);
    });

    socket.on("call:error", (callError) => {
      showError(callError);
      // A failed call:request should not leave the caller stuck in CALLING.
      setCallState((prev) => (prev === "CALLING" ? "IDLE" : prev));
    });

    socket.on("webrtc:offer", async ({ fromUserId, offer }) => {
      // We are the callee: our peer should already exist from acceptCall().
      const peer = peerRef.current;
      if (!peer) return;

      const answer = await peer.createAnswer({
        type: "offer",
        sdp: offer.sdp,
      });

      pendingCandidatesRef.current.forEach((candidate) => {
        peer.addIceCandidate(candidate);
      });
      pendingCandidatesRef.current = [];

      socket.emit("webrtc:answer", {
        toUserId: fromUserId,
        answer: { type: "answer", sdp: answer.sdp ?? "" },
      });
    });

    socket.on("webrtc:answer", async ({ answer }) => {
      const peer = peerRef.current;
      if (!peer) return;
      await peer.applyRemoteAnswer({ type: "answer", sdp: answer.sdp });
      setCallState("CONNECTED");
    });

    socket.on("webrtc:ice-candidate", ({ candidate }) => {
      const peer = peerRef.current;
      if (!peer) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      peer.addIceCandidate(candidate);
    });

    socket.on("disconnect", () => {
      showError({
        code: "SOCKET_DISCONNECTED",
        message: CALL_ERROR_MESSAGES.SOCKET_DISCONNECTED,
      });
      resetCallState();
    });

    return () => {
      socket.removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Public actions ----------

  const register = useCallback(
    (accountId: string, username: string) => {
      socket.emit("presence:register", { accountId, username });
    },
    [socket]
  );

  const callUser = useCallback(
    (toUserId: string) => {
      setCallState("CALLING");
      socket.emit("call:request", { toUserId });
    },
    [socket]
  );

  const acceptCall = useCallback(async () => {
    if (!activeCall) return;
    setCallState("ACCEPTED");
    setCallState("CONNECTING");

    const peer = webrtc.createPeer({
      onIceCandidate: (candidate) => {
        socket.emit("webrtc:ice-candidate", {
          toUserId: activeCall.remoteUser.id,
          candidate,
        });
      },
    });
    peerRef.current = peer;

    const micResult = await webrtc.acquireLocalAudio(peer);
    if (!micResult.ok) {
      showError({
        code: micResult.errorCode,
        message: CALL_ERROR_MESSAGES[micResult.errorCode],
      });
      resetCallState();
      return;
    }

    socket.emit("call:accept", { callId: activeCall.callId });
  }, [activeCall, socket, webrtc, showError, resetCallState]);

  const rejectCall = useCallback(() => {
    if (!activeCall) return;
    socket.emit("call:reject", { callId: activeCall.callId });
    resetCallState();
  }, [activeCall, socket, resetCallState]);

  const endCall = useCallback(() => {
    if (!activeCall) return;
    socket.emit("call:end", { callId: activeCall.callId });
    resetCallState();
  }, [activeCall, socket, resetCallState]);

  const toggleMute = useCallback(() => {
    webrtc.toggleMute(peerRef.current);
  }, [webrtc]);

  // Once WebRTC itself reports "connected", make sure our call state
  // reflects it even if the answer-side timing beat the offer-side to it.
  useEffect(() => {
    if (webrtc.connectionState === "connected" && callState === "CONNECTING") {
      setCallState("CONNECTED");
    }
    if (
      (webrtc.connectionState === "failed" ||
        webrtc.connectionState === "disconnected") &&
      (callState === "CONNECTING" || callState === "CONNECTED")
    ) {
      showError({
        code: "WEBRTC_CONNECTION_FAILED",
        message: CALL_ERROR_MESSAGES.WEBRTC_CONNECTION_FAILED,
      });
      if (activeCall) {
        socket.emit("call:end", { callId: activeCall.callId });
      }
      resetCallState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.connectionState]);

  return {
    self,
    users,
    callState,
    activeCall,
    error,
    remoteStream: webrtc.remoteStream,
    isMuted: webrtc.isMuted,
    register,
    callUser,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    dismissError,
  };
}
