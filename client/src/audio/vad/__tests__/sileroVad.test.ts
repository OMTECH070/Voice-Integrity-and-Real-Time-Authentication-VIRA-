/**
 * Silero VAD Neural Network & State Machine Test Suite
 *
 * Verifies all 8 required criteria from Phase 6:
 * TEST 1: 5 seconds of silence -> WAITING_FOR_SPEECH, no INSUFFICIENT_AUDIO
 * TEST 2: Silence -> speech -> silence -> Speech detected and finalized correctly
 * TEST 3: Speech with short pauses -> Single continuous speech segment
 * TEST 4: Background noise -> Noise does not continuously trigger speech
 * TEST 5: Very short noise burst -> Not treated as valid speech
 * TEST 6: Normal spoken sentence -> Silero detects speech (> 0.50 probability)
 * TEST 7: Model loading failure -> Explicit error state, no fake Silero status
 * TEST 8: Production build verification
 */

import { SileroVadBackend } from "../sileroVadBackend";
import { AdaptiveVadStateMachine } from "../vadCore";
import fs from "fs";
import path from "path";

// Test assertion helper
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    console.log(`  ok  - ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL - ${msg}`);
    failed++;
  }
}

// Simple WAV parser for 16-bit PCM mono 16kHz
function parseWav16kMono(filePath: string): Float32Array {
  const buf = fs.readFileSync(filePath);
  const dataStart = 44;
  const numSamples = Math.floor((buf.length - dataStart) / 2);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = buf.readInt16LE(dataStart + i * 2) / 32768.0;
  }
  return samples;
}

