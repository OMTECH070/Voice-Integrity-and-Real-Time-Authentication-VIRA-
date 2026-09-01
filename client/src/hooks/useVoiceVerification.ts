import { useEffect, useRef, useState } from "react";
import { verifyCaller, VerifyResult } from "../services/voiceVerificationApi";

export type VoiceVerificationStatus =
  | "idle"
  | "listening"
  | "checking"
  | "verified"
  | "mismatch"
  | "not_enrolled"
  | "unavailable";

const CAPTURE_SECONDS = 4;

/**
 * Runs ONLY on the callee's side (shouldVerify should be `!isCaller`).
 * Captures a few seconds of the remote (caller's) audio stream it's
 * already receiving over WebRTC, and sends it to the verification
 * service tagged with the caller's account id. This must never run on
 * the caller's own side, and must never rely on anything the caller's
 * client self-reports — see voice-verification-service/main.py for the
 * full trust reasoning.
 */
export function useVoiceVerification(
  remoteStream: MediaStream | null,
  isConnected: boolean,
  shouldVerify: boolean,
  callerAccountId: string | undefined
) {
  const [status, setStatus] = useState<VoiceVerificationStatus>("idle");
  const [score, setScore] = useState<number | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isConnected || !shouldVerify || !remoteStream || !callerAccountId) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    setStatus("listening");

    const recorder = new MediaRecorder(remoteStream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      setStatus("checking");
      const blob = new Blob(chunks, { type: "audio/webm" });
      const result: VerifyResult | null = await verifyCaller(callerAccountId, blob);

      if (!result) {
        setStatus("unavailable");
        return;
      }
      setScore(result.score);
      if (result.reason === "not_enrolled") {
        setStatus("not_enrolled");
      } else if (result.match) {
        setStatus("verified");
      } else {
        setStatus("mismatch");
      }
    };

    recorder.start();
    const timeoutId = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CAPTURE_SECONDS * 1000);

    return () => clearTimeout(timeoutId);
  }, [isConnected, shouldVerify, remoteStream, callerAccountId]);

  useEffect(() => {
    if (!isConnected) {
      hasRunRef.current = false;
      setStatus("idle");
      setScore(null);
    }
  }, [isConnected]);

  return { status, score };
}
