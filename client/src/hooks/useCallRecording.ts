import { useCallback, useEffect, useRef, useState } from "react";
import {
  StoredCallRecording,
  saveRecording,
  formatRecordingFilename,
  formatDuration,
  formatFileSize,
  saveScamReport,
} from "../services/localRecordingStorage";

export type { StoredCallRecording };
export { formatRecordingFilename, formatDuration, formatFileSize };

/**
 * Backward compatibility alias for saveRecording
 */
export async function saveLocalRecording(recording: StoredCallRecording): Promise<boolean> {
  const result = await saveRecording(recording);
  return result.success;
}

export interface UseCallRecordingOptions {
  callId?: string;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
}

export interface UseCallRecordingResult {
  isRecording: boolean;
  isSupported: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  savedRecordingId: string | null;
  isPlaying: boolean;
  statusMessage: string | null;
  isReported: boolean;
  reportMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  togglePlayPause: () => void;
  downloadRecording: () => void;
  reportScamCall: () => void;
  clearRecording: () => void;
}

export function useCallRecording({
  callId,
  localStream,
  remoteStream,
}: UseCallRecordingOptions): UseCallRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReported, setIsReported] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Check MediaRecorder API availability
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setIsSupported(false);
    }
  }, []);

  // Cleanup object URLs and playback audio on unmount
  useEffect(() => {
    return () => {
      if (playbackAudioRef.current) {
        try {
          playbackAudioRef.current.pause();
          playbackAudioRef.current.src = "";
        } catch {
          // Ignore
        }
      }
      if (recordingUrl) {
        try {
          URL.revokeObjectURL(recordingUrl);
        } catch {
          // Ignore
        }
      }
      if (recordingAudioContextRef.current) {
        try {
          recordingAudioContextRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, [recordingUrl]);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setIsSupported(false);
      setStatusMessage("Recording is not supported on this browser.");
      return;
    }

    // Stop any existing playback
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setIsPlaying(false);
    }

    // Revoke previous URL if any
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
      setRecordingBlob(null);
    }

    chunksRef.current = [];
    setStatusMessage(null);
    recordingStartTimeRef.current = Date.now();

    let streamToRecord: MediaStream | null = null;

    // Use Web Audio to combine local and remote streams without echoing to speakers
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const hasRemoteTracks = !!remoteStream && remoteStream.getAudioTracks().length > 0;
      const hasLocalTracks = !!localStream && localStream.getAudioTracks().length > 0;

      if (AudioCtx && (hasRemoteTracks || hasLocalTracks)) {
        const ctx = new AudioCtx();
        recordingAudioContextRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();

        if (hasRemoteTracks && remoteStream) {
          try {
            const remoteSource = ctx.createMediaStreamSource(remoteStream);
            remoteSource.connect(dest);
          } catch (err) {
            console.warn("[VIRA][RECORD] Remote stream attach warning:", err);
          }
        }

        if (hasLocalTracks && localStream) {
          try {
            const localSource = ctx.createMediaStreamSource(localStream);
            localSource.connect(dest);
          } catch (err) {
            console.warn("[VIRA][RECORD] Local stream attach warning:", err);
          }
        }

        if (dest.stream.getAudioTracks().length > 0) {
          streamToRecord = dest.stream;
        }
      }
    } catch (err) {
      console.warn("[VIRA][RECORD] AudioContext mixing failed, falling back to direct stream:", err);
    }

    // Fallback: direct stream capture if AudioContext mixing was unavailable
    if (!streamToRecord) {
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        streamToRecord = remoteStream;
      } else if (localStream && localStream.getAudioTracks().length > 0) {
        streamToRecord = localStream;
      }
    }

    if (!streamToRecord || streamToRecord.getAudioTracks().length === 0) {
      setStatusMessage("No active audio stream to record.");
      return;
    }

    // Select supported audio mime type
    let selectedMimeType = "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      selectedMimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      selectedMimeType = "audio/webm";
    } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
      selectedMimeType = "audio/mp4";
    } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
      selectedMimeType = "audio/ogg";
    }

    try {
      const recorder = selectedMimeType
        ? new MediaRecorder(streamToRecord, { mimeType: selectedMimeType })
        : new MediaRecorder(streamToRecord);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const mime = recorder.mimeType || selectedMimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const durationSecs = Math.max(1, Math.round((Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000));
        const recordId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const filename = formatRecordingFilename();

        // Store safely in local IndexedDB BEFORE flagging as saved
        const saveResult = await saveRecording({
          id: recordId,
          callId: callId || "local_call",
          createdAt: Date.now(),
          duration: durationSecs,
          size: blob.size,
          blob,
          mimeType: mime,
          filename,
          reportedAsScam: isReported,
        });

        if (saveResult.success) {
          setRecordingBlob(blob);
          setRecordingUrl(url);
          setSavedRecordingId(recordId);
          setIsRecording(false);
          setStatusMessage("Recording saved locally.");
        } else {
          // Gracefully display quota or storage error message
          setIsRecording(false);
          setStatusMessage(saveResult.error || "Unable to save recording. Device storage is full.");
        }

        // Close temporary recording audio context
        if (recordingAudioContextRef.current) {
          try {
            recordingAudioContextRef.current.close();
          } catch {
            // Ignore
          }
          recordingAudioContextRef.current = null;
        }
      };

      recorder.onerror = (e) => {
        console.warn("[VIRA][RECORD] MediaRecorder error:", e);
        setIsRecording(false);
        setStatusMessage("Recording encountered an error.");
      };

      // Collect audio chunks every 500ms
      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatusMessage("Recording...");
    } catch (err) {
      console.warn("[VIRA][RECORD] Failed to start MediaRecorder:", err);
      setIsRecording(false);
      setStatusMessage("Unable to start recording.");
    }
  }, [localStream, remoteStream, recordingUrl, callId, isReported]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("[VIRA][RECORD] Error stopping recorder:", err);
        setIsRecording(false);
      }
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!recordingUrl) return;

    if (!playbackAudioRef.current) {
      const audio = new Audio(recordingUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      playbackAudioRef.current = audio;
    }

    const audio = playbackAudioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[VIRA][PLAYBACK] Playback error:", err);
          setIsPlaying(false);
        });
    }
  }, [recordingUrl, isPlaying]);

  const downloadRecording = useCallback(() => {
    if (!recordingUrl) return;
    const filename = formatRecordingFilename();
    const a = document.createElement("a");
    a.href = recordingUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [recordingUrl]);

  const reportScamCall = useCallback(async () => {
    setIsReported(true);
    setReportMessage("Call reported as suspicious.");

    // Store suspicious call report to IndexedDB
    try {
      await saveScamReport({
        id: `scam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        callId: callId || "local_call",
        timestamp: Date.now(),
        reason: "User flagged call as suspicious",
      });
    } catch (err) {
      console.warn("[VIRA][RECORD] Could not save scam report locally:", err);
    }
  }, [callId]);

  const clearRecording = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setIsPlaying(false);
    }
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingBlob(null);
    setRecordingUrl(null);
    setSavedRecordingId(null);
    setStatusMessage(null);
    setIsPlaying(false);
  }, [recordingUrl]);

  return {
    isRecording,
    isSupported,
    recordingBlob,
    recordingUrl,
    savedRecordingId,
    isPlaying,
    statusMessage,
    isReported,
    reportMessage,
    startRecording,
    stopRecording,
    togglePlayPause,
    downloadRecording,
    reportScamCall,
    clearRecording,
  };
}