async function runTests() {
  console.log("=== VIRA SILERO VAD PHASE 6 TEST SUITE ===\n");

  const findExistingFile = (candidates: string[]): string => {
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    throw new Error(`File not found in any candidate path: ${candidates.join(", ")}`);
  };

  const modelPath = findExistingFile([
    path.resolve("models/silero_vad.onnx"),
    path.resolve("../models/silero_vad.onnx"),
    path.resolve("public/models/silero_vad.onnx"),
    path.resolve("client/public/models/silero_vad.onnx"),
    path.resolve("../client/public/models/silero_vad.onnx"),
    path.resolve("scratch/silero_vad.onnx"),
    path.resolve("../scratch/silero_vad.onnx"),
  ]);

  const speechWavPath = findExistingFile([
    path.resolve("scratch/en_example.wav"),
    path.resolve("../scratch/en_example.wav"),
  ]);

  const realSpeechAudio = parseWav16kMono(speechWavPath);

  // -------------------------------------------------------------------------
  // TEST 7: Model loading failure handling (Verified first to test initialization isolation)
  // -------------------------------------------------------------------------
  console.log("TEST 7: Model loading failure handling");
  {
    const brokenBackend = new SileroVadBackend({
      modelPath: "non_existent_model_directory/fake_silero.onnx",
    });

    const initResult = await brokenBackend.init("completely_invalid_path/model.onnx");
    const status = brokenBackend.getStatus();

    assert(initResult === false, "init() returns false on nonexistent model");
    assert(status.modelLoaded === false, "modelLoaded is false");
    assert(status.inferenceAvailable === false, "inferenceAvailable is false");
    assert(status.vadEngine === "fallback-rms-zcr", "vadEngine reports fallback-rms-zcr (never claims silero when not loaded)");
    assert(typeof status.error === "string" && status.error.length > 0, "explicit error message is present");
    assert(brokenBackend.isAvailable() === false, "isAvailable() is false");
  }

  // -------------------------------------------------------------------------
  // Initialize Real Silero Backend for subsequent tests
  // -------------------------------------------------------------------------
  const sileroBackend = new SileroVadBackend({
    modelPath,
    positiveSpeechThreshold: 0.50,
    negativeSpeechThreshold: 0.35,
  });

  const modelBuffer = fs.readFileSync(modelPath);
  const initialized = await sileroBackend.init(modelBuffer);
  if (!initialized) {
    throw new Error(`Failed to initialize real Silero model: ${sileroBackend.getStatus().error}`);
  }

  const initialStatus = sileroBackend.getStatus();
  console.log("\n[Silero Backend Initialized]");
  console.log(`Engine: ${initialStatus.vadEngine}, Version: ${initialStatus.modelVersion}, Loaded: ${initialStatus.modelLoaded}`);

  // -------------------------------------------------------------------------
  // TEST 6: Normal spoken sentence (Real Silero Neural Inference)
  // -------------------------------------------------------------------------
  console.log("\nTEST 6: Normal spoken sentence (Silero neural inference)");
  {
    sileroBackend.resetState();
    // Test on active section of real speech (1.0s to 2.5s)
    const startSample = 16000 * 1;
    const numFrames = 30; // ~1 second of speech
    const speechProbs: number[] = [];

    for (let f = 0; f < numFrames; f++) {
      const frame = realSpeechAudio.subarray(startSample + f * 512, startSample + (f + 1) * 512);
      const out = await sileroBackend.process(frame);
      speechProbs.push(out.speechProbability);
    }

    const maxProb = Math.max(...speechProbs);
    const speechDetectedFrames = speechProbs.filter((p) => p >= 0.50).length;

    assert(maxProb > 0.85, `Silero detects high speech probability (max prob = ${maxProb.toFixed(4)} > 0.85)`);
    assert(speechDetectedFrames >= 15, `Majority of voiced frames identified as speech (${speechDetectedFrames} / ${numFrames} frames >= 0.50)`);
  }

  // -------------------------------------------------------------------------
  // TEST 1: 5 seconds of silence
  // -------------------------------------------------------------------------
  console.log("\nTEST 1: 5 seconds of silence (Initial tolerance)");
  {
    sileroBackend.resetState();
    const stateMachine = new AdaptiveVadStateMachine(
      {
        sampleRate: 16000,
        frameDurationMs: 32, // 512 samples @ 16kHz
        initialWaitMs: 5000,
        maxWaitMs: 15000,
      },
      sileroBackend
    );

    // 5.0 seconds = 156 frames @ 32ms
    const numSilenceFrames = 156;
    let insufficientAudioFired = false;

    for (let i = 0; i < numSilenceFrames; i++) {
      const silentFrame = new Float32Array(512); // digital silence
      const result = await stateMachine.processFrameWithSilero(silentFrame);
      if (result.sessionState === "INSUFFICIENT_AUDIO") {
        insufficientAudioFired = true;
      }
    }

    assert(stateMachine.getSessionState() === "WAITING_FOR_SPEECH", "Session remains in WAITING_FOR_SPEECH after 5.0s of silence");
    assert(insufficientAudioFired === false, "NO INSUFFICIENT_AUDIO error produced during 0–5s initial silence window");
    assert(stateMachine.getTotalSpeechMs() === 0, "Total speech accumulated remains 0ms");
    assert(stateMachine.getElapsedMs() >= 4992, `Elapsed time tracks correctly (${stateMachine.getElapsedMs()}ms)`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Silence -> Speech -> Silence (Finalized speech segment)
  // -------------------------------------------------------------------------
  console.log("\nTEST 2: Silence -> Speech -> Silence (Utterance segmentation)");
  {
    sileroBackend.resetState();
    const stateMachine = new AdaptiveVadStateMachine(
      {
        sampleRate: 16000,
        frameDurationMs: 32,
        initialWaitMs: 5000,
        silenceEndMs: 800,
        minSpeechMs: 1000,
        maxWaitMs: 15000,
      },
      sileroBackend
    );

    // 1. Initial silence: 1.0s (31 frames)
    for (let i = 0; i < 31; i++) {
      await stateMachine.processFrameWithSilero(new Float32Array(512));
    }
    assert(stateMachine.getSessionState() === "WAITING_FOR_SPEECH", "Initial silence keeps session in WAITING_FOR_SPEECH");

    // 2. Real speech: 2.0s (62 frames) from realSpeechAudio
    const speechStart = 16000 * 1;
    let seenSpeechDetected = false;
    for (let i = 0; i < 62; i++) {
      const frame = realSpeechAudio.subarray(speechStart + i * 512, speechStart + (i + 1) * 512);
      const res = await stateMachine.processFrameWithSilero(frame);
      if (res.sessionState === "SPEECH_DETECTED" || res.sessionState === "COLLECTING_SPEECH") {
        seenSpeechDetected = true;
      }
    }
    assert(seenSpeechDetected, "Transitions to SPEECH_DETECTED / COLLECTING_SPEECH on spoken words");

    // 3. Trailing silence: 1.2s (38 frames)
    for (let i = 0; i < 38; i++) {
      await stateMachine.processFrameWithSilero(new Float32Array(512));
    }

    assert(stateMachine.getSessionState() === "SPEECH_COMPLETE", "Utterance transitions to SPEECH_COMPLETE after hangover elapses");
    const pcm = stateMachine.getSpeechPcm();
    assert(pcm.length > 16000, `Speech audio finalized with valid non-empty PCM (samples: ${pcm.length})`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Speech with short pauses (Continuous speech segment)
  // -------------------------------------------------------------------------
  console.log("\nTEST 3: Speech with short pauses (No premature cutoff)");
  {
    sileroBackend.resetState();
    const stateMachine = new AdaptiveVadStateMachine(
      {
        sampleRate: 16000,
        frameDurationMs: 32,
        initialWaitMs: 5000,
        silenceEndMs: 800,
        minSpeechMs: 1000,
        maxWaitMs: 15000,
      },
      sileroBackend
    );

    // Word 1: 800ms speech (25 frames)
    const word1Start = 16000 * 1;
    for (let i = 0; i < 25; i++) {
      const frame = realSpeechAudio.subarray(word1Start + i * 512, word1Start + (i + 1) * 512);
      await stateMachine.processFrameWithSilero(frame);
    }
    assert(stateMachine.getSessionState() === "COLLECTING_SPEECH", "In COLLECTING_SPEECH during word 1");

    // Inter-word pause: 320ms silence (10 frames)
    for (let i = 0; i < 10; i++) {
      await stateMachine.processFrameWithSilero(new Float32Array(512));
    }
    assert(stateMachine.getSessionState() === "COLLECTING_SPEECH", "Remains in COLLECTING_SPEECH during short 320ms pause");

    // Word 2: 800ms speech (25 frames)
    const word2Start = 16000 * 2;
    for (let i = 0; i < 25; i++) {
      const frame = realSpeechAudio.subarray(word2Start + i * 512, word2Start + (i + 1) * 512);
      await stateMachine.processFrameWithSilero(frame);
    }
    assert(stateMachine.getSessionState() === "COLLECTING_SPEECH", "Continues COLLECTING_SPEECH through word 2");

    // Trailing silence: 1000ms (32 frames)
    for (let i = 0; i < 32; i++) {
      await stateMachine.processFrameWithSilero(new Float32Array(512));
    }

    assert(stateMachine.getSessionState() === "SPEECH_COMPLETE", "Finalizes single continuous segment after full utterance concludes");
  }

  // -------------------------------------------------------------------------
  // TEST 4: Background noise rejection
  // -------------------------------------------------------------------------
  console.log("\nTEST 4: Background noise rejection");
  {
    sileroBackend.resetState();
    // Simulate ambient Gaussian room noise (RMS ~ -38 dBFS)
    const numNoiseFrames = 50; // 1.6 seconds of noise
    const noiseProbs: number[] = [];

    for (let f = 0; f < numNoiseFrames; f++) {
      const noiseFrame = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const u1 = Math.random() || 0.0001;
        const u2 = Math.random() || 0.0001;
        noiseFrame[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.02;
      }
      const out = await sileroBackend.process(noiseFrame);
      noiseProbs.push(out.speechProbability);
    }

    const maxNoiseProb = Math.max(...noiseProbs);
    const triggeredFrames = noiseProbs.filter((p) => p >= 0.50).length;

    assert(maxNoiseProb < 0.20, `Silero rejects Gaussian noise (max noise prob = ${maxNoiseProb.toFixed(4)} < 0.20)`);
    assert(triggeredFrames === 0, `Zero noise frames triggered speech threshold (${triggeredFrames} / ${numNoiseFrames})`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Very short noise burst rejection
  // -------------------------------------------------------------------------
  console.log("\nTEST 5: Very short noise burst rejection");
  {
    sileroBackend.resetState();
    const stateMachine = new AdaptiveVadStateMachine(
      {
        sampleRate: 16000,
        frameDurationMs: 32,
        initialWaitMs: 5000,
        silenceEndMs: 800,
        minSpeechMs: 1500,
        maxWaitMs: 15000,
      },
      sileroBackend
    );

    // 1 frame of transient pop/click (32ms burst)
    const transientBurst = new Float32Array(512);
    for (let i = 0; i < 200; i++) transientBurst[i] = 0.8 * Math.sin(2 * Math.PI * 400 * (i / 16000));
    await stateMachine.processFrameWithSilero(transientBurst);

    // Followed by silence
    for (let i = 0; i < 30; i++) {
      await stateMachine.processFrameWithSilero(new Float32Array(512));
    }

    // Must NOT be finalized as a valid speech utterance
    assert(stateMachine.getSessionState() !== "SPEECH_COMPLETE", "Single 32ms transient burst is NOT finalized as a speech utterance");
    assert(stateMachine.getSessionState() === "WAITING_FOR_SPEECH", "Session safely stays in WAITING_FOR_SPEECH");
  }

  // -------------------------------------------------------------------------
  // TEST 8: Production build verification & AudioWorklet packaging
  // -------------------------------------------------------------------------
  console.log("\nTEST 8: Production build verification & AudioWorklet packaging");
  {
    const distHtml = findExistingFile([
      path.resolve("dist/index.html"),
      path.resolve("client/dist/index.html"),
      path.resolve("../client/dist/index.html"),
    ]);
    const distModel = findExistingFile([
      path.resolve("dist/models/silero_vad.onnx"),
      path.resolve("client/dist/models/silero_vad.onnx"),
      path.resolve("../client/dist/models/silero_vad.onnx"),
    ]);

    assert(fs.existsSync(distHtml), "client/dist/index.html exists from production build");
    assert(fs.existsSync(distModel), "client/dist/models/silero_vad.onnx exists in production bundle");
    if (fs.existsSync(distModel)) {
      const stats = fs.statSync(distModel);
      assert(stats.size === 2327524, `Bundled model matches genuine Silero VAD v5 byte size (${stats.size} bytes)`);
    }

    // AudioWorklet production packaging regression check
    const assetsDir = path.join(path.dirname(distHtml), "assets");
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      const rawTsWorklet = assetFiles.find((f) => f.includes("vadProcessor.worklet") && f.endsWith(".ts"));
      const compiledJsWorklet = assetFiles.find((f) => f.includes("vadProcessor.worklet") && f.endsWith(".js"));

      assert(!rawTsWorklet, "Production build must NOT emit raw TypeScript vadProcessor.worklet.ts");
      assert(!!compiledJsWorklet, "Production build MUST emit bundled JavaScript vadProcessor.worklet-*.js");

      if (compiledJsWorklet) {
        const workletCode = fs.readFileSync(path.join(assetsDir, compiledJsWorklet), "utf-8");
        assert(workletCode.includes('registerProcessor("vad-processor"'), "Worklet JS registers vad-processor");
        assert(!workletCode.includes("import type"), "Worklet JS contains no 'import type' statements");
        assert(!workletCode.includes('"./vadCore"'), "Worklet JS contains no unbundled relative './vadCore' imports");
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
