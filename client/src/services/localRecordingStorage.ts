/**
 * VIRA Local Recording Storage Service
 *
 * Privacy-First, On-Device Call Recording Storage via browser IndexedDB.
 * Audio Blobs are stored directly on the user's device and are NEVER uploaded
 * to Supabase, external APIs, cloud storage, or third-party servers.
 *
 * Coexists with the scam_reports object store in vira_local_recordings database.
 */

export interface StoredCallRecording {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
  duration?: number; // duration in seconds
  size: number; // size in bytes
  filename: string;
  callId?: string;
  reportedAsScam?: boolean;
}

export interface StoredScamReport {
  id: string;
  callId: string;
  timestamp: number;
  reason?: string;
  riskScore?: number;
  details?: Record<string, unknown>;
}

export interface SaveRecordingResult {
  success: boolean;
  error?: string;
}

export const DB_NAME = "vira_local_recordings";
export const RECORDINGS_STORE = "recordings";
export const SCAM_REPORTS_STORE = "scam_reports";
export const DB_VERSION = 2;

/**
 * Open or initialize local IndexedDB for secure, on-device recording & scam report storage.
 * Safely creates both object stores on upgrade without altering existing records.
 */
export function openRecordingsDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
          db.createObjectStore(RECORDINGS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SCAM_REPORTS_STORE)) {
          db.createObjectStore(SCAM_REPORTS_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => {
        console.warn("[VIRA][STORAGE] IndexedDB open failed:", err);
        resolve(null);
      };
    } catch (err) {
      console.warn("[VIRA][STORAGE] IndexedDB exception:", err);
      resolve(null);
    }
  });
}

/**
 * Formats a timestamp into the required VIRA recording filename:
 * VIRA-call-YYYY-MM-DD-HH-MM-SS.webm
 */
export function formatRecordingFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `VIRA-call-${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}.webm`;
}

/**
 * Formats seconds into MM:SS display format (e.g. 151 -> "02:31").
 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return "--:--";
  }
  const totalSecs = Math.round(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formats bytes into human-readable MB / KB string (e.g. 5033165 -> "4.8 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return "0 KB";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Save recording blob and metadata directly into IndexedDB.
 * Handles storage quota limits gracefully.
 */
export async function saveRecording(recording: StoredCallRecording): Promise<SaveRecordingResult> {
  const db = await openRecordingsDb();
  if (!db) {
    return { success: false, error: "Local storage is not available in this browser." };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECORDINGS_STORE, "readwrite");
      const store = tx.objectStore(RECORDINGS_STORE);

      const request = store.put(recording);

      request.onsuccess = () => {
        // Transaction completion will finalize
      };

      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        if (error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
          resolve({ success: false, error: "Unable to save recording. Device storage is full." });
        } else {
          resolve({ success: false, error: error?.message || "Failed to save recording to local storage." });
        }
      };

      tx.oncomplete = () => {
        resolve({ success: true });
      };

      tx.onerror = (event) => {
        const error = tx.error || (event.target as IDBTransaction)?.error;
        if (error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
          resolve({ success: false, error: "Unable to save recording. Device storage is full." });
        } else {
          resolve({ success: false, error: error?.message || "Storage transaction failed." });
        }
      };
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      if (errorObj && (errorObj.name === "QuotaExceededError" || errorObj.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
        resolve({ success: false, error: "Unable to save recording. Device storage is full." });
      } else {
        resolve({ success: false, error: errorObj?.message || "Exception while saving recording." });
      }
    }
  });
}

/**
 * Retrieve all persistent recordings from local IndexedDB, ordered descending by createdAt.
 */
export async function getRecordings(): Promise<StoredCallRecording[]> {
  const db = await openRecordingsDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECORDINGS_STORE, "readonly");
      const store = tx.objectStore(RECORDINGS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const results: StoredCallRecording[] = request.result || [];
        // Sort descending by creation timestamp (newest first)
        results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(results);
      };

      request.onerror = () => {
        console.warn("[VIRA][STORAGE] Error fetching recordings:", request.error);
        resolve([]);
      };
    } catch (err) {
      console.warn("[VIRA][STORAGE] Exception fetching recordings:", err);
      resolve([]);
    }
  });
}

/**
 * Retrieve a single recording by its unique ID.
 */
export async function getRecording(id: string): Promise<StoredCallRecording | null> {
  const db = await openRecordingsDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECORDINGS_STORE, "readonly");
      const store = tx.objectStore(RECORDINGS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.warn("[VIRA][STORAGE] Error getting recording:", request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("[VIRA][STORAGE] Exception getting recording:", err);
      resolve(null);
    }
  });
}

/**
 * Delete a recording from local IndexedDB by its unique ID.
 */
export async function deleteRecording(id: string): Promise<boolean> {
  const db = await openRecordingsDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RECORDINGS_STORE, "readwrite");
      const store = tx.objectStore(RECORDINGS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        // Will complete on tx.oncomplete
      };

      tx.oncomplete = () => {
        resolve(true);
      };

      tx.onerror = () => {
        console.warn("[VIRA][STORAGE] Error deleting recording:", tx.error);
        resolve(false);
      };
    } catch (err) {
      console.warn("[VIRA][STORAGE] Exception deleting recording:", err);
      resolve(false);
    }
  });
}

/**
 * Save a scam report entry to the scam_reports store.
 */
export async function saveScamReport(report: StoredScamReport): Promise<boolean> {
  const db = await openRecordingsDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SCAM_REPORTS_STORE, "readwrite");
      const store = tx.objectStore(SCAM_REPORTS_STORE);
      store.put(report);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (err) {
      console.warn("[VIRA][STORAGE] Exception saving scam report:", err);
      resolve(false);
    }
  });
}

/**
 * Retrieve all scam reports from the scam_reports store.
 */
export async function getScamReports(): Promise<StoredScamReport[]> {
  const db = await openRecordingsDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SCAM_REPORTS_STORE, "readonly");
      const store = tx.objectStore(SCAM_REPORTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    } catch (err) {
      resolve([]);
    }
  });
}
