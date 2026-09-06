import test from "node:test";
import assert from "node:assert/strict";
import { VoiceIntegrityService } from "../../../services/voiceIntegrity.service";
import { voiceAuthService } from "../../../services/voiceAuth.service";
import { evaluateCalibrationCorpus, AudioSample } from "../calibration";

test("VoiceIntegrityService: Decision Matrix and Single Window Classification", async (t) => {
  const service = new VoiceIntegrityService();

  await t.test("1. Human live + Matching enrolled speaker -> human-verified", () => {
    const res = service.classifySingleWindow(0.05, 0.98, true);
    assert.equal(res.rawStatus, "human-verified");
    assert.equal(res.spoofLabel, "live");
    assert.equal(res.speakerLabel, "match");
    assert.ok(res.confidence > 0.8, "High confidence for genuine verified caller");
  });

  await t.test("2. Human live + Mismatching speaker (Impostor) -> speaker-mismatch", () => {
    const res = service.classifySingleWindow(0.12, 0.65, true);
    assert.equal(res.rawStatus, "speaker-mismatch");
    assert.equal(res.spoofLabel, "live");
    assert.equal(res.speakerLabel, "mismatch");
    assert.ok(res.reason.includes("does not match enrolled contact"));
  });

  await t.test("3. Possible spoof/synthetic + Matching speaker -> possible-ai (Voice Clone)", () => {
    const res = service.classifySingleWindow(0.95, 0.96, true);
    assert.equal(res.rawStatus, "possible-ai");
    assert.equal(res.spoofLabel, "likely-synthetic");
    assert.equal(res.speakerLabel, "match");
    assert.ok(res.reason.includes("voice clone"), "Identifies targeted voice clone attack");
  });

  await t.test("4. Possible spoof/synthetic + Mismatching/un-enrolled speaker -> possible-ai", () => {
    const res = service.classifySingleWindow(0.88, 0.60, false);
    assert.equal(res.rawStatus, "possible-ai");
    assert.equal(res.spoofLabel, "likely-synthetic");
    assert.equal(res.speakerLabel, "not-enrolled");
    assert.ok(res.reason.includes("AI-generated or spoofed audio"));
  });

  await t.test("5. Uncertain AASIST score -> uncertain", () => {
    const res = service.classifySingleWindow(0.62, 0.95, true);
    assert.equal(res.rawStatus, "uncertain");
    assert.equal(res.spoofLabel, "uncertain");
  });

  await t.test("6. Human live + No enrolled profile -> human-verified (with un-enrolled note)", () => {
    const res = service.classifySingleWindow(0.08, undefined, false);
    assert.equal(res.rawStatus, "human-verified");
    assert.equal(res.spoofLabel, "live");
    assert.equal(res.speakerLabel, "not-enrolled");
  });
});

test("VoiceIntegrityService: Temporal Smoothing and Anomaly Rejection", async (t) => {
  const service = new VoiceIntegrityService({
    temporalHistorySize: 5,
    temporalAgreementRequired: 2,
  });
  const callId = "test-call-temporal-123";

  await t.test("7 & 8. Single-window anomaly is rejected by temporal smoothing", () => {
    // Window 1: Live verified human
    const w1 = service.assessWindow(callId, 0.05, 0.98, true, 1000);
    assert.equal(w1.integrityStatus, "human-verified");

    // Window 2: Live verified human
    const w2 = service.assessWindow(callId, 0.08, 0.97, true, 2500);
    assert.equal(w2.integrityStatus, "human-verified");

    // Window 3: Anomalous single-window acoustic noise spike (spoofScore = 0.85)
    const w3 = service.assessWindow(callId, 0.85, 0.97, true, 4000);
    // Because temporalAgreementRequired = 2, status remains human-verified
    assert.equal(w3.integrityStatus, "human-verified", "Single anomaly did not flip status to possible-ai");
    assert.equal(w3.isSmoothed, true, "Marked as smoothed");

    // Window 4: Returns to live human
    const w4 = service.assessWindow(callId, 0.04, 0.99, true, 5500);
    assert.equal(w4.integrityStatus, "human-verified");
  });

  await t.test("9. Multiple consecutive suspicious windows transition to possible-ai", () => {
    const callId2 = "test-call-spoof-attack-456";

    // Window 1: Live start
    service.assessWindow(callId2, 0.10, 0.95, true, 1000);

    // Window 2: First suspicious window (requires 2 to flip)
    const w2 = service.assessWindow(callId2, 0.92, 0.95, true, 2500);
    assert.equal(w2.integrityStatus, "human-verified");

    // Window 3: Second consecutive suspicious window -> transitions to possible-ai
    const w3 = service.assessWindow(callId2, 0.95, 0.96, true, 4000);
    assert.equal(w3.integrityStatus, "possible-ai", "Transitions after 2 consecutive suspicious windows");

    // Window 4: Third suspicious window sustains possible-ai
    const w4 = service.assessWindow(callId2, 0.91, 0.95, true, 5500);
    assert.equal(w4.integrityStatus, "possible-ai");
  });

  await t.test("10. Call session cleanup frees in-memory state completely", () => {
    assert.ok(service.getSession(callId) !== null);
    service.cleanupSession(callId);
    assert.equal(service.getSession(callId), null);
  });
});

