import { useEffect, useRef, useState } from "react";
import {
  StoredCallRecording,
  getRecordings,
  deleteRecording,
  formatDuration,
  formatFileSize,
} from "../services/localRecordingStorage";
import { useEasyMode } from "../context/EasyModeContext";

interface RecordingsPanelProps {
  onBack?: () => void;
}

export function RecordingsPanel({ onBack }: RecordingsPanelProps) {
  const { isEasyMode, t } = useEasyMode();
  const [recordings, setRecordings] = useState<StoredCallRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);

  async function loadRecordings() {
    setIsLoading(true);
    try {
      const items = await getRecordings();
      setRecordings(items);
    } catch (err) {
      console.warn("[VIRA][RECORDINGS] Error loading recordings:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecordings();

    return () => {
      // Clean up any active audio on unmount
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.src = "";
        } catch {
          // Ignore
        }
      }
      if (activeAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(activeAudioUrlRef.current);
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  function handlePlayPause(recording: StoredCallRecording) {
    // If clicking on the currently playing audio -> pause it
    if (activePlayingId === recording.id && activeAudioRef.current) {
      activeAudioRef.current.pause();
      setActivePlayingId(null);
      return;
    }

    // Stop any existing playback
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
      } catch {
        // Ignore
      }
      activeAudioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(activeAudioUrlRef.current);
      } catch {
        // Ignore
      }
      activeAudioUrlRef.current = null;
    }

    // Create temporary Object URL strictly for playback
    const url = URL.createObjectURL(recording.blob);
    activeAudioUrlRef.current = url;

    const audio = new Audio(url);
    activeAudioRef.current = audio;

    audio.onended = () => {
      setActivePlayingId(null);
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }
    };

    audio.onerror = (e) => {
      console.warn("[VIRA][RECORDINGS] Playback error:", e);
      setActivePlayingId(null);
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }
    };

    audio
      .play()
      .then(() => {
        setActivePlayingId(recording.id);
      })
      .catch((err) => {
        console.warn("[VIRA][RECORDINGS] Playback failed:", err);
        setActivePlayingId(null);
      });
  }

  function handleDownload(recording: StoredCallRecording) {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = recording.filename || `VIRA-call-${recording.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  async function handleDeleteConfirm(id: string) {
    // Stop playback if deleting active recording
    if (activePlayingId === id) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
        } catch {
          // Ignore
        }
      }
      if (activeAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(activeAudioUrlRef.current);
        } catch {
          // Ignore
        }
        activeAudioUrlRef.current = null;
      }
      setActivePlayingId(null);
    }

    const success = await deleteRecording(id);
    setConfirmDeleteId(null);

    if (success) {
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      setStatusMessage("Recording deleted.");
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage("Failed to delete recording.");
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }

  function formatDisplayDate(timestamp: number): string {
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateStr} — ${timeStr}`;
  }

  return (
    <div className="recordings-panel-container" role="region" aria-label="Call Recordings">
      {/* Header */}
      <div className="recordings-panel-header">
        <div>
          <h2 className="section-label-minimal" style={{ margin: 0, fontSize: isEasyMode ? "22px" : "16px" }}>
            🎙️ {t("callRecordings")}
          </h2>
          <p className="recordings-panel-subtitle">
            {t("localPrivacyNotice")}
          </p>
        </div>
        {onBack && (
          <button className="btn-outline" onClick={onBack} aria-label={t("back")}>
            {t("back")}
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="call-recording-status-msg" style={{ marginBottom: "16px" }} role="status">
          {statusMessage}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="empty-list-notice">Loading recordings...</div>
      ) : recordings.length === 0 ? (
        /* Empty state */
        <div className="empty-list-notice" style={{ padding: "48px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📁</div>
          <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
            {t("noRecordings")}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Use the Record button during a live call to preserve and inspect conversations locally.
          </div>
        </div>
      ) : (
        /* Recording list */
        <div className="recordings-list-grid">
          {recordings.map((rec) => {
            const isPlaying = activePlayingId === rec.id;
            const isConfirmingDelete = confirmDeleteId === rec.id;

            return (
              <div
                key={rec.id}
                className="recording-card-minimal"
                style={
                  isEasyMode
                    ? {
                        border: "2px solid #000000",
                        borderRadius: "10px",
                        padding: "18px 20px",
                        background: "#ffffff",
                      }
                    : undefined
                }
              >
                <div className="recording-card-header">
                  <div>
                    <div className="recording-card-title">
                      🎙️ {t("recordings")}
                    </div>
                    <div className="recording-card-date">
                      {formatDisplayDate(rec.createdAt)}
                    </div>
                  </div>

                  {rec.reportedAsScam && (
                    <span className="recording-scam-badge" title="Reported as suspicious">
                      ⚠️ Reported
                    </span>
                  )}
                </div>

                {/* Metadata row */}
                <div className="recording-card-meta">
                  <span className="recording-meta-item">
                    <strong>{t("duration")}:</strong> {formatDuration(rec.duration)}
                  </span>
                  <span className="recording-meta-dot">•</span>
                  <span className="recording-meta-item">
                    <strong>{t("size")}:</strong> {formatFileSize(rec.size)}
                  </span>
                  <span className="recording-meta-dot">•</span>
                  <span className="recording-meta-filename" title={rec.filename}>
                    {rec.filename}
                  </span>
                </div>

                {/* Inline delete confirmation prompt */}
                {isConfirmingDelete ? (
                  <div className="recording-delete-confirm">
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("deleteConfirm")}
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn-recording-action btn-danger"
                        onClick={() => handleDeleteConfirm(rec.id)}
                        aria-label={`Confirm delete ${rec.filename}`}
                      >
                        {t("delete")}
                      </button>
                      <button
                        className="btn-recording-action"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action controls */
                  <div className="recording-card-actions">
                    <button
                      className={`btn-recording-action ${isPlaying ? "active-playing" : ""}`}
                      onClick={() => handlePlayPause(rec)}
                      aria-label={isPlaying ? t("pauseRecording") : t("playRecording")}
                      style={isEasyMode ? { padding: "10px 18px", fontSize: "14px", fontWeight: 700 } : undefined}
                    >
                      {isPlaying ? `⏸ ${t("pauseRecording")}` : `▶ ${t("playRecording")}`}
                    </button>

                    <button
                      className="btn-recording-action"
                      onClick={() => handleDownload(rec)}
                      aria-label={`${t("downloadRecording")} ${rec.filename}`}
                      style={isEasyMode ? { padding: "10px 18px", fontSize: "14px", fontWeight: 700 } : undefined}
                    >
                      💾 {t("downloadRecording")}
                    </button>

                    <button
                      className="btn-recording-action btn-delete"
                      onClick={() => setConfirmDeleteId(rec.id)}
                      aria-label={`${t("deleteRecording")} ${rec.filename}`}
                      style={isEasyMode ? { padding: "10px 18px", fontSize: "14px", fontWeight: 700 } : undefined}
                    >
                      🗑️ {t("delete")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
