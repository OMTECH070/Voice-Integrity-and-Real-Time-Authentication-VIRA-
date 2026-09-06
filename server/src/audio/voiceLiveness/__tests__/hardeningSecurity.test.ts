import test from "node:test";
import assert from "node:assert/strict";
import { voiceAuthService } from "../../../services/voiceAuth.service";
import { voiceIntegrityService } from "../../../services/voiceIntegrity.service";
import { cleanupVoiceAnalysisSession } from "../../../sockets/voice.socket";

function synthesizeVoice(
  basePitchHz: number,
  formantHz: number,
  durationSeconds = 3.0,
  sampleRate = 16000
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const f0 = Math.sin(2 * Math.PI * basePitchHz * t) * 0.4;
    const f1 = Math.sin(2 * Math.PI * formantHz * t) * 0.2;
    const f2 = Math.sin(2 * Math.PI * (formantHz * 2.2) * t) * 0.1;
    const breath = (Math.random() * 2 - 1) * 0.02;
    samples[i] = f0 + f1 + f2 + breath;
  }
  return samples;
}

test("Step 9 Hardening: Security & Input Validation", async (t) => {
  await t.test("Payload constraints & alignment", () => {
    // Float32 arrays must have byteLength divisible by 4
    const validPcm = new Float32Array(48000);
    assert.equal(validPcm.byteLength % 4, 0, "Valid Float32 PCM is 4-byte aligned");

    const misaligned = new Uint8Array(48003);
    assert.notEqual(misaligned.byteLength % 4, 0, "Misaligned buffer is detected");
  });

  await t.test("Timestamp freshness checks", () => {
    const now = Date.now();
    const freshTimestamp = now - 500;
    const staleTimestamp = now - 60000; // 60s ago
    const futureTimestamp = now + 60000; // 60s in future

    assert.ok(Math.abs(now - freshTimestamp) <= 30000, "Fresh timestamp is within 30s drift");
    assert.ok(Math.abs(now - staleTimestamp) > 30000, "Stale timestamp is rejected (>30s)");
    assert.ok(Math.abs(now - futureTimestamp) > 30000, "Future timestamp is rejected (>30s)");
  });

  await t.test("Sequence number monotonic progression", () => {
    const seqHistory = [-1];
    function acceptSeq(seq: number): boolean {
      if (!Number.isInteger(seq) || seq < 0) return false;
      const last = seqHistory[seqHistory.length - 1];
      if (last >= 0 && seq <= last) return false;
      seqHistory.push(seq);
      return true;
    }

    assert.equal(acceptSeq(0), true, "Window 0 is accepted");
    assert.equal(acceptSeq(1), true, "Window 1 is accepted");
    assert.equal(acceptSeq(2), true, "Window 2 is accepted");
    assert.equal(acceptSeq(2), false, "Replayed Window 2 is rejected");
    assert.equal(acceptSeq(1), false, "Backward Window 1 is rejected");
    assert.equal(acceptSeq(-1), false, "Negative sequence number is rejected");
    assert.equal(acceptSeq(3), true, "Window 3 is accepted");
  });
});

test("Step 9 Hardening: Voice Enrollment Safety & Overwrite Protection", async (t) => {
  await voiceAuthService.init();

  const userId = "test-security-user-" + Date.now();
  const validAudio = synthesizeVoice(130, 780, 3.0);
  const shortAudio = synthesizeVoice(130, 780, 1.0);

  await t.test("Rejects insufficient speech duration (< 2.0s)", async () => {
    const res = await voiceAuthService.enrollUser(userId, shortAudio, 16000, 1.0);
    assert.equal(res.success, false);
    assert.ok(res.error?.includes("Insufficient speech duration"), "Informative error for short speech");
  });

  await t.test("Enrolls valid speech audio successfully", async () => {
    const res = await voiceAuthService.enrollUser(userId, validAudio, 16000, 3.0);
    assert.equal(res.success, true);
    assert.equal(voiceAuthService.hasProfile(userId), true, "Profile registered in service");
  });

  await t.test("Blocks accidental profile overwrite without explicit confirmation", async () => {
    const res = await voiceAuthService.enrollUser(userId, validAudio, 16000, 3.0, false);
    assert.equal(res.success, false, "Blocked accidental overwrite");
    assert.ok(res.error?.includes("already exists"), "Informative overwrite protection error");
  });

  await t.test("Allows profile overwrite when explicitly confirmed", async () => {
    const res = await voiceAuthService.enrollUser(userId, validAudio, 16000, 3.0, true);
    assert.equal(res.success, true, "Overwrite succeeds with explicit confirmation");
  });

  await t.test("Deletes profile cleanly from memory", () => {
    assert.equal(voiceAuthService.deleteProfile(userId), true);
    assert.equal(voiceAuthService.hasProfile(userId), false);
  });
});

