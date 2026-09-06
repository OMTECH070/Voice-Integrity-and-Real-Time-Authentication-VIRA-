import test from "node:test";
import assert from "node:assert/strict";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { voiceAuthService, EnrolledVoiceProfile } from "../../../services/voiceAuth.service";
import { parseWavBuffer, createWavBuffer } from "../validation/wavHelper";
import {
  AudioSampleInput,
  validateSingleSample,
  runValidationSuite,
} from "../validation/validationRunner";

function synthesizeVoice(
  basePitchHz: number,
  formantHz: number,
  durationSeconds = 3.0,
  sampleRate = 16000
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const audio = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (let h = 1; h <= 15; h++) {
      const freq = basePitchHz * h;
      if (freq > 7500) break;
      const resonance = 1.0 / (1.0 + Math.pow((freq - formantHz) / 150, 2));
      sample += (Math.sin(2 * Math.PI * freq * t) / Math.sqrt(h)) * resonance;
    }
    const vibrato = 1.0 + 0.03 * Math.sin(2 * Math.PI * 5 * t);
    audio[i] = sample * vibrato * 0.1;
  }
  return audio;
}

function generateSyntheticTone(freq = 1000, durationSeconds = 3.0, sampleRate = 16000): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * t);
  }
  return buffer;
}

test("Validation Framework: WAV Helper and Audio Encoding", async (t) => {
  await t.test("Encodes and parses 16-bit PCM WAV buffers faithfully", () => {
    const original = synthesizeVoice(120, 750, 1.0, 16000);
    const wavBuffer = createWavBuffer(original, 16000);

    assert.ok(wavBuffer.length > 44, "Contains RIFF header and data");
    const parsed = parseWavBuffer(wavBuffer);

    assert.equal(parsed.sampleRate, 16000);
    assert.equal(parsed.channels, 1);
    assert.equal(parsed.samples.length, original.length);

    let maxDelta = 0;
    for (let i = 0; i < original.length; i++) {
      const delta = Math.abs(original[i] - parsed.samples[i]);
      if (delta > maxDelta) maxDelta = delta;
    }
    assert.ok(maxDelta < 0.0001, `Quantization delta is tiny (${maxDelta})`);
  });
});

test("Validation Framework: Real ECAPA Speaker Verification and Discrimination", async (t) => {
  await voiceAuthService.init();

  const aliceEnrollment = synthesizeVoice(120, 750, 3.0);
  const aliceSession2 = synthesizeVoice(122, 740, 3.0);
  const bobVoice = synthesizeVoice(220, 1200, 3.0);
  const carolVoice = synthesizeVoice(320, 1800, 3.0);

  const aliceEmb = await voiceAuthService.extractEmbedding(aliceEnrollment, 16000);
  const enrolledProfile: EnrolledVoiceProfile = {
    userId: "alice-id",
    embedding: aliceEmb,
    sampleDurationSeconds: 3.0,
    modelVersion: "ECAPA-TDNN-v1",
    enrolledAt: new Date().toISOString(),
  };

  await t.test("Genuine same-speaker similarity is high (> 0.95)", async () => {
    const aliceTestEmb = await voiceAuthService.extractEmbedding(aliceSession2, 16000);
    const ver = voiceAuthService.verifySpeaker(enrolledProfile, aliceTestEmb);
    assert.ok(ver.similarity > 0.95, `Same-speaker similarity is high (${ver.similarity})`);
    assert.equal(ver.match, true);
    assert.equal(ver.label, "match");
  });

  await t.test("Different speaker similarity is strictly lower and recognized as mismatch", async () => {
    const bobEmb = await voiceAuthService.extractEmbedding(bobVoice, 16000);
    const verBob = voiceAuthService.verifySpeaker(enrolledProfile, bobEmb);
    assert.ok(verBob.similarity < 0.90, `Bob similarity (${verBob.similarity}) < 0.90`);

    const carolEmb = await voiceAuthService.extractEmbedding(carolVoice, 16000);
    const verCarol = voiceAuthService.verifySpeaker(enrolledProfile, carolEmb);
    assert.ok(verCarol.similarity < 0.90, `Carol similarity (${verCarol.similarity}) < 0.90`);
  });
});

