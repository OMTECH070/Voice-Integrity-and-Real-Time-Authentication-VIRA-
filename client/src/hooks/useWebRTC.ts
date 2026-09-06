import { useCallback, useRef, useState } from "react";
import { WebRTCPeer } from "../services/webrtcPeer";
import { CallErrorCode } from "../types/call";
import { IceCandidatePayload } from "../types/socket-events";

export interface UseWebRTCResult {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "idle";
  isMuted: boolean;
  createPeer: (callbacks: {
    onIceCandidate: (candidate: IceCandidatePayload) => void;
  }) => WebRTCPeer;
  acquireLocalAudio: (peer: WebRTCPeer) => Promise<{
    ok: true;
    stream: MediaStream;
  } | {
    ok: false;
    errorCode: CallErrorCode;
  }>;
  toggleMute: (peer: WebRTCPeer | null) => void;
  cleanup: (peer: WebRTCPeer | null) => void;
}

/**
 * Thin reactive wrapper around WebRTCPeer. The peer instance itself is
 * owned by the caller (typically useCallManager) since its lifetime spans
 * a whole call, not a component render cycle — this hook just exposes the
 * state changes (remote stream arriving, connection state) as React state
 * so components re-render when they happen.
 */
export function useWebRTC(): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<
    RTCPeerConnectionState | "idle"
  >("idle");
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(false);

  const createPeer = useCallback(
    (callbacks: { onIceCandidate: (candidate: IceCandidatePayload) => void }) => {
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionState("new");
      return new WebRTCPeer({
        onIceCandidate: callbacks.onIceCandidate,
        onRemoteStream: (stream) => setRemoteStream(stream),
        onConnectionStateChange: (state) => setConnectionState(state),
      });
    },
    []
  );

  const acquireLocalAudio = useCallback(async (peer: WebRTCPeer) => {
    try {
      const stream = await peer.acquireLocalAudio();
      setLocalStream(stream);
      return { ok: true as const, stream };
    } catch (err) {
      const domError = err as DOMException;
      const errorCode: CallErrorCode =
        domError.name === "NotAllowedError"
          ? "MIC_PERMISSION_DENIED"
          : domError.name === "NotFoundError"
          ? "NO_MICROPHONE"
          : "WEBRTC_CONNECTION_FAILED";
      return { ok: false as const, errorCode };
    }
  }, []);

  const toggleMute = useCallback((peer: WebRTCPeer | null) => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    peer?.setMuted(next);
  }, []);

  const cleanup = useCallback((peer: WebRTCPeer | null) => {
    peer?.close();
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("idle");
    setIsMuted(false);
    mutedRef.current = false;
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    isMuted,
    createPeer,
    acquireLocalAudio,
    toggleMute,
    cleanup,
  };
}
