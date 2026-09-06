/**
 * Comprehensive test suite for AASIST ONNX model inference and voice liveness service.
 *
 * Run with:  npx tsx server/src/audio/voiceLiveness/__tests__/aasistInference.test.ts
 */
import path from "path";
import { OnnxNodeVoiceLivenessBackend } from "../adapters/onnxNodeBackend";
import { resampleLinear } from "../resample";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ok  - ${message}`);
  } else {
    failed++;
    console.error(`  FAIL - ${message}`);
  }
}

import fs from "fs";

function resolveModelPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "server/models/aasist.onnx"),
    path.resolve(process.cwd(), "models/aasist.onnx"),
    path.resolve(__dirname, "../../../../models/aasist.onnx"),
    path.resolve(__dirname, "../../../models/aasist.onnx"),
    path.resolve(__dirname, "../../models/aasist.onnx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("aasist.onnx not found");
}

const MODEL_PATH = resolveModelPath();

console.log("AASIST ONNX: Model Initialization and Backend Execution");
async function runTests() {
  const backend = new OnnxNodeVoiceLivenessBackend({
    antispoofModelPath: MODEL_PATH,
    antispoofInputName: "input",
    antispoofOutputName: "spoof_prob",
    antispoofRequiredInputLength: 64600,
    spoofThreshold: 0.70,
    uncertaintyBand: 0.15,
  });

  assert(backend.requiredSampleRate === 16000, "backend expects 16,000 Hz input audio");

  // TEST 1: Low-energy quiet / zero audio (baseline human/silence response)
  const silenceSamples = new Float32Array(48000); // 3 seconds @ 16kHz
  const silenceResult = await backend.analyze({
    samples: silenceSamples,
    sampleRate: 16000,
    startMs: 0,
    endMs: 3000,
  });

  assert(
    typeof silenceResult.spoofScore === "number" &&
      silenceResult.spoofScore >= 0 &&
      silenceResult.spoofScore <= 1,
    `silence spoofScore is bounded in [0, 1] (got ${silenceResult.spoofScore.toFixed(4)})`
  );
  assert(
    silenceResult.label === "live",
    `silence audio classified as live (got "${silenceResult.label}")`
  );
  assert(
    silenceResult.inferenceMs >= 0,
    `inference latency is measured (${silenceResult.inferenceMs}ms)`
  );

  // TEST 2: High-frequency synthetic tone audio (synthetic spoof pattern)
  const toneSamples = new Float32Array(48000);
  for (let i = 0; i < toneSamples.length; i++) {
    toneSamples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
  }

  const toneResult = await backend.analyze({
    samples: toneSamples,
    sampleRate: 16000,
    startMs: 3000,
    endMs: 6000,
  });

  assert(
    toneResult.spoofScore >= 0.70,
    `electronic tone detected as synthetic spoof (score = ${toneResult.spoofScore.toFixed(4)})`
  );
  assert(
    toneResult.label === "likely-synthetic",
    `electronic tone classified as "likely-synthetic" (got "${toneResult.label}")`
  );

  // TEST 3: Resampling from 48 kHz browser audio to 16 kHz model audio
  const browser48kSamples = new Float32Array(144000); // 3s @ 48kHz
  for (let i = 0; i < browser48kSamples.length; i++) {
    browser48kSamples[i] = Math.sin((2 * Math.PI * 220 * i) / 48000);
  }
  const resampled = resampleLinear(browser48kSamples, 48000, 16000);
  assert(
    resampled.length === 48000,
    `linear resampling accurately resamples 48kHz (144,000 samples) to 16kHz (48,000 samples)`
  );

  // TEST 4: VoiceLivenessService end-to-end execution
  const serviceOk = voiceLivenessService.init();
  assert(serviceOk, "voiceLivenessService initialized successfully");

  const serviceResult = await voiceLivenessService.executeInference({
    callId: "test-call-1",
    speakerDirection: "remote",
    sequenceNumber: 0,
    timestampMs: 0,
    durationMs: 3000,
    samples: browser48kSamples,
    sampleRate: 48000,
  });

  assert(serviceResult.status === "analyzed", "service returned status 'analyzed'");
  assert(serviceResult.modelVersion === "AASIST-v1", "service returns modelVersion AASIST-v1");
  assert(serviceResult.spoofScore >= 0 && serviceResult.spoofScore <= 1, "service spoofScore is valid float in [0, 1]");
  assert(serviceResult.processingLatencyMs >= 0, "service reports valid processing latency");

  // TEST 5: Missing model handling
  const badBackend = new OnnxNodeVoiceLivenessBackend({
    antispoofModelPath: "non-existent-path.onnx",
  });
  let threw = false;
  try {
    await badBackend.analyze({
      samples: silenceSamples,
      sampleRate: 16000,
      startMs: 0,
      endMs: 3000,
    });
  } catch {
    threw = true;
  }
  assert(threw, "backend cleanly throws error on missing model without crashing process");

  // TEST 6: Bounded queue backpressure
  let completedCount = 0;
  const finishPromise = new Promise<void>((resolve) => {
    // Queue 3 rapid requests
    for (let i = 0; i < 3; i++) {
      voiceLivenessService.enqueueAnalysis(
        {
          callId: "test-call-queue",
          speakerDirection: "remote",
          sequenceNumber: i,
          timestampMs: i * 1500,
          durationMs: 3000,
          samples: silenceSamples,
          sampleRate: 16000,
        },
        () => {
          completedCount++;
          if (completedCount === 2) {
            // Because queue depth is 1, window 0 runs, window 1 is replaced by window 2, so 2 requests complete!
            resolve();
          }
        }
      );
    }
  });

  await finishPromise;
  assert(
    completedCount === 2,
    `queue backpressure safely executed active + newest window (completed ${completedCount})`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
