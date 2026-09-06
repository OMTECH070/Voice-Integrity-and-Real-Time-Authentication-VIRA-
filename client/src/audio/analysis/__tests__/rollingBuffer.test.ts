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
  sampleRate = SAMPLE_RATE
): VADAudioFrame {
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * (sequence * samplesCount + i)) / sampleRate);
  }
  return {
    samples,
    sampleRate,
    timestampMs: sequence * FRAME_DURATION_MS,
  };
}

console.log("RollingSpeechBuffer: basic accumulation and window production");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000, // 3000ms = 48000 samples @ 16kHz (150 frames of 20ms)
    hopDurationMs: 1500, // 1500ms = 24000 samples @ 16kHz (75 frames of 20ms)
  });

  // Push 100 frames (2000ms < 3000ms target) -> should NOT produce a window yet
  let windows: ReturnType<typeof buffer.push> = [];
  for (let i = 0; i < 100; i++) {
    windows = buffer.push(makeSpeechFrame(i));
  }
  assert(windows.length === 0, "no window produced before target duration (2.0s < 3.0s)");
  assert(
    Math.round(buffer.getBufferedDurationMs()) === 2000,
    "buffered duration accurately reflects accumulated speech (2000ms)"
  );

  // Push 50 more frames (now total 150 frames = 3000ms) -> should emit Window 0
  let emittedWindow0 = false;
  for (let i = 100; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    if (res.length > 0) {
      emittedWindow0 = true;
      assert(res[0].sequenceNumber === 0, "first emitted window has sequenceNumber 0");
      assert(res[0].durationMs === 3000, "window duration is exactly 3000ms");
      assert(res[0].pcm.length === 48000, "window PCM sample count matches target (48,000 samples)");
      assert(res[0].sampleRate === SAMPLE_RATE, "sample rate matches configured rate (16,000 Hz)");
      assert(res[0].startMs === 0, "window 0 start timestamp is 0ms");
    }
  }
  assert(emittedWindow0, "Window 0 emitted exactly at 3000ms boundary");

  // With 1500ms hop, buffer should now have 1500ms remaining
  assert(
    Math.round(buffer.getBufferedDurationMs()) === 1500,
    "buffer retains overlapping speech (1500ms) after hop"
  );
}

console.log("\nRollingSpeechBuffer: repeated sliding window production during continuous speech");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 3000,
    hopDurationMs: 1500,
  });

  const allWindows: Array<{ seq: number; startMs: number; samples: number }> = [];

  // Feed 10 seconds of speech (500 frames)
  for (let i = 0; i < 500; i++) {
    const windows = buffer.push(makeSpeechFrame(i));
    for (const w of windows) {
      allWindows.push({ seq: w.sequenceNumber, startMs: w.startMs, samples: w.pcm.length });
    }
  }

  // 10s speech with 3s window and 1.5s hop:
  // Window 0: 0s - 3s (at 3.0s)
  // Window 1: 1.5s - 4.5s (at 4.5s)
  // Window 2: 3.0s - 6.0s (at 6.0s)
  // Window 3: 4.5s - 7.5s (at 7.5s)
  // Window 4: 6.0s - 9.0s (at 9.0s)
  // Total = 5 windows
  assert(allWindows.length === 5, `produced 5 sliding windows over 10s speech (got ${allWindows.length})`);
  assert(
    allWindows.every((w, idx) => w.seq === idx),
    "sequence numbers strictly increment from 0 to 4"
  );
  assert(
    allWindows[1].startMs === 1500 && allWindows[2].startMs === 3000,
    "start timestamps advance by hop duration (1500ms)"
  );
}

console.log("\nRollingSpeechBuffer: maximum memory bounds protection");
{
  const buffer = new RollingSpeechBuffer({
    targetWindowDurationMs: 60000, // Very large window so it doesn't drain normally
    hopDurationMs: 30000,
    maxBufferDurationMs: 5000, // Strict 5s max cap
  });

  // Push 10 seconds of speech (500 frames)
  for (let i = 0; i < 500; i++) {
    buffer.push(makeSpeechFrame(i));
  }

  assert(
    buffer.getBufferedDurationMs() <= 5000,
    `buffer memory does not exceed maxBufferDurationMs (capped at ${buffer.getBufferedDurationMs()}ms <= 5000ms)`
  );
}

console.log("\nRollingSpeechBuffer: reset behavior");
{
  const buffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });
  for (let i = 0; i < 150; i++) buffer.push(makeSpeechFrame(i));

  assert(buffer.getBufferedDurationMs() > 0, "buffer has data before reset");
  buffer.reset();
  assert(buffer.getBufferedDurationMs() === 0, "buffer is empty after reset");

  // Push new speech after reset -> sequence starts back at 0
  let firstWindowAfterReset: number | null = null;
  for (let i = 0; i < 150; i++) {
    const res = buffer.push(makeSpeechFrame(i));
    if (res.length > 0 && firstWindowAfterReset === null) {
      firstWindowAfterReset = res[0].sequenceNumber;
    }
  }
  assert(firstWindowAfterReset === 0, "sequence number resets back to 0 on new stream");
}

console.log("\nRollingSpeechBuffer: local vs remote instance isolation");
{
  const localBuffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });
  const remoteBuffer = new RollingSpeechBuffer({ targetWindowDurationMs: 3000, hopDurationMs: 1500 });

  // Push speech only to local buffer
  for (let i = 0; i < 50; i++) {
    localBuffer.push(makeSpeechFrame(i));
  }

  assert(localBuffer.getBufferedDurationMs() > 0, "local buffer accumulated samples");
  assert(remoteBuffer.getBufferedDurationMs() === 0, "remote buffer remains completely empty and isolated");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
