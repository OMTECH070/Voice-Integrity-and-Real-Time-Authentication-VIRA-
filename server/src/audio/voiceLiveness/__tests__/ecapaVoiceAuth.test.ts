import { VoiceAuthService } from "../../../services/voiceAuth.service";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL - ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`  ok  - ${message}`);
  }
}

// Synthesize rich voice-like harmonic signals with formant peaks for deterministic speaker testing
function synthesizeVoice(basePitchHz: number, formantHz: number, durationSec = 3.0, sampleRate = 16000): Float32Array {
  const numSamples = Math.floor(durationSec * sampleRate);
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

async function runTests() {
  console.log("ECAPA-TDNN: Speaker Embedding and Verification Unit & Real-Model Tests");

  const service = new VoiceAuthService();
  const initSuccess = await service.init();
  assert(initSuccess === true, "VoiceAuthService initializes and loads real ECAPA ONNX model");
  assert(service.isReady() === true, "VoiceAuthService isReady() returns true with real model");

  const status = service.getModelStatus();
  assert(status.available === true, "getModelStatus() reports model available");
  assert(status.modelVersion === "ECAPA-TDNN-v1", "getModelStatus() reports correct model version");

  // Test 1: L2 Normalization Math
  {
    const vec = new Float32Array([3, 4]); // norm = 5
    const norm = service.l2Normalize(vec);
    assert(Math.abs(norm[0] - 0.6) < 1e-5, "l2Normalize: first element is 0.6");
    assert(Math.abs(norm[1] - 0.8) < 1e-5, "l2Normalize: second element is 0.8");
    const len = Math.sqrt(norm[0] * norm[0] + norm[1] * norm[1]);
    assert(Math.abs(len - 1.0) < 1e-5, "l2Normalize: resulting vector magnitude is 1.0");

    // Zero vector test
    const zeroVec = new Float32Array([0, 0, 0]);
    const zeroNorm = service.l2Normalize(zeroVec);
    assert(!isNaN(zeroNorm[0]) && isFinite(zeroNorm[0]), "l2Normalize handles zero vector safely");
  }

  // Test 2: Cosine Similarity Math
  {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    const c = new Float32Array([0, 1, 0]);
    const d = new Float32Array([-1, 0, 0]);

    const simIdentical = service.computeCosineSimilarity(a, b);
    assert(Math.abs(simIdentical - 1.0) < 1e-5, "cosine similarity of identical vectors is 1.0");

    const simOrthogonal = service.computeCosineSimilarity(a, c);
    assert(Math.abs(simOrthogonal - 0.0) < 1e-5, "cosine similarity of orthogonal vectors is 0.0");

    const simOpposite = service.computeCosineSimilarity(a, d);
    assert(Math.abs(simOpposite - (-1.0)) < 1e-5, "cosine similarity of opposite vectors is -1.0");

    const simMismatchedDim = service.computeCosineSimilarity(new Float32Array([1, 2]), new Float32Array([1, 2, 3]));
    assert(simMismatchedDim === 0, "cosine similarity of mismatched dimension returns 0 safely");
  }

  // Test 3: Real Model Speaker Embedding Extraction
  let embA1: Float32Array;
  let embA2: Float32Array;
  let embB1: Float32Array;

  {
    const sampleA1 = synthesizeVoice(120, 750, 3.0); // Speaker A session 1
    const sampleA2 = synthesizeVoice(122, 740, 3.2); // Speaker A session 2 (same speaker)
    const sampleB1 = synthesizeVoice(220, 1200, 3.0); // Speaker B (different speaker)

    embA1 = await service.extractEmbedding(sampleA1, 16000);
    embA2 = await service.extractEmbedding(sampleA2, 16000);
    embB1 = await service.extractEmbedding(sampleB1, 16000);

    assert(embA1 instanceof Float32Array, "extractEmbedding returns Float32Array");
    assert(embA1.length === 192, `embedding dimensionality is 192 (got ${embA1.length})`);
    assert(embA1.every((v) => isFinite(v) && !isNaN(v)), "embedding contains all finite numbers");

    // Check L2 normalization of extracted embedding
    let sumSq = 0;
    for (let i = 0; i < embA1.length; i++) sumSq += embA1[i] * embA1[i];
    assert(Math.abs(Math.sqrt(sumSq) - 1.0) < 1e-4, "extracted embedding is L2-normalized to unit norm (1.0)");
  }

  // Test 4: Real Model Same-Speaker vs Different-Speaker Discriminative Ability
  {
    const simSameSpeaker = service.computeCosineSimilarity(embA1, embA2);
    const simDiffSpeaker = service.computeCosineSimilarity(embA1, embB1);

    console.log(`    [Real ECAPA Model Telemetry] Same-Speaker similarity: ${simSameSpeaker.toFixed(4)}`);
    console.log(`    [Real ECAPA Model Telemetry] Different-Speaker similarity: ${simDiffSpeaker.toFixed(4)}`);

    assert(simSameSpeaker > 0.95, `same-speaker similarity is high (> 0.95, got ${simSameSpeaker.toFixed(4)})`);
    assert(simSameSpeaker > simDiffSpeaker, `same-speaker similarity (${simSameSpeaker.toFixed(4)}) is strictly greater than different-speaker similarity (${simDiffSpeaker.toFixed(4)})`);
  }

  // Test 5: Real Voice Enrollment & Verification Lifecycle
  {
    const userId = "alice-user-uuid-123";
    const enrollSamples = synthesizeVoice(120, 750, 4.0); // 4.0 seconds @ 16kHz
    const enrollResult = await service.enrollUser(userId, enrollSamples, 16000, 4.0);

    assert(enrollResult.success === true, "enrollUser succeeds with valid speech audio");
    assert(enrollResult.embedding !== undefined && enrollResult.embedding.length === 192, "enrollUser returns 192-dim embedding");
    assert(enrollResult.modelVersion === "ECAPA-TDNN-v1", "enrollUser returns modelVersion");

    const cachedProfile = service.getEnrolledProfile(userId);
    assert(cachedProfile !== null, "getEnrolledProfile retrieves cached profile");
    assert(cachedProfile!.length === 192, "cached profile has 192 dimensions");

    // Verify same speaker during active call
    const incomingAliceVoice = synthesizeVoice(122, 740, 3.0);
    const incomingAliceEmbedding = await service.extractEmbedding(incomingAliceVoice, 16000);
    const verificationAlice = service.verifySpeaker(cachedProfile!, incomingAliceEmbedding);

    assert(verificationAlice.match === true, "verifySpeaker matches enrolled speaker");
    assert(verificationAlice.label === "match", "verifySpeaker returns 'match' label");
    assert(verificationAlice.similarity > 0.95, `verification similarity is > 0.95 (got ${verificationAlice.similarity.toFixed(4)})`);

    // Verify impostor / different speaker
    const incomingBobVoice = synthesizeVoice(220, 1200, 3.0);
    const incomingBobEmbedding = await service.extractEmbedding(incomingBobVoice, 16000);
    const verificationBob = service.verifySpeaker(cachedProfile!, incomingBobEmbedding);

    assert(verificationBob.similarity < verificationAlice.similarity, "impostor similarity is lower than genuine speaker");
  }

  // Test 6: Resampling from 48kHz audio context
  {
    const audio48k = synthesizeVoice(120, 750, 3.0, 48000); // 48 kHz native browser rate
    assert(audio48k.length === 144000, "48kHz input has 144,000 samples");

    const embFrom48k = await service.extractEmbedding(audio48k, 48000);
    assert(embFrom48k.length === 192, "extractEmbedding handles 48kHz input via internal resampling");
    assert(embFrom48k.every((v) => isFinite(v) && !isNaN(v)), "48kHz embedding has valid finite floats");
  }

  // Test 7: Enrollment Error Validation
  {
    const shortSamples = new Float32Array(8000); // 0.5s @ 16kHz
    const enrollResShort = await service.enrollUser("test-user-1", shortSamples, 16000, 0.5);
    assert(enrollResShort.success === false, "enrollment rejects audio shorter than 2.0s");
    assert(enrollResShort.error?.includes("Insufficient speech duration") === true, "enrollment returns informative error for short speech");

    const enrollResNoUser = await service.enrollUser("", new Float32Array(32000), 16000, 2.5);
    assert(enrollResNoUser.success === false, "enrollment rejects empty userId");
  }

  console.log(`\n${passedTests} passed, ${totalTests - passedTests} failed\n`);
}

runTests().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
