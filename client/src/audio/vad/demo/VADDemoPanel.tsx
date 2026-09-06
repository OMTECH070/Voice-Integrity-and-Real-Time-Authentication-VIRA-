import { useEffect, useState } from "react";
import { useVoiceActivityDetector } from "../useVoiceActivityDetector";
import { encodeWavPCM16 } from "../pcm";

/**
 * Standalone manual test harness for the VAD subsystem — NOT wired into
 * the app's routes or components. It requests the mic directly rather than
 * going through WebRTCPeer, so it can be exercised in isolation without
 * touching call/auth code.
 *
 * To try it: temporarily render <VADDemoPanel /> from main.tsx or a scratch
 * route while testing, then remove — this file is intentionally not
 * imported anywhere else so it never affects the shared app tree.
 */
export function VADDemoPanel() {
  const { state, isSpeaking, lastFrame, segments, start, stop } =
    useVoiceActivityDetector();
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [segmentUrls, setSegmentUrls] = useState<(string | null)[]>([]);

  // One object URL per completed segment that actually has audio, so you
  // can play it back and confirm by ear that only the spoken part made it
  // through (no leading/trailing silence). Built lazily as segments arrive
  // rather than up front — revoked on unmount to avoid leaking blobs.
  useEffect(() => {
    const urls = segments.map((segment) => {
      if (!segment.audio || !segment.sampleRate) return null;
      const blob = encodeWavPCM16(segment.audio, segment.sampleRate);
      return URL.createObjectURL(blob);
    });
    setSegmentUrls(urls);
    return () => {
      urls.forEach((url) => url && URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

  const handleStart = async () => {
    setError(null);
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(micStream);
      await start(micStream);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStop = async () => {
    await stop();
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 16, maxWidth: 480 }}>
      <h3>VAD Demo</h3>
      <p>state: {state}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} disabled={state === "running" || state === "starting"}>
          Start mic
        </button>
        <button onClick={handleStop} disabled={state !== "running"}>
          Stop
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: isSpeaking ? "#2ecc71" : "#555",
          marginBottom: 12,
        }}
        title={isSpeaking ? "speech" : "silence"}
      />

      {lastFrame && (
        <pre style={{ fontSize: 12 }}>
          {JSON.stringify(
            {
              label: lastFrame.label,
              energyDb: Math.round(lastFrame.energyDb * 10) / 10,
              zcr: Math.round(lastFrame.zcr * 1000) / 1000,
              timestampMs: lastFrame.timestampMs,
            },
            null,
            2
          )}
        </pre>
      )}

      <h4>Segments ({segments.length})</h4>
      <p style={{ fontSize: 11, color: "#888" }}>
        Each clip below is the speech-only audio the VAD captured for that
        segment — silence before/after was never recorded, so if playback
        starts and ends right on the words, the gate is working.
      </p>
      <ul style={{ fontSize: 12, listStyle: "none", padding: 0 }}>
        {segments.map((segment, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {segment.startMs}ms → {segment.endMs ?? "…"}ms
            {segmentUrls[i] ? (
              <audio controls src={segmentUrls[i]!} style={{ verticalAlign: "middle", marginLeft: 8, height: 24 }} />
            ) : (
              <span style={{ color: "#888", marginLeft: 8 }}>(no audio captured)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