test("VoiceIntegrityService: Calibration and Distribution Calculation", async (t) => {
  const service = new VoiceIntegrityService();

  await t.test("11. Configurable calibration settings can be modified dynamically", () => {
    const original = service.getCalibration();
    assert.equal(typeof original.ecapaMatchThreshold, "number");

    service.setCalibration({ ecapaMatchThreshold: 0.95, calibrationVersion: "CALIB-TEST-1" });
    const updated = service.getCalibration();
    assert.equal(updated.ecapaMatchThreshold, 0.95);
    assert.equal(updated.calibrationVersion, "CALIB-TEST-1");
  });

  await t.test("12. Calibration corpus evaluation computes genuine and impostor distributions", async () => {
    await voiceAuthService.init();
    // Generate synthetic harmonic speech samples
    const sampleRate = 16000;
    const duration = 2.0; // 2 seconds
    const numSamples = Math.floor(sampleRate * duration);

    function makeVocalSample(f0: number, formants: number[]): Float32Array {
      const arr = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const tSec = i / sampleRate;
        let val = Math.sin(2 * Math.PI * f0 * tSec);
        for (const [idx, f] of formants.entries()) {
          val += (0.5 / (idx + 1)) * Math.sin(2 * Math.PI * f * tSec);
        }
        arr[i] = val * 0.2;
      }
      return arr;
    }

    const alice1: AudioSample = {
      id: "alice-clean-1",
      speakerId: "alice",
      samples: makeVocalSample(130, [500, 1500, 2500]),
      sampleRate,
      condition: "clean",
    };
    const alice2: AudioSample = {
      id: "alice-clean-2",
      speakerId: "alice",
      samples: makeVocalSample(132, [505, 1510, 2490]),
      sampleRate,
      condition: "clean",
    };
    const bob1: AudioSample = {
      id: "bob-clean-1",
      speakerId: "bob",
      samples: makeVocalSample(210, [800, 1900, 2900]),
      sampleRate,
      condition: "clean",
    };
    const charlie1: AudioSample = {
      id: "charlie-clean-1",
      speakerId: "charlie",
      samples: makeVocalSample(300, [1000, 2400, 3400]),
      sampleRate,
      condition: "clean",
    };

    const corpus = [alice1, alice2, bob1, charlie1];
    const { pairs, stats } = await evaluateCalibrationCorpus(corpus, 0.92, 0.82);

    assert.equal(pairs.length, 6, "4 choose 2 = 6 unique pairs");
    assert.equal(stats.totalGenuinePairs, 1, "1 genuine pair (alice1 vs alice2)");
    assert.equal(stats.totalImpostorPairs, 5, "5 impostor pairs");

    assert.ok(stats.genuineMean > 0.95, `Genuine mean (${stats.genuineMean}) is high`);
    assert.ok(stats.impostorMean < stats.genuineMean, "Impostor mean is strictly lower than genuine mean");
    assert.equal(stats.farAtMatch, 0, "0% False Acceptance Rate at calibrated 0.92 threshold");
    assert.equal(stats.frrAtMatch, 0, "0% False Rejection Rate at calibrated 0.92 threshold");
  });
});
