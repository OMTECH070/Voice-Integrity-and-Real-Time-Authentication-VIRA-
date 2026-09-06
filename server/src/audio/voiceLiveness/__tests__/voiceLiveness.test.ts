/**
 * Lightweight, dependency-free tests for the parts of voiceLiveness that
 * don't need real ONNX model weights: chunk buffering, resampling, and
 * the analyzer's orchestration logic (via MockVoiceLivenessBackend).
 * onnxNodeBackend.ts itself isn't covered here — it needs real model
 * files and a working onnxruntime-node install; see README.md.
 *
 * Run with: npx tsx server/src/audio/voiceLiveness/__tests__/voiceLiveness.test.ts
 */
import { SpeechChunkBuffer } from "../chunkBuffer";
import { resampleLinear } from "../resample";
import { VoiceLivenessAnalyzer } from "../VoiceLivenessAnalyzer";
import { MockVoiceLivenessBackend, NotConfiguredBackend } from "../adapters/mockBackend";
import type { VoiceLivenessResult } from "../types";

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

// Wrapped in an async IIFE (rather than top-level await) so this file
// typechecks under the server's CommonJS module setting, matching the
// rest of the codebase's tsconfig rather than requiring an ESM-only test
// file just for this one module.
async function main(): Promise<void> {

function tone(size: number, amplitude = 0.3): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = amplitude * Math.sin((2 * Math.PI * 200 * i) / 16000);
  return out;
}

console.log("chunkBuffer: accumulates pieces until the target duration is reached");
{
  const buf = new SpeechChunkBuffer(16000, 100); // 100ms window = 1600 samples
  let result = buf.push(tone(800), 0);
  assert(result === null, "half a window returns null, not a premature chunk");
  result = buf.push(tone(800), 50);
  assert(result !== null, "reaching the target duration returns a chunk");
  assert(result!.samples.length === 1600, "chunk length matches accumulated samples exactly");
  assert(result!.startMs === 0 && result!.endMs === 50, "chunk carries the start/end timestamps it was fed");
}

console.log("\nchunkBuffer: resets after emitting, starts a fresh window");
{
  const buf = new SpeechChunkBuffer(16000, 100);
  buf.push(tone(1600), 0);
  const second = buf.push(tone(1600), 100);
  assert(second !== null, "a second full window after the first is emitted correctly");
  assert(second!.startMs === 100, "the new window's startMs reflects the piece after reset, not the old one");
}

console.log("\nchunkBuffer: flush() returns partial audio, and null when empty");
{
  const buf = new SpeechChunkBuffer(16000, 1000);
  assert(buf.flush(0) === null, "flushing an empty buffer returns null, not an empty chunk");
  buf.push(tone(400), 0);
  const flushed = buf.flush(25);
  assert(flushed !== null && flushed.samples.length === 400, "flush returns exactly the partial audio buffered so far");
  assert(buf.flush(30) === null, "flushing again immediately after returns null (buffer was cleared)");
}

console.log("\nchunkBuffer: rejects empty pieces without corrupting state");
{
  const buf = new SpeechChunkBuffer(16000, 100);
  const result = buf.push(new Float32Array(0), 0);
  assert(result === null, "an empty piece never triggers a chunk emission");
}

console.log("\nresampleLinear: identity when rates match");
{
  const input = tone(320);
  const output = resampleLinear(input, 16000, 16000);
  assert(output === input, "same-rate resample returns the input unchanged (no needless copy)");
}

console.log("\nresampleLinear: downsampling shortens the buffer proportionally");
{
  const input = tone(4800); // 100ms @ 48000Hz
  const output = resampleLinear(input, 48000, 16000);
  assert(
    Math.abs(output.length - 1600) <= 1,
    "48000Hz -> 16000Hz roughly triples the sample rate down (4800 -> ~1600)"
  );
}

console.log("\nresampleLinear: never throws on an empty buffer");
{
  const output = resampleLinear(new Float32Array(0), 48000, 16000);
  assert(output.length === 0, "resampling zero samples yields zero samples, not a crash");
}

console.log("\nVoiceLivenessAnalyzer: NotConfiguredBackend surfaces a clear error, not a fake score");
{
  let sawError = false;
  let sawResult = false;
  const analyzer = new VoiceLivenessAnalyzer(
    new NotConfiguredBackend(),
    {
      onResult: () => (sawResult = true),
      onError: () => (sawError = true),
    },
    { chunkDurationMs: 10 }
  );
  analyzer.push(tone(200), 0, 16000);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(sawError, "an unconfigured backend produces onError, not a silent fake result");
  assert(!sawResult, "no onResult ever fires when the backend isn't configured");
}

console.log("\nVoiceLivenessAnalyzer: chunks accumulate and produce periodic results via the mock backend");
{
  const results: VoiceLivenessResult[] = [];
  const analyzer = new VoiceLivenessAnalyzer(
    new MockVoiceLivenessBackend(),
    { onResult: (r) => results.push(r) },
    { chunkDurationMs: 100 } // 1600 samples @ 16000Hz
  );

  // Feed 4x 400-sample pieces = 1600 samples = exactly one window.
  for (let i = 0; i < 4; i++) {
    analyzer.push(tone(400, 0.3), i * 25, 16000);
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(results.length === 1, "exactly one result fires once one full window has been fed");
  assert(
    typeof results[0].spoofScore === "number" && results[0].spoofScore >= 0 && results[0].spoofScore <= 1,
    "spoofScore is a well-formed 0..1 number"
  );
  assert(
    results[0].label === "live" || results[0].label === "likely-synthetic" || results[0].label === "uncertain",
    "label is one of the three defined values"
  );
}

console.log("\nVoiceLivenessAnalyzer: flush() emits a final partial chunk instead of dropping it");
{
  const results: VoiceLivenessResult[] = [];
  const analyzer = new VoiceLivenessAnalyzer(
    new MockVoiceLivenessBackend(),
    { onResult: (r) => results.push(r) },
    { chunkDurationMs: 1000 } // large window, won't fill naturally in this test
  );
  analyzer.push(tone(400), 0, 16000);
  assert(results.length === 0, "a partial window produces no result before flush");
  analyzer.flush(25);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(results.length === 1, "flush() forces the partial audio through as one final result");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

}

main();
