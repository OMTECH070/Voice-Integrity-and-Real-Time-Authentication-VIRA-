/**
 * Lightweight, dependency-free tests for RollingSpeechBuffer.
 *
 * Run with:  npx tsx client/src/audio/analysis/__tests__/rollingBuffer.test.ts
 */
import { RollingSpeechBuffer } from "../RollingSpeechBuffer";
import type { VADAudioFrame } from "../../vad/types";

const SAMPLE_RATE = 16000;
const FRAME_DURATION_MS = 20; // 20ms = 320 samples @ 16kHz
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000;

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

function makeSpeechFrame(
  sequence: number,
  samplesCount = FRAME_SAMPLES,
  sampleRate = SAMPLE_RATE,
  customTimestampMs?: number
): VADAudioFrame {
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * (sequence * samplesCount + i)) / sampleRate);
  }
  return {
    samples,
    sampleRate,
    timestampMs: customTimestampMs !== undefined ? customTimestampMs : sequence * FRAME_DURATION_MS,
  };
}

console.log("TEST 1: A single 3-second continuous speech segment creates WINDOW_READY");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
  });

  // 150 frames * 20ms = 3000ms = 3.0s
  let emittedWindows: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    if (res.length > 0) {
      emittedWindows.push(...res);
    }
  }

  assert(emittedWindows.length === 1, "Single 3-second segment emitted exactly 1 WINDOW_READY");
  assert(emittedWindows[0].sequenceNumber === 0, "Window sequenceNumber is 0");
  assert(emittedWindows[0].pcm.length === 48000, "Window contains exactly 48,000 samples");
  assert(emittedWindows[0].durationMs === 3000, "Window duration is 3000ms");
}

console.log("\nTEST 2: Two speech segments separated by a short pause accumulate correctly");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
    maxPauseDurationMs: 5000,
  });

  // Segment 1: 1.2s speech (60 frames * 20ms = 1200ms), timestamps: 0ms -> 1200ms
  for (let i = 0; i < 60; i++) {
    const res = buffer.push(makeSpeechFrame(i, FRAME_SAMPLES, SAMPLE_RATE, i * 20));
    assert(res.length === 0, "No window emitted during segment 1 (1.2s < 3.0s)");
  }
  assert(Math.round(buffer.getBufferedDurationMs()) === 1200, "Buffered duration is 1200ms after segment 1");

  // Pause: 0.4s (400ms pause, so next segment starts at 1200 + 400 = 1600ms)
  // Segment 2: 1.8s speech (90 frames * 20ms = 1800ms)
  let windowReady: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 90; i++) {
    const timestampMs = 1600 + i * 20;
    const res = buffer.push(makeSpeechFrame(60 + i, FRAME_SAMPLES, SAMPLE_RATE, timestampMs));
    if (res.length > 0) {
      windowReady.push(...res);
    }
  }

  assert(windowReady.length === 1, "Two segments totaling 3.0s across 0.4s pause emitted WINDOW_READY");
  assert(windowReady[0].pcm.length === 48000, "Window PCM has exactly 48,000 samples");
  assert(windowReady[0].durationMs === 3000, "Window duration is exactly 3000ms");
}

console.log("\nTEST 3: Three conversational speech segments (0.8s, 1.0s, 1.3s with short pauses)");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
    maxPauseDurationMs: 5000,
  });

  // Segment 1: 0.8s (40 frames * 20ms = 800ms), start: 0ms
  for (let i = 0; i < 40; i++) {
    buffer.push(makeSpeechFrame(i, FRAME_SAMPLES, SAMPLE_RATE, i * 20));
  }
  assert(Math.round(buffer.getBufferedDurationMs()) === 800, "800ms buffered after segment 1");

  // Pause 1: 300ms pause -> start at 1100ms
  // Segment 2: 1.0s (50 frames * 20ms = 1000ms), start: 1100ms
  for (let i = 0; i < 50; i++) {
    buffer.push(makeSpeechFrame(40 + i, FRAME_SAMPLES, SAMPLE_RATE, 1100 + i * 20));
  }
  assert(Math.round(buffer.getBufferedDurationMs()) === 1800, "1800ms buffered after segment 2");

  // Pause 2: 500ms pause -> start at 2100 + 500 = 2600ms
  // Segment 3: 1.3s (65 frames * 20ms = 1300ms), total speech = 800 + 1000 + 1300 = 3100ms
  let windowReady: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 65; i++) {
    const res = buffer.push(makeSpeechFrame(90 + i, FRAME_SAMPLES, SAMPLE_RATE, 2600 + i * 20));
    if (res.length > 0) {
      windowReady.push(...res);
    }
  }

  assert(windowReady.length >= 1, "Three conversational segments totaling 3.1s emitted WINDOW_READY");
  assert(windowReady[0].pcm.length === 48000, "Emitted window has exactly 48,000 speech samples");
  assert(windowReady[0].startMs === 0, "Window start timestamp matches first speech frame (0ms)");
}