test("Validation Framework: AASIST Real Inference and Spoof Detection", async (t) => {
  voiceLivenessService.init();

  await t.test("Silence / low-artifact audio classified as live with low spoof score", async () => {
    const quietAudio = new Float32Array(48000);
    const res = await voiceLivenessService.analyze(quietAudio, 16000);
    assert.ok(res.spoofScore <= 0.55, `Quiet spoofScore (${res.spoofScore}) is live`);
    assert.equal(res.label, "live");
  });

  await t.test("Electronic / synthetic tone classified as likely-synthetic with high spoof score", async () => {
    const synthTone = generateSyntheticTone(1000, 3.0, 16000);
    const res = await voiceLivenessService.analyze(synthTone, 16000);
    assert.ok(res.spoofScore >= 0.70, `Synth tone spoofScore (${res.spoofScore}) is high`);
    assert.equal(res.label, "likely-synthetic");
  });
});

test("Validation Framework: End-to-End Sample Validation and Voice Clone Detection", async (t) => {
  await voiceAuthService.init();
  voiceLivenessService.init();

  const aliceEnrollment = synthesizeVoice(120, 750, 3.0);
  const aliceEmb = await voiceAuthService.extractEmbedding(aliceEnrollment, 16000);
  const enrolledProfile: EnrolledVoiceProfile = {
    userId: "alice-clone-target",
    embedding: aliceEmb,
    sampleDurationSeconds: 3.0,
    modelVersion: "ECAPA-TDNN-v1",
    enrolledAt: new Date().toISOString(),
  };

  await t.test("Single sample validation evaluates all models and fusion logic", async () => {
    const synthSample: AudioSampleInput = {
      id: "synthetic-attack-1",
      speakerId: "unknown",
      samples: generateSyntheticTone(1000, 3.0, 16000),
      sampleRate: 16000,
      category: "synthetic",
      expectedLabel: "possible-ai",
    };

    const res = await validateSingleSample(synthSample, enrolledProfile);
    assert.equal(res.fusedStatus, "possible-ai");
    assert.equal(res.spoofLabel, "likely-synthetic");
    assert.equal(res.passed, true);
    assert.ok(res.aasistLatencyMs > 0, "Measured AASIST latency");
    assert.ok(res.ecapaLatencyMs > 0, "Measured ECAPA latency");
    assert.ok(res.totalPipelineLatencyMs > 0, "Measured total latency");
  });
});

test("Validation Framework: End-to-End Suite Runner & Latency Profiling", async (t) => {
  const aliceEnrollment = synthesizeVoice(120, 750, 3.0);
  const enrolledProfile: EnrolledVoiceProfile = {
    userId: "alice-runner",
    embedding: await voiceAuthService.extractEmbedding(aliceEnrollment, 16000),
    sampleDurationSeconds: 3.0,
    modelVersion: "ECAPA-TDNN-v1",
    enrolledAt: new Date().toISOString(),
  };

  const testCorpus: AudioSampleInput[] = [
    {
      id: "genuine-1",
      speakerId: "alice-runner",
      samples: synthesizeVoice(122, 740, 3.0),
      sampleRate: 16000,
      category: "genuine",
    },
    {
      id: "impostor-1",
      speakerId: "bob-speaker",
      samples: synthesizeVoice(220, 1200, 3.0),
      sampleRate: 16000,
      category: "impostor",
    },
    {
      id: "impostor-2",
      speakerId: "carol-speaker",
      samples: synthesizeVoice(320, 1800, 3.0),
      sampleRate: 16000,
      category: "impostor",
    },
    {
      id: "synthetic-1",
      speakerId: "synth",
      samples: generateSyntheticTone(1200, 3.0, 16000),
      sampleRate: 16000,
      category: "synthetic",
    },
  ];

  const report = await runValidationSuite(testCorpus, enrolledProfile);

  await t.test("Validation suite outputs complete metrics and distributions", () => {
    assert.equal(report.totalSamplesEvaluated, 4);
    assert.equal(report.results.length, 4);
    assert.equal(report.genuineScores.length, 1);
    assert.equal(report.impostorScores.length, 2);

    assert.ok(report.genuineScoreMoments.mean > 0.95, `High genuine mean: ${report.genuineScoreMoments.mean}`);
    assert.ok(report.impostorScoreMoments.mean < 0.90, `Low impostor mean: ${report.impostorScoreMoments.mean}`);

    // Latency validations
    assert.ok(report.latency.aasist.mean > 0, "AASIST latency is measured");
    assert.ok(report.latency.ecapa.mean > 0, "ECAPA latency is measured");
    assert.ok(report.latency.fusion.mean >= 0, "Fusion latency is measured");
    assert.ok(report.latency.total.mean > 0 && isFinite(report.latency.total.mean), "Total pipeline latency is measured");
  });
});