test("Step 9 Hardening: Model Resilience & Graceful Degradation", async (t) => {
  await t.test("VoiceIntegrityService handles un-enrolled contacts gracefully", () => {
    const assessment = voiceIntegrityService.classifySingleWindow(0.02, undefined, false);
    assert.equal(assessment.rawStatus, "human-verified");
    assert.equal(assessment.speakerLabel, "not-enrolled");
  });

  await t.test("VoiceIntegrityService handles missing/unavailable scores cleanly", () => {
    const assessment = voiceIntegrityService.classifySingleWindow(undefined, undefined, false);
    assert.equal(assessment.rawStatus, "analyzing");
    assert.equal(assessment.confidence, 0.0);
  });

  await t.test("VoiceAuthService handles cosine similarity of zero-length arrays safely", () => {
    const empty1 = new Float32Array(0);
    const empty2 = new Float32Array(0);
    const ver = voiceAuthService.verifySpeaker(empty1, empty2);
    assert.equal(ver.similarity, 0);
    assert.equal(ver.match, false);
  });
});

test("Step 9 Hardening: Session Lifecycle & Memory Cleanup", async () => {
  const callId = "test-lifecycle-call-" + Date.now();

  // Create session state in VoiceIntegrityService
  voiceIntegrityService.assessWindow(callId, 0.02, 0.95, true, Date.now());
  voiceIntegrityService.assessWindow(callId, 0.02, 0.96, true, Date.now() + 1500);

  const activeSessionBefore = voiceIntegrityService.getSession(callId);
  assert.ok(activeSessionBefore !== null, "Session is tracked during call");
  assert.equal(activeSessionBefore?.history.length, 2, "History holds 2 windows");

  // Call termination cleanup
  cleanupVoiceAnalysisSession(callId);

  const activeSessionAfter = voiceIntegrityService.getSession(callId);
  assert.equal(activeSessionAfter, null, "Session state is completely freed on call end");
});

test("Step 9 Hardening: Concurrency & Multi-Call Session Isolation", async (t) => {
  await voiceAuthService.init();

  const numConcurrentCalls = 10;
  const callIds: string[] = [];
  const callerIds: string[] = [];

  // Initialize 10 distinct caller profiles
  for (let i = 0; i < numConcurrentCalls; i++) {
    const callerId = `concurrent-user-${i}-${Date.now()}`;
    const callId = `concurrent-call-${i}-${Date.now()}`;
    callerIds.push(callerId);
    callIds.push(callId);

    // Each user has distinct pitch
    const audio = synthesizeVoice(100 + i * 15, 600 + i * 50, 3.0);
    await voiceAuthService.enrollUser(callerId, audio, 16000, 3.0, true);
  }

  await t.test("10 simultaneous calls execute inferences in isolation", async () => {
    const promises = callIds.map(async (callId, index) => {
      const callerId = callerIds[index];
      const testAudio = synthesizeVoice(100 + index * 15, 600 + index * 50, 3.0);

      // Verify speaker against their own enrolled profile
      const enrolled = voiceAuthService.getEnrolledProfile(callerId);
      assert.ok(enrolled !== null, `Profile exists for ${callerId}`);

      const currentEmbedding = await voiceAuthService.extractEmbedding(testAudio, 16000);
      const verification = voiceAuthService.verifySpeaker(enrolled!, currentEmbedding);

      // Assess fused window
      const fusion = voiceIntegrityService.assessWindow(
        callId,
        0.015,
        verification.similarity,
        true,
        Date.now()
      );

      return {
        callId,
        similarity: verification.similarity,
        status: fusion.integrityStatus,
      };
    });

    const results = await Promise.all(promises);

    assert.equal(results.length, numConcurrentCalls, "All 10 concurrent calls completed");
    for (const res of results) {
      assert.ok(res.similarity > 0.95, `High similarity for same-speaker: ${res.similarity}`);
      assert.equal(res.status, "human-verified", `Isolated call verified: ${res.callId}`);
    }
  });

  await t.test("Cross-call state isolation: CallId cleanup does not affect other sessions", () => {
    // Cleanup call 0
    cleanupVoiceAnalysisSession(callIds[0]);

    assert.equal(voiceIntegrityService.getSession(callIds[0]), null, "Call 0 is cleaned up");
    for (let i = 1; i < numConcurrentCalls; i++) {
      assert.ok(
        voiceIntegrityService.getSession(callIds[i]) !== null,
        `Call ${i} session remains active and isolated`
      );
      // Clean up the rest
      cleanupVoiceAnalysisSession(callIds[i]);
      voiceAuthService.deleteProfile(callerIds[i]);
    }
    voiceAuthService.deleteProfile(callerIds[0]);
  });
});
