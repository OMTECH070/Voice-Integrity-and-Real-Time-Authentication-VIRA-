import { useState, useRef, useEffect, useCallback } from "react";
import { useVoiceActivityDetector } from "../audio/vad/useVoiceActivityDetector";
import { concatFloat32 } from "../audio/vad/pcm";
import { getSocket } from "../services/socket";
import { supabase } from "../services/supabaseClient";
import type { VoiceEnrollResultPayload } from "../types/socket-events";

type EnrollmentStep =
  | "READY"
  | "CONFIRM_OVERWRITE"
  | "RECORDING"
  | "PROCESSING"
  | "ENROLLED"
  | "INSUFFICIENT_SPEECH"
  | "ERROR";

interface VoiceEnrollmentProps {
  userId: string;
  onClose: () => void;
  onEnrolled?: () => void;
}

const TARGET_RECORDING_DURATION_SEC = 12;
const MIN_REQUIRED_SPEECH_SEC = 2.0;

export function VoiceEnrollment({ userId, onClose, onEnrolled }: VoiceEnrollmentProps) {
  const [step, setStep] = useState<EnrollmentStep>("READY");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speechDurationSec, setSpeechDurationSec] = useState<number>(0);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState<number>(TARGET_RECORDING_DURATION_SEC);
  const [hasExistingProfile, setHasExistingProfile] = useState<boolean>(false);
  const [existingEnrolledAt, setExistingEnrolledAt] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const speechChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(16000);
  const countdownIntervalRef = useRef<number | null>(null);

  // VAD Callback collects speech-only PCM chunks during recording
  const handleSpeechFrame = useCallback((frame: { samples: Float32Array; sampleRate: number }) => {
    if (step !== "RECORDING") return;
    sampleRateRef.current = frame.sampleRate;
    speechChunksRef.current.push(new Float32Array(frame.samples));
    const totalSamples = speechChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    setSpeechDurationSec(totalSamples / frame.sampleRate);
  }, [step]);

  const vad = useVoiceActivityDetector({
    minSpeechFrames: 3,
    hangoverFrames: 8,
  }, handleSpeechFrame);

  // Check if profile is already enrolled on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const { data } = await supabase
          .from("voice_profiles")
          .select("enrolled_at, sample_duration_seconds")
          .eq("user_id", userId)
          .maybeSingle();

        if (data) {
          setHasExistingProfile(true);
          setExistingEnrolledAt(new Date(data.enrolled_at).toLocaleDateString());
        }
      } catch (err) {
        console.warn("Could not check existing voice profile:", err);
      }
    }
    checkExisting();
  }, [userId]);

  // Clean up mic and timers on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const finishRecording = async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    await vad.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const totalSamples = speechChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    const totalSpeechSec = sampleRateRef.current > 0 ? totalSamples / sampleRateRef.current : 0;

    if (totalSpeechSec < MIN_REQUIRED_SPEECH_SEC) {
      setStep("INSUFFICIENT_SPEECH");
      return;
    }

    setStep("PROCESSING");

    const fullSpeechPcm = concatFloat32(speechChunksRef.current);
    speechChunksRef.current = [];

    const socket = getSocket();

    const handleEnrollResult = async (result: VoiceEnrollResultPayload) => {
      socket.off("voice:enroll-result", handleEnrollResult);

      if (result.success) {
        setStep("ENROLLED");
        setHasExistingProfile(true);
        setExistingEnrolledAt(
          result.enrolledAt ? new Date(result.enrolledAt).toLocaleDateString() : new Date().toLocaleDateString()
        );
        onEnrolled?.();
      } else {
        setErrorMessage(result.error ?? "Failed to extract speaker embedding");
        setStep("ERROR");
      }
    };

    socket.on("voice:enroll-result", handleEnrollResult);

    socket.emit("voice:enroll", {
      sampleRate: sampleRateRef.current,
      sampleDurationSeconds: totalSpeechSec,
      pcm: fullSpeechPcm.buffer,
      allowOverwrite: hasExistingProfile,
    });
  };

  const handleStartEnrollmentClick = () => {
    if (hasExistingProfile) {
      setStep("CONFIRM_OVERWRITE");
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setSpeechDurationSec(0);
    speechChunksRef.current = [];
    setRecordingSecondsLeft(TARGET_RECORDING_DURATION_SEC);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      await vad.start(stream);
      setStep("RECORDING");

      let remaining = TARGET_RECORDING_DURATION_SEC;
      countdownIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        setRecordingSecondsLeft(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          finishRecording();
        }
      }, 1000);
    } catch (err: unknown) {
      console.error("Microphone access error:", err);
      setErrorMessage("Microphone access was denied. Please allow microphone permissions to enroll your Voice ID.");
      setStep("ERROR");
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round((speechDurationSec / MIN_REQUIRED_SPEECH_SEC) * 100)
  );

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="voice-id-title">
      <div className="modal" style={{ maxWidth: "460px" }}>
        {/* Header */}
        <div className="info-modal-header">
          <div className="info-modal-title-group">
            <h2 id="voice-id-title">Set up your Voice ID</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        {/* Step 1: Ready View */}
        {step === "READY" && (
          <div>
            {hasExistingProfile && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12.5px",
                  color: "var(--color-success)",
                  fontWeight: 600,
                  marginBottom: "14px",
                }}
              >
                <span>● Voice ID enrolled ({existingEnrolledAt ?? "Active"})</span>
              </div>
            )}

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 14px 0" }}>
              Record your voice to create your secure voice profile. VIRA uses this baseline to verify your identity during active calls.
            </p>

            <div className="enrollment-prompt-box-minimal">
              <span style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "4px" }}>
                Enrollment Passphrase
              </span>
              <p>
                &ldquo;My name is my voice. I authorize VIRA to verify my identity and protect this conversation against AI voice cloning.&rdquo;
              </p>
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 20px 0", lineHeight: 1.4 }}>
              Audio is processed in memory to generate a 192-dimensional numerical embedding and is never saved to disk.
            </p>

            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-black" onClick={handleStartEnrollmentClick}>
                {hasExistingProfile ? "Re-record Voice ID" : "Start Recording"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Overwrite Confirmation */}
        {step === "CONFIRM_OVERWRITE" && (
          <div>
            <p style={{ fontSize: "14px", color: "var(--color-black)", fontWeight: 600, margin: "0 0 8px 0" }}>
              Replace existing Voice Profile?
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              A voice profile is already enrolled. Re-recording will replace your existing biometric baseline.
            </p>

            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setStep("READY")}>
                Cancel
              </button>
              <button className="btn-danger" onClick={startRecording}>
                Replace &amp; Record
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Live Recording with Waveform */}
        {step === "RECORDING" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-black)", fontWeight: 700, fontSize: "13px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-danger)", display: "inline-block" }} />
                <span>RECORDING 00:{recordingSecondsLeft < 10 ? `0${recordingSecondsLeft}` : recordingSecondsLeft}</span>
              </div>
              <span style={{ fontSize: "12px", color: vad.isSpeaking ? "var(--color-success)" : "var(--text-muted)", fontWeight: 600 }}>
                {vad.isSpeaking
                  ? "● Collecting speech..."
                  : speechDurationSec > 0
                  ? "Pausing (buffering)..."
                  : "Waiting for speech..."}
              </span>
            </div>

            <div className="enrollment-prompt-box-minimal">
              <p>
                &ldquo;My name is my voice. I authorize VIRA to verify my identity and protect this conversation against AI voice cloning.&rdquo;
              </p>
            </div>

            <div style={{ margin: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                <span>Clean speech: {speechDurationSec.toFixed(1)}s / {MIN_REQUIRED_SPEECH_SEC}s</span>
                <span style={{ fontWeight: 600 }}>{progressPercent}%</span>
              </div>
              <div className="enrollment-mono-progress">
                <div
                  className={`enrollment-mono-progress-fill ${progressPercent >= 100 ? "complete" : ""}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-black" onClick={finishRecording}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Processing */}
        {step === "PROCESSING" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="cyber-spinner" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "14px 0 4px 0" }}>Processing Voice ID...</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              Computing 192-dimensional speaker embedding.
            </p>
          </div>
        )}

        {/* Step 5: Enrolled Success */}
        {step === "ENROLLED" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "28px", color: "var(--color-success)", marginBottom: "8px" }}>✓</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0" }}>Voice ID Created</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 auto 20px auto" }}>
              Your voice profile is ready for secure verification during live conversations.
            </p>
            <button className="btn-black" onClick={onClose} style={{ padding: "8px 24px" }}>
              Done
            </button>
          </div>
        )}

        {/* Insufficient Speech */}
        {step === "INSUFFICIENT_SPEECH" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0" }}>Insufficient Speech Detected</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 18px 0" }}>
              Captured {speechDurationSec.toFixed(1)}s of clean speech (minimum {MIN_REQUIRED_SPEECH_SEC}s required). Please speak clearly into your microphone.
            </p>
            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button className="btn-outline" onClick={() => setStep("READY")}>
                Back
              </button>
              <button className="btn-black" onClick={startRecording}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === "ERROR" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--color-danger)" }}>Enrollment Failed</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 18px 0" }}>
              {errorMessage ?? "An unexpected error occurred during enrollment."}
            </p>
            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button className="btn-outline" onClick={() => setStep("READY")}>
                Back
              </button>
              <button className="btn-black" onClick={startRecording}>
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
