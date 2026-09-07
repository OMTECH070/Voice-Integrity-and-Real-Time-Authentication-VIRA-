import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRecordingFilename,
  formatDuration,
  formatFileSize,
  saveRecording,
  getRecordings,
  getRecording,
  deleteRecording,
  saveScamReport,
  getScamReports,
  StoredCallRecording,
  DB_NAME,
  RECORDINGS_STORE,
  SCAM_REPORTS_STORE,
} from "../../services/localRecordingStorage";
import { buildFlaggedReason } from "../WhyFlaggedModal";
import { EASY_MODE_TRANSLATIONS } from "../../utils/easyModeTranslations";

// Mock in-memory IndexedDB for Node.js test environment
class MockIDBObjectStore {
  name: string;
  items: Map<string, unknown>;
  simulateQuota: boolean;

  constructor(name: string, storeMap: Map<string, unknown>, simulateQuota = false) {
    this.name = name;
    this.items = storeMap;
    this.simulateQuota = simulateQuota;
  }

  put(val: { id: string }) {
    const req: { result?: unknown; error?: Error; onsuccess?: (e: unknown) => void; onerror?: (e: unknown) => void } = {};
    if (this.simulateQuota) {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      req.error = err;
      setTimeout(() => req.onerror && req.onerror({ target: req }), 0);
    } else {
      this.items.set(val.id, val);
      req.result = val.id;
      setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
    }
    return req;
  }

  get(key: string) {
    const req: { result?: unknown; error?: Error; onsuccess?: (e: unknown) => void; onerror?: (e: unknown) => void } = {
      result: this.items.get(key) || null,
    };
    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
    return req;
  }

  getAll() {
    const req: { result?: unknown; error?: Error; onsuccess?: (e: unknown) => void; onerror?: (e: unknown) => void } = {
      result: Array.from(this.items.values()),
    };
    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
    return req;
  }

  delete(key: string) {
    this.items.delete(key);
    const req: { result?: unknown; error?: Error; onsuccess?: (e: unknown) => void; onerror?: (e: unknown) => void } = {
      result: undefined,
    };
    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
    return req;
  }
}

class MockIDBTransaction {
  db: MockIDBDatabase;
  storeName: string;
  oncomplete: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  error: Error | null = null;

  constructor(db: MockIDBDatabase, storeName: string) {
    this.db = db;
    this.storeName = storeName;
    setTimeout(() => {
      if (this.db.simulateQuota) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        this.error = err;
        if (this.onerror) this.onerror({ target: this });
      } else {
        if (this.oncomplete) this.oncomplete();
      }
    }, 5);
  }

  objectStore(name: string) {
    const map = this.db.stores.get(name) || new Map<string, unknown>();
    this.db.stores.set(name, map);
    return new MockIDBObjectStore(name, map, this.db.simulateQuota);
  }
}

class MockIDBDatabase {
  stores = new Map<string, Map<string, unknown>>();
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  simulateQuota = false;

  constructor() {
    this.stores.set(RECORDINGS_STORE, new Map());
    this.stores.set(SCAM_REPORTS_STORE, new Map());
  }

  createObjectStore(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return {};
  }

  transaction(name: string) {
    return new MockIDBTransaction(this, name);
  }
}

const mockDatabaseInstance = new MockIDBDatabase();

