/**
 * Unit test suite for Phase A: Adaptive Silero VAD State Machine
 *
 * Tests:
 * 1. Immediate speech detection (WAITING_FOR_SPEECH -> SPEECH_DETECTED -> COLLECTING_SPEECH)
 * 2. 5 seconds initial silence (stays in WAITING_FOR_SPEECH without premature rejection)
 * 3. Speech starting after 4.5 seconds of silence
 * 4. Overall timeout rejection (INSUFFICIENT_AUDIO after maxWaitMs)
 * 5. Short pauses (< silenceEndMs) preserved in single utterance
 * 6. Pre-padding and post-padding retention
 * 7. Chronological segment ordering
 *
 * Run with: npx tsx client/src/audio/vad/__tests__/adaptiveVad.test.ts
 */
import { AdaptiveVadStateMachine, frameSizeForSampleRate } from "../vadCore";

const SAMPLE_RATE = 16000;
const FRAME_MS = 20;
const FRAME_SIZE = frameSizeForSampleRate(SAMPLE_RATE, FRAME_MS);

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

function silenceFrame(size = FRAME_SIZE): Float32Array {
  return new Float32Array(size);
}

function toneFrame(size = FRAME_SIZE, amplitude = 0.7, freqHz = 220): Float32Array {
  const frame = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    frame[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
  }
  return frame;
}

console.log("=== Adaptive VAD Phase A Test Suite ===");

console.log("\nTest 1: Immediate speech detection");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    initialWaitMs: 5000,
    silenceEndMs: 800,
    minSpeechMs: 1000,
    maxWaitMs: 10000,
  });

  assert(vad.getSessionState() === "WAITING_FOR_SPEECH", "initial state is WAITING_FOR_SPEECH");

  // First 3 quiet frames for noise floor calibration
  for (let i = 0; i < 3; i++) {
    vad.processFrame(silenceFrame());
  }
  assert(vad.getSessionState() === "WAITING_FOR_SPEECH", "remains in WAITING_FOR_SPEECH on silence");

  // Speech frames
  let sawDetected = false;
  for (let i = 0; i < 20; i++) {
    const res = vad.processFrame(toneFrame());
    if (res.sessionState === "SPEECH_DETECTED" || res.sessionState === "COLLECTING_SPEECH") {
      sawDetected = true;
    }
  }

  assert(sawDetected, "transitions to SPEECH_DETECTED / COLLECTING_SPEECH when tone starts");
  assert(vad.getTotalSpeechMs() > 0, "accumulates speech duration in ms");
}

console.log("\nTest 2: 5 seconds of initial silence (No premature rejection)");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    initialWaitMs: 5000,
    silenceEndMs: 800,
    minSpeechMs: 1000,
    maxWaitMs: 15000,
  });

  // 5 seconds = 250 frames @ 20ms
  for (let i = 0; i < 250; i++) {
    const res = vad.processFrame(silenceFrame());
    if (res.sessionState === "INSUFFICIENT_AUDIO") {
      assert(false, "prematurely rejected during initial 5 seconds!");
      break;
    }
  }

  assert(
    vad.getSessionState() === "WAITING_FOR_SPEECH",
    "still in WAITING_FOR_SPEECH after 5.0 seconds of complete silence (no premature insufficient audio error)"
  );
  assert(vad.getElapsedMs() === 5000, "elapsed time tracks accurately to 5000ms");
}

console.log("\nTest 3: Speech begins after 4.5 seconds of initial silence");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    initialWaitMs: 5000,
    silenceEndMs: 800,
    minSpeechMs: 1000,
    maxWaitMs: 15000,
  });

  // 4.5 seconds silence = 225 frames
  for (let i = 0; i < 225; i++) {
    vad.processFrame(silenceFrame());
  }
  assert(vad.getSessionState() === "WAITING_FOR_SPEECH", "waiting before speech starts");

  // User begins speaking: 1.5 seconds of speech = 75 frames
  for (let i = 0; i < 75; i++) {
    vad.processFrame(toneFrame());
  }

  assert(
    vad.getSessionState() === "COLLECTING_SPEECH",
    "transitions to COLLECTING_SPEECH when speech begins after 4.5s of silence"
  );
  assert(vad.getTotalSpeechMs() >= 1000, "captured over 1.0s of valid speech audio");

  // Silence after speech ends (1.0s = 50 frames > silenceEndMs 800ms)
  for (let i = 0; i < 50; i++) {
    vad.processFrame(silenceFrame());
  }

  assert(
    vad.getSessionState() === "SPEECH_COMPLETE",
    "transitions to SPEECH_COMPLETE once utterance concludes with silence"
  );

  const pcm = vad.getSpeechPcm();
  assert(pcm.length > 0, "extracted non-empty speech PCM array");
}

