import { useRef, useState } from "react";
import { enrollVoice } from "../services/voiceVerificationApi";

interface EnrollVoiceProps {
  onClose: () => void;
}

const ENROLLMENT_SECONDS = 8;

export function EnrollVoice({ onClose }: EnrollVoiceProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function handleRecord() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setStatus("uploading");
        const result = await enrollVoice(blob);
        if (result.ok) {
          setStatus("done");
          setMessage("Voice enrolled successfully.");
        } else {
          setStatus("error");
          setMessage(result.message);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");

      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, ENROLLMENT_SECONDS * 1000);
    } catch {
      setStatus("error");
      setMessage("Could not access your microphone. Check browser permissions.");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Enroll Your Voice</h2>
        <p className="tagline">
          This lets people verify it's really you calling — even if your
          account is logged in on a device that isn't yours. Speak clearly
          and continuously for {ENROLLMENT_SECONDS} seconds when you click
          Record.
        </p>

        {message && (
          <div className={status === "error" ? "error-banner" : "contact-status"}>
            <span>{message}</span>
          </div>
        )}

        <div className="modal-actions">
          {status === "idle" || status === "error" ? (
            <button onClick={handleRecord}>Record {ENROLLMENT_SECONDS}s</button>
          ) : status === "recording" ? (
            <button disabled>Recording...</button>
          ) : status === "uploading" ? (
            <button disabled>Processing...</button>
          ) : (
            <button onClick={onClose}>Done</button>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
