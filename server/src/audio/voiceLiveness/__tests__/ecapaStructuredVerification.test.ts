import test from "node:test";
import assert from "node:assert/strict";
import { VoiceAuthService } from "../../../services/voiceAuth.service";
import { generateRealisticHumanSpeechWav } from "../standaloneModelTest";

test("Phase B: VoiceAuthService loads real ECAPA ONNX model and reports correct metadata", async () => {
  const service = new VoiceAuthService();
  const initSuccess = await service.init();
  assert.equal(initSuccess, true, "Model should load successfully");
  assert.equal(service.isReady(), true, "Service is ready");

  const status = service.getModelStatus();
  assert.equal(status.available, true);
  assert.equal(status.modelName, "ECAPA-TDNN");
  assert.equal(status.modelVersion, "ECAPA-TDNN-v1");
  assert.equal(status.dimension, 192);
});

test("Phase B: Voice Enrollment creates 192-dim embedding with required metadata without faking vectors", async () => {
  const service = new VoiceAuthService();
  await service.init();

  const userId = "alice-test-uid-101";
  const speechSamples = generateRealisticHumanSpeechWav(3.0, 130, 16000);

  const result = await service.enrollUser(userId, speechSamples, 16000, 3.0, true);
  assert.equal(result.success, true);
  assert.equal(result.embeddingDimension, 192);
  assert.equal(result.modelVersion, "ECAPA-TDNN-v1");
  assert.ok(result.enrolledAt, "enrolledAt must be an ISO timestamp");

  const profile = service.getFullEnrolledProfile(userId);
  assert.ok(profile !== null);
  assert.equal(profile!.userId, userId);
  assert.equal(profile!.embeddingModel, "ECAPA-TDNN");
  assert.equal(profile!.embeddingDimension, 192);
  assert.equal(profile!.enrollmentStatus, "enrolled");
  assert.equal(profile!.embedding.length, 192);
});

test("Phase B: Same speaker live verification returns MATCH", async () => {
  const service = new VoiceAuthService();
  await service.init();

  const speechSamplesA1 = generateRealisticHumanSpeechWav(3.0, 140, 16000);
  const speechSamplesA2 = generateRealisticHumanSpeechWav(3.0, 142, 16000);

  const embA1 = await service.extractEmbedding(speechSamplesA1, 16000);
  const embA2 = await service.extractEmbedding(speechSamplesA2, 16000);

  const verification = service.verifySpeaker(embA1, embA2, 3.0);
  assert.equal(verification.decision, "MATCH");
  assert.equal(verification.match, true);
  assert.equal(verification.label, "match");
  assert.ok(verification.similarity >= 0.85);
  assert.equal(verification.dimension, 192);
});

test("Phase B: Different speaker live verification returns MISMATCH without matching", async () => {
  const service = new VoiceAuthService();
  await service.init();

  // Speaker A (Deep male pitch ~110Hz)
  const speechA = generateRealisticHumanSpeechWav(3.0, 110, 16000);
  // Speaker B (High female pitch ~230Hz)
  const speechB = generateRealisticHumanSpeechWav(3.0, 230, 16000);

  const embA = await service.extractEmbedding(speechA, 16000);
  const embB = await service.extractEmbedding(speechB, 16000);

  const verification = service.verifySpeaker(embA, embB, 3.0);
  assert.equal(verification.decision, "MISMATCH");
  assert.equal(verification.match, false);
  assert.equal(verification.label, "mismatch");
  assert.ok(verification.similarity < 0.70, `Similarity ${verification.similarity} should be < 0.70`);
});

test("Phase B: Uncertain threshold band returns UNCERTAIN without false matching", () => {
  const service = new VoiceAuthService();

  // Synthetic vectors with cosine similarity of 0.72 (in the uncertain band [0.70, 0.85])
  const a = new Float32Array(192);
  a[0] = 1.0;
  const b = new Float32Array(192);
  b[0] = 0.72;
  b[1] = Math.sqrt(1 - 0.72 * 0.72);

  const verification = service.verifySpeaker(a, b, 3.0);
  assert.equal(verification.decision, "UNCERTAIN");
  assert.equal(verification.match, false, "Uncertain result must NEVER be converted to false match");
});

test("Phase B: Insufficient audio returns INSUFFICIENT_AUDIO decision", () => {
  const service = new VoiceAuthService();
  const enrolled = new Float32Array(192);
  enrolled[0] = 1.0;

  // Empty vector or speech duration < 0.5s
  const empty = new Float32Array(0);
  const result1 = service.verifySpeaker(enrolled, empty);
  assert.equal(result1.decision, "INSUFFICIENT_AUDIO");
  assert.equal(result1.match, false);

  const sample = new Float32Array(192);
  sample[0] = 1.0;
  const result2 = service.verifySpeaker(enrolled, sample, 0.2);
  assert.equal(result2.decision, "INSUFFICIENT_AUDIO");
  assert.equal(result2.match, false);
});
