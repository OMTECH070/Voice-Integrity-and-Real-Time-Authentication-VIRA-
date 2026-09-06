import test from "node:test";
import assert from "node:assert/strict";
import { Wav2Vec2AntiSpoofClassifier } from "../wav2vec2AntiSpoof";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { generateRealisticHumanSpeechWav } from "../standaloneModelTest";

test("Phase C: Wav2Vec2 classifier exposes honest status when checkpoint is absent", async () => {
  const classifier = new Wav2Vec2AntiSpoofClassifier({ modelPath: "nonexistent/path/to/wav2vec2.onnx" });
  assert.equal(classifier.isReady(), false, "Classifier should not be ready without trained checkpoint");

  const status = classifier.getStatus();
  assert.equal(status.ready, false);
  assert.equal(status.status, "NOT_READY");
  assert.ok(status.reason.includes("REQUIRES_CHECKPOINT"));
});

test("Phase C: Wav2Vec2 never fabricates synthetic scores when checkpoint is not ready", async () => {
  const classifier = new Wav2Vec2AntiSpoofClassifier();
  const dummySamples = new Float32Array(16000); // 1 sec of audio

  const result = await classifier.analyzeSpeech(dummySamples, 16000);
  assert.equal(result.ready, false);
  assert.equal(result.spoofScore, null, "Must never return fake score when checkpoint is missing");
  assert.equal(result.learnedFeatures, null);
  assert.equal(result.featureDimension, 0);
  assert.equal(result.status, "NOT_READY");
});

test("Phase C: VoiceLivenessService seamlessly preserves AASIST while surfacing honest Wav2Vec2 status", async () => {
  const speechSamples = generateRealisticHumanSpeechWav(4.0, 130, 16000);

  const response = await voiceLivenessService.executeInference({
    callId: "test-call-anti-spoof-001",
    speakerDirection: "remote",
    sequenceNumber: 0,
    timestampMs: Date.now(),
    durationMs: 4000,
    samples: speechSamples,
    sampleRate: 16000,
  });

  assert.equal(response.status, "analyzed");
  assert.ok(response.spoofScore >= 0.0 && response.spoofScore <= 1.0, "AASIST score must be valid probability");
  assert.equal(response.label, "live");
  assert.equal(response.modelVersion, "AASIST-v1");

  // Wav2Vec2 should accurately report NOT_READY without fabricated numbers
  assert.equal(response.wav2vec2Score, null, "Wav2Vec2 score must be null without custom checkpoint");
  assert.equal(response.wav2vec2Status, "NOT_READY");
});