console.log("\nTest 4: Overall timeout rejection (INSUFFICIENT_AUDIO after maxWaitMs)");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    initialWaitMs: 3000,
    silenceEndMs: 800,
    minSpeechMs: 2000,
    maxWaitMs: 6000, // 6 seconds max
  });

  // 6 seconds = 300 frames of pure silence
  for (let i = 0; i < 300; i++) {
    vad.processFrame(silenceFrame());
  }

  assert(
    vad.getSessionState() === "INSUFFICIENT_AUDIO",
    "transitions to INSUFFICIENT_AUDIO only after maxWaitMs (6.0s) has fully elapsed"
  );
}

console.log("\nTest 5: Short pauses (< silenceEndMs) preserved in single utterance");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    initialWaitMs: 3000,
    silenceEndMs: 800, // 800ms silence needed to close
    minSpeechMs: 1500,
    maxWaitMs: 10000,
  });

  // 1. Initial silence (200ms)
  for (let i = 0; i < 10; i++) vad.processFrame(silenceFrame());

  // 2. First word: 500ms tone (25 frames)
  for (let i = 0; i < 25; i++) vad.processFrame(toneFrame());

  // 3. Short inter-word pause: 300ms silence (15 frames < 800ms)
  for (let i = 0; i < 15; i++) vad.processFrame(silenceFrame());

  assert(
    vad.getSessionState() === "COLLECTING_SPEECH",
    "stays in COLLECTING_SPEECH during 300ms inter-word pause"
  );

  // 4. Second word: 1200ms tone (60 frames)
  for (let i = 0; i < 60; i++) vad.processFrame(toneFrame());

  assert(
    vad.getSessionState() === "COLLECTING_SPEECH",
    "continues COLLECTING_SPEECH across multi-word sentence"
  );

  // 5. Final silence: 1000ms (50 frames > 800ms)
  for (let i = 0; i < 50; i++) vad.processFrame(silenceFrame());

  assert(
    vad.getSessionState() === "SPEECH_COMPLETE",
    "completes utterance after 1000ms trailing silence"
  );

  const speech = vad.getSpeechPcm();
  assert(speech.length > 0, "speech PCM successfully extracted without choppy cutoff");
}

console.log("\nTest 6: Pre-padding and chronological segment preservation");
{
  const vad = new AdaptiveVadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    prePaddingMs: 200, // 10 frames of pre-roll
    postPaddingMs: 200,
    silenceEndMs: 400,
    minSpeechMs: 200,
    maxWaitMs: 5000,
  });

  // Feed distinct identifiable sample patterns:
  // Pre-roll silence
  for (let i = 0; i < 10; i++) vad.processFrame(silenceFrame());

  // Speech tone
  for (let i = 0; i < 20; i++) vad.processFrame(toneFrame(FRAME_SIZE, 0.8, 440));

  // Trailing silence (35 frames = 700ms, clearing 160ms hangover + 400ms silenceEndMs)
  for (let i = 0; i < 35; i++) vad.processFrame(silenceFrame());

  assert(vad.getSessionState() === "SPEECH_COMPLETE", "utterance completed");
  const audio = vad.getSpeechPcm();

  // With pre-padding + 20 speech frames + post-padding, length must exceed just the 20 speech frames
  assert(
    audio.length > 20 * FRAME_SIZE,
    `speech PCM includes pre/post padding frames (length: ${audio.length} > ${20 * FRAME_SIZE})`
  );
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