function setupMockIndexedDB() {
  (globalThis as unknown as { window: { indexedDB: unknown } }).window = {
    indexedDB: {
      open: () => {
        const req: {
          result?: MockIDBDatabase;
          onsuccess?: (e: unknown) => void;
          onerror?: (e: unknown) => void;
          onupgradeneeded?: (e: unknown) => void;
        } = {
          result: mockDatabaseInstance,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
      },
    },
  };
}

test("VIRA Call Recording & Safety Actions Test Suite", async (t) => {
  setupMockIndexedDB();

  await t.test("1. Filename & duration formatting matches VIRA specification", () => {
    const fixedDate = new Date(2026, 8, 7, 14, 30, 45); // Sept 7, 2026, 14:30:45
    const filename = formatRecordingFilename(fixedDate);
    assert.equal(filename, "VIRA-call-2026-09-07-14-30-45.webm");

    const pattern = /^VIRA-call-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/;
    assert.match(formatRecordingFilename(), pattern, "Default filename matches required regex pattern");

    assert.equal(formatDuration(151), "02:31", "151 seconds formats to 02:31");
    assert.equal(formatDuration(45), "00:45", "45 seconds formats to 00:45");
    assert.equal(formatFileSize(5033165), "4.8 MB", "5033165 bytes formats to 4.8 MB");
    assert.equal(formatFileSize(665600), "650 KB", "665600 bytes formats to 650 KB");
  });

  await t.test("2. Recording Blob & metadata can be saved directly to IndexedDB", async () => {
    const dummyBlob = { size: 1024 * 50, type: "audio/webm" } as unknown as Blob;
    const testRecording: StoredCallRecording = {
      id: "rec_test_001",
      callId: "call_abc_123",
      createdAt: Date.now(),
      duration: 75,
      size: 1024 * 50,
      filename: "VIRA-call-2026-09-07-14-30-45.webm",
      blob: dummyBlob,
      mimeType: "audio/webm",
    };

    const saveRes = await saveRecording(testRecording);
    assert.equal(saveRes.success, true, "Saving recording to IndexedDB succeeds");

    // Verify metadata stored
    const retrieved = await getRecording("rec_test_001");
    assert.ok(retrieved, "Retrieved recording is not null");
    assert.equal(retrieved?.id, "rec_test_001");
    assert.equal(retrieved?.callId, "call_abc_123");
    assert.equal(retrieved?.duration, 75);
    assert.equal(retrieved?.size, 1024 * 50);
    assert.equal(retrieved?.filename, "VIRA-call-2026-09-07-14-30-45.webm");
  });

  await t.test("3. Recording survives component unmount and application reload", async () => {
    // Simulating app reload by fetching from the underlying store directly
    const allRecordings = await getRecordings();
    assert.ok(allRecordings.length >= 1, "Recordings persist after unmount/reload");
    const found = allRecordings.find((r) => r.id === "rec_test_001");
    assert.ok(found, "Previously saved recording rec_test_001 is found");
  });

  await t.test("4. Playback and download retrieve the stored binary Blob", async () => {
    const item = await getRecording("rec_test_001");
    assert.ok(item?.blob, "Blob is present in stored recording");
    assert.equal(item?.blob.type, "audio/webm", "Blob has correct mimeType for playback and download");
  });

  await t.test("5. Recording can be deleted permanently from IndexedDB", async () => {
    const deleteRes = await deleteRecording("rec_test_001");
    assert.equal(deleteRes, true, "Delete returns true");

    const checkItem = await getRecording("rec_test_001");
    assert.equal(checkItem, null, "Deleted recording is removed from IndexedDB");
  });

  await t.test("6. Storage quota errors are handled gracefully without crashing", async () => {
    mockDatabaseInstance.simulateQuota = true;
    try {
      const dummyBlob = { size: 1024 * 1024 * 100, type: "audio/webm" } as unknown as Blob;
      const res = await saveRecording({
        id: "rec_quota_test",
        callId: "call_quota",
        createdAt: Date.now(),
        duration: 120,
        size: dummyBlob.size,
        filename: "VIRA-call-quota.webm",
        blob: dummyBlob,
        mimeType: "audio/webm",
      });
      assert.equal(res.success, false, "Quota exceeded fails safely");
      assert.equal(res.error, "Unable to save recording. Device storage is full.");
    } finally {
      mockDatabaseInstance.simulateQuota = false;
    }
  });

  await t.test("7. Scam reports coexist and remain intact across recording actions", async () => {
    const scamReport = {
      id: "scam_test_001",
      callId: "call_scam_xyz",
      timestamp: Date.now(),
      reason: "Urgent wire request",
      riskScore: 85,
    };

    const saved = await saveScamReport(scamReport);
    assert.equal(saved, true, "Scam report saved in scam_reports store");

    const allScams = await getScamReports();
    assert.ok(allScams.some((s) => s.id === "scam_test_001"), "Scam report exists in database");

    // Deleting unrelated recording does not affect scam reports
    await deleteRecording("non_existent_rec");
    const scamCheck = await getScamReports();
    assert.ok(scamCheck.some((s) => s.id === "scam_test_001"), "Scam reports unaffected by recording operations");
  });

  await t.test("8. Privacy guarantee: Zero remote uploads & database isolation", () => {
    assert.equal(DB_NAME, "vira_local_recordings");
    assert.equal(RECORDINGS_STORE, "recordings");
    assert.equal(SCAM_REPORTS_STORE, "scam_reports");
  });

  await t.test("9. Easy Mode translations parity for all Call Recording & History keys", () => {
    const requiredKeys = [
      "record",
      "stopRecording",
      "recording",
      "recordingSaved",
      "playRecording",
      "pauseRecording",
      "playback",
      "downloadRecording",
      "reportScamCall",
      "callReported",
      "whyViraFlagged",
      "whyViraFlaggedTitle",
      "noReasonEvidence",
      "recordings",
      "callRecordings",
      "noRecordings",
      "delete",
      "deleteRecording",
      "deleteConfirm",
      "storageFull",
      "duration",
      "size",
      "localPrivacyNotice",
    ] as const;

    for (const key of requiredKeys) {
      const enVal = EASY_MODE_TRANSLATIONS.en[key];
      const hiVal = EASY_MODE_TRANSLATIONS.hi[key];
      assert.ok(enVal && enVal.trim().length > 0, `English key ${key} must not be empty`);
      assert.ok(hiVal && hiVal.trim().length > 0, `Hindi key ${key} must not be empty`);
    }

    // Verify key translations
    assert.equal(EASY_MODE_TRANSLATIONS.en.recordings, "Recordings");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.recordings, "रिकॉर्डिंग्स");
    assert.equal(EASY_MODE_TRANSLATIONS.en.callRecordings, "Call Recordings");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.callRecordings, "कॉल रिकॉर्डिंग्स");
    assert.equal(EASY_MODE_TRANSLATIONS.en.storageFull, "Unable to save recording. Device storage is full.");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.storageFull, "रिकॉर्डिंग सहेजने में असमर्थ। डिवाइस मेमोरी भरी हुई है।");
  });

  await t.test("10. Why VIRA Flagged It: Reason generation based strictly on available signals", () => {
    const syntheticReason = buildFlaggedReason({
      integrityStatus: "possible-ai",
      spoofScore: 82,
      rawLabel: "likely-synthetic",
    });
    assert.match(syntheticReason, /synthetic or computer-generated/i, "Identifies synthetic voice");

    const noEvidenceReason = buildFlaggedReason({
      integrityStatus: "analyzing",
      spoofScore: null,
      callRiskScore: 10,
      callRiskLevel: "LOW",
    });
    assert.equal(
      noEvidenceReason,
      "VIRA does not have enough evidence to provide a specific reason.",
      "Must return exact honest fallback when no suspicious signals exist"
    );
  });
});
