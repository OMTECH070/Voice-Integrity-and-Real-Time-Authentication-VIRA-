import test from "node:test";
import assert from "node:assert/strict";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { voiceAuthService, EnrolledVoiceProfile } from "../../../services/voiceAuth.service";
import { createWavBuffer, parseWavBuffer } from "../validation/wavHelper";
import {
  generateRealisticHumanSpeechWav,
  generateSyntheticVocoderWav,
} from "../standaloneModelTest";

test("Forensic Model Validation: AASIST & ECAPA End-to-End ML Separation", async (t) => {
  voiceLivenessService.init();
  await voiceAuthService.init();

  const sampleRate = 16000;

  await t.test("TASK 4 & 5: AASIST distinguishes realistic human speech from synthetic vocoder speech", async () => {
    // 1. Generate known realistic human vocal tract signal
    const humanAudio = generateRealisticHumanSpeechWav(4.0, 120, sampleRate);
    const humanWavBuf = createWavBuffer(humanAudio, sampleRate);
    const parsedHuman = parseWavBuffer(humanWavBuf);

    const humanResult = await voiceLivenessService.analyze(parsedHuman.samples, parsedHuman.sampleRate);

    console.log(
      `[TEST][AASIST] Human Speech -> spoofScore=${humanResult.spoofScore.toFixed(4)} (${(humanResult.spoofScore * 100).toFixed(1)}%) label=${humanResult.label}`
    );
    assert.ok(
      humanResult.spoofScore <= 0.35,
      `Human speech spoof score (${humanResult.spoofScore}) must be <= 0.35 (Likely Human / Inconclusive band)`
    );
    assert.equal(humanResult.label, "live");

    // 2. Generate known synthetic vocoder / phase-locked attack signal
    const synthAudio = generateSyntheticVocoderWav(4.0, 120, sampleRate);
    const synthWavBuf = createWavBuffer(synthAudio, sampleRate);
    const parsedSynth = parseWavBuffer(synthWavBuf);

    const synthResult = await voiceLivenessService.analyze(parsedSynth.samples, parsedSynth.sampleRate);

    console.log(
      `[TEST][AASIST] Synthetic Speech -> spoofScore=${synthResult.spoofScore.toFixed(4)} (${(synthResult.spoofScore * 100).toFixed(1)}%) label=${synthResult.label}`
    );
    assert.ok(
      synthResult.spoofScore >= 0.70,
      `Synthetic vocoder spoof score (${synthResult.spoofScore}) must be >= 0.70 (Likely Synthetic)`
    );
    assert.equal(synthResult.label, "likely-synthetic");

    // 3. Mathematical separation margin
    const margin = synthResult.spoofScore - humanResult.spoofScore;
    assert.ok(margin >= 0.50, `Separation margin between synthetic and human (${margin.toFixed(4)}) must be >= 0.50`);
  });

  await t.test("TASK 7: ECAPA-TDNN computes accurate embeddings and separates speakers", async () => {
    const speaker1_session1 = generateRealisticHumanSpeechWav(3.5, 120, sampleRate);
    const speaker1_session2 = generateRealisticHumanSpeechWav(3.5, 122, sampleRate);
    const speaker2 = generateRealisticHumanSpeechWav(3.5, 220, sampleRate);

    const emb1_1 = await voiceAuthService.extractEmbedding(speaker1_session1, sampleRate);
    const emb1_2 = await voiceAuthService.extractEmbedding(speaker1_session2, sampleRate);
    const emb2 = await voiceAuthService.extractEmbedding(speaker2, sampleRate);

    assert.equal(emb1_1.length, 192, "Embedding vector length must be 192 dimensions");

    const enrolledProfile: EnrolledVoiceProfile = {
      userId: "test-user-forensic-1",
      embedding: emb1_1,
      sampleDurationSeconds: 3.5,
      modelVersion: "ECAPA-TDNN-v1",
      enrolledAt: new Date().toISOString(),
    };

    const sameSpeakerVerification = voiceAuthService.verifySpeaker(enrolledProfile, emb1_2);
    const diffSpeakerVerification = voiceAuthService.verifySpeaker(enrolledProfile, emb2);

    console.log(
      `[TEST][ECAPA] Same Speaker Similarity: ${sameSpeakerVerification.similarity.toFixed(4)} -> match=${sameSpeakerVerification.match}`
    );
    console.log(
      `[TEST][ECAPA] Different Speaker Similarity: ${diffSpeakerVerification.similarity.toFixed(4)} -> match=${diffSpeakerVerification.match}`
    );

    assert.ok(
      sameSpeakerVerification.similarity >= 0.90,
      `Same-speaker similarity (${sameSpeakerVerification.similarity}) must be >= 0.90`
    );
    assert.equal(sameSpeakerVerification.match, true);

    assert.ok(
      diffSpeakerVerification.similarity <= 0.80,
      `Different-speaker similarity (${diffSpeakerVerification.similarity}) must be <= 0.80`
    );
    assert.equal(diffSpeakerVerification.match, false);
  });
});