console.log("\nTEST 4: Long silence causes incomplete accumulation to expire/reset");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
    maxPauseDurationMs: 5000,
  });

  // Push 1.0s speech (50 frames * 20ms = 1000ms), start: 0ms -> end: 1000ms
  for (let i = 0; i < 50; i++) {
    buffer.push(makeSpeechFrame(i, FRAME_SAMPLES, SAMPLE_RATE, i * 20));
  }
  assert(Math.round(buffer.getBufferedDurationMs()) === 1000, "1000ms buffered");

  // Long pause: 6.0s (> 5.0s maxPauseDurationMs) -> next frame arrives at 1000 + 6000 = 7000ms
  // Push a new 20ms frame
  const res = buffer.push(makeSpeechFrame(50, FRAME_SAMPLES, SAMPLE_RATE, 7000));
  assert(res.length === 0, "No window emitted after pause expiry");
  // Buffered duration should only be the new 20ms frame (the previous 1000ms was discarded)
  assert(Math.round(buffer.getBufferedDurationMs()) === 20, "Incomplete buffer expired and reset after 6.0s silence");
}

console.log("\nTEST 5: Silence itself is NOT counted as speech duration");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
    maxPauseDurationMs: 5000,
  });

  // Push 1.0s speech at 0ms
  for (let i = 0; i < 50; i++) {
    buffer.push(makeSpeechFrame(i, FRAME_SAMPLES, SAMPLE_RATE, i * 20));
  }
  // Pause 3.0s (3000ms) without any frames
  // Push another 0.5s speech starting at 4000ms (500ms = 25 frames)
  for (let i = 0; i < 25; i++) {
    buffer.push(makeSpeechFrame(50 + i, FRAME_SAMPLES, SAMPLE_RATE, 4000 + i * 20));
  }

  // Total speech is 1.0s + 0.5s = 1.5s (even though 4.5s elapsed in real time)
  assert(
    Math.round(buffer.getBufferedDurationMs()) === 1500,
    "Buffered speech duration is 1500ms (silence was NOT added to speech duration)"
  );
}

console.log("\nTEST 6: No duplicate WINDOW_READY events");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
  });

  let totalEmitted = 0;
  // Push exactly 150 frames (3000ms)
  for (let i = 0; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    totalEmitted += res.length;
  }
  assert(totalEmitted === 1, "Exactly 1 WINDOW_READY emitted for 3.0s of speech");

  // Push another 50 frames (1000ms, total new = 2500ms with 1500ms retained < 3000ms)
  for (let i = 150; i < 200; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    totalEmitted += res.length;
  }
  assert(totalEmitted === 1, "No duplicate WINDOW_READY emitted while buffering next hop");
}

console.log("\nTEST 7: After WINDOW_READY, the buffer starts a fresh analysis window with hop overlap");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
  });

  // Push 150 frames (3.0s) -> Window 0
  for (let i = 0; i < 150; i++) buffer.push(makeSpeechFrame(i));

  // Hop retained 1.5s (75 frames). Push another 75 frames (1.5s) to reach next 3.0s window
  let window1: ReturnType<typeof buffer.push> = [];
  for (let i = 150; i < 225; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    if (res.length > 0) window1.push(...res);
  }

  assert(window1.length === 1, "Second window emitted after hop interval");
  assert(window1[0].sequenceNumber === 1, "Second window has sequenceNumber 1");
  assert(window1[0].startMs === 1500, "Second window startMs is 1500ms (advanced by hopDurationMs)");
}

console.log("\nTEST 8: Existing call/session cleanup still clears all state");
{
  const buffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });
  for (let i = 0; i < 100; i++) buffer.push(makeSpeechFrame(i));

  assert(buffer.getBufferedDurationMs() > 0, "Buffer has data prior to cleanup");
  buffer.reset();
  assert(buffer.getBufferedDurationMs() === 0, "Buffer duration is 0 after reset");

  // Push 150 frames on new call
  let firstWindow: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    if (res.length > 0) firstWindow.push(...res);
  }
  assert(firstWindow.length === 1, "New call emits window normally");
  assert(firstWindow[0].sequenceNumber === 0, "Sequence number restarted cleanly at 0");
}

console.log("\nTEST 9: Existing 16kHz sample-count behavior remains correct (48,000 samples)");
{
  const buffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });
  let resultWindow: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i, FRAME_SAMPLES, 16000));
    if (res.length > 0) resultWindow.push(...res);
  }
  assert(resultWindow.length === 1, "16kHz stream produces window");
  assert(resultWindow[0].pcm.length === 48000, "16kHz 3-second window has exactly 48,000 Float32 samples");
  assert(resultWindow[0].sampleRate === 16000, "Sample rate is preserved as 16000Hz");
}

console.log("\nTEST 10: Local vs Remote buffer instance isolation");
{
  const localBuffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });
  const remoteBuffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });

  for (let i = 0; i < 50; i++) {
    localBuffer.push(makeSpeechFrame(i));
  }

  assert(localBuffer.getBufferedDurationMs() > 0, "Local buffer accumulated samples");
  assert(remoteBuffer.getBufferedDurationMs() === 0, "Remote buffer remains completely empty and isolated");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
