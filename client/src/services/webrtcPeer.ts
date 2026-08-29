import { RTC_CONFIG, AUDIO_CONSTRAINTS } from "../utils/webrtcConfig";
import { IceCandidatePayload } from "../types/socket-events";

export interface WebRTCPeerCallbacks {
  onIceCandidate: (candidate: IceCandidatePayload) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

/**
 * Wraps a single RTCPeerConnection for the lifetime of one call.
 * A new instance is created per call and discarded on close() — simpler
 * and safer than trying to reset/reuse one connection across calls.
 */
export class WebRTCPeer {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private callbacks: WebRTCPeerCallbacks;

  constructor(callbacks: WebRTCPeerCallbacks) {
    this.callbacks = callbacks;
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // event.candidate.toJSON() returns RTCIceCandidateInit, whose
        // fields are all optional per the DOM lib. Our wire protocol
        // (IceCandidatePayload) requires them, so we normalize here —
        // once, at the source — rather than push possibly-undefined
        // values through Socket.IO.
        const json = event.candidate.toJSON();
        this.callbacks.onIceCandidate({
          candidate: json.candidate ?? "",
          sdpMid: json.sdpMid ?? null,
          sdpMLineIndex: json.sdpMLineIndex ?? null,
        });
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
    };
  }

  /**
   * Requests microphone access and attaches the resulting tracks to the
   * peer connection. Throws a typed-ish error the caller can inspect via
   * error.name ("NotAllowedError" | "NotFoundError" | ...).
   */
  async acquireLocalAudio(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
    this.localStream = stream;
    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream);
    });
    return stream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(
    remoteOffer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async applyRemoteAnswer(remoteAnswer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
  }

  async addIceCandidate(candidate: IceCandidatePayload): Promise<void> {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // ICE candidates can legitimately arrive before the remote
      // description is set in rare orderings; don't crash the call over it.
      console.warn("Failed to add ICE candidate", err);
    }
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  close(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.pc.getSenders().forEach((sender) => {
      try {
        this.pc.removeTrack(sender);
      } catch {
        // Already removed or connection already closing — safe to ignore.
      }
    });
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
  }
}
