/**
 * Lightweight, dependency-free tests for vadCore.
 *
 * The client workspace has no test runner installed yet (no vitest/jest in
 * package.json), and adding one wasn't necessary to prove the VAD logic
 * works — vadCore has zero DOM/AudioWorklet dependency, so it runs fine
 * under plain Node. This file is a small self-contained assertion runner;
 * swap it for real vitest specs later with no changes to vadCore itself.
 *
 * Run with:  npx tsx client/src/audio/vad/__tests__/vadCore.test.ts
 */
import {
  computeRmsDb,
  computeZeroCrossingRate,
  frameSizeForSampleRate,
  VadStateMachine,
} from "../vadCore";
import { SpeechAudioGate } from "../speechAudioGate";
import { concatFloat32 } from "../pcm";

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
  return new Float32Array(size); // all zeros
}

function toneFrame(size = FRAME_SIZE, amplitude = 0.6, freqHz = 220): Float32Array {
  const frame = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    frame[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
  }
  return frame;
}

function newVad(): VadStateMachine {
  return new VadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    minSpeechFrames: 2,
    hangoverFrames: 3,
  });
}

console.log("vadCore: pure DSP helpers");
{
  assert(computeRmsDb(silenceFrame()) === -Infinity, "digital silence measures -Infinity dBFS");
  const loud = computeRmsDb(toneFrame(FRAME_SIZE, 0.9));
  const quiet = computeRmsDb(toneFrame(FRAME_SIZE, 0.05));
  assert(loud > quiet, "louder tone has higher dBFS than quieter tone");
  assert(computeZeroCrossingRate(silenceFrame()) === 0, "silence has zero zero-crossings");
  assert(
    computeZeroCrossingRate(toneFrame(FRAME_SIZE, 0.6, 220)) > 0,
    "a sine tone has a nonzero zero-crossing rate"
  );
  assert(
    frameSizeForSampleRate(16000, 20) === 320,
    "frame size math matches sampleRate * durationMs / 1000"
  );
}

console.log("\nvadCore: silence stays classified as silence");
{
  const vad = newVad();
  let allSilence = true;
  for (let i = 0; i < 20; i++) {
    const result = vad.processFrame(silenceFrame());
    if (result.label !== "silence") allSilence = false;
  }
  assert(allSilence, "20 consecutive silent frames never flip to speech");
}

console.log("\nvadCore: sustained loud tone is detected as speech");
{
  const vad = newVad();
  // Warm up the adaptive noise floor on a few quiet frames first, like a
  // real call would start in a mostly-quiet room.
  for (let i = 0; i < 5; i++) vad.processFrame(silenceFrame());
  let sawSpeech = false;
  for (let i = 0; i < 15; i++) {
    const result = vad.processFrame(toneFrame(FRAME_SIZE, 0.7, 180));
    if (result.label === "speech") sawSpeech = true;
  }
  assert(sawSpeech, "a loud, voice-band tone eventually triggers a speech label");
}

console.log("\nvadCore: start/end transitions via VoiceActivityDetector-style usage");
{
  const vad = newVad();
  const labels: string[] = [];
  for (let i = 0; i < 5; i++) labels.push(vad.processFrame(silenceFrame()).label);
  for (let i = 0; i < 10; i++) labels.push(vad.processFrame(toneFrame(FRAME_SIZE, 0.7)).label);
  for (let i = 0; i < 10; i++) labels.push(vad.processFrame(silenceFrame()).label);

  const firstSpeechIdx = labels.indexOf("speech");
  const lastSpeechIdx = labels.lastIndexOf("speech");
  assert(firstSpeechIdx > -1, "speech segment is detected after the tone begins");
  assert(
    labels[labels.length - 1] === "silence",
    "label returns to silence once the hangover window elapses after the tone stops"
  );
  assert(lastSpeechIdx < labels.length - 1, "silence tail is present after speech ends");
}

console.log("\nvadCore: short/odd-length chunks are handled without crashing");
{
  const vad = newVad();
  assert(
    (() => {
      vad.processFrame(new Float32Array(0));
      return true;
    })(),
    "empty frame does not throw"
  );
  assert(
    (() => {
      vad.processFrame(new Float32Array(3));
      return true;
    })(),
    "frame shorter than configured frame size does not throw"
  );
  assert(
    (() => {
      vad.processFrame(toneFrame(FRAME_SIZE * 3));
      return true;
    })(),
    "frame longer than configured frame size does not throw"
  );
}

console.log("\nvadCore: continuous input keeps producing a predictable output shape");
{
  const vad = newVad();
  let ok = true;
  for (let i = 0; i < 200; i++) {
    const frame = i % 2 === 0 ? silenceFrame() : toneFrame();
    const result = vad.processFrame(frame);
    const shapeOk =
      (result.label === "speech" || result.label === "silence") &&
      typeof result.energyDb === "number" &&
      typeof result.zcr === "number" &&
      typeof result.isSpeechFrame === "boolean" &&
      typeof result.timestampMs === "number";
    if (!shapeOk) ok = false;
  }
  assert(ok, "200 alternating frames all produce a well-formed VADFrameResult");
}

console.log("\nspeechAudioGate: silence alone never produces output");
{
  const vad = newVad();
  const gate = new SpeechAudioGate({ frameDurationMs: FRAME_MS, preRollFrames: 2 });
  let anyChunks = false;
  for (let i = 0; i < 30; i++) {
    const frame = silenceFrame();
    const result = vad.processFrame(frame);
    const chunks = gate.push(frame, vad.isInSpeech, result.timestampMs);
    if (chunks.length > 0) anyChunks = true;
  }
  assert(!anyChunks, "30 consecutive silent frames never leave the gate as speechAudio");
}

console.log("\nspeechAudioGate: speech segment produces gated audio, with pre-roll backfilled");
{
  const vad = newVad(); // minSpeechFrames: 2, hangoverFrames: 3
  const gate = new SpeechAudioGate({ frameDurationMs: FRAME_MS, preRollFrames: 2 });
  const emittedTimestamps: number[] = [];
  let firstGatedTimestamp: number | null = null;
  let firstSpeechLabelTimestamp: number | null = null;

  for (let i = 0; i < 5; i++) {
    const frame = silenceFrame();
    const result = vad.processFrame(frame);
    gate.push(frame, vad.isInSpeech, result.timestampMs);
  }
  for (let i = 0; i < 10; i++) {
    const frame = toneFrame(FRAME_SIZE, 0.7);
    const result = vad.processFrame(frame);
    if (result.label === "speech" && firstSpeechLabelTimestamp === null) {
      firstSpeechLabelTimestamp = result.timestampMs;
    }
    const chunks = gate.push(frame, vad.isInSpeech, result.timestampMs);
    for (const chunk of chunks) {
      emittedTimestamps.push(chunk.timestampMs);
      if (firstGatedTimestamp === null) firstGatedTimestamp = chunk.timestampMs;
    }
  }
  for (let i = 0; i < 10; i++) {
    const frame = silenceFrame();
    const result = vad.processFrame(frame);
    const chunks = gate.push(frame, vad.isInSpeech, result.timestampMs);
    for (const chunk of chunks) emittedTimestamps.push(chunk.timestampMs);
  }

  assert(emittedTimestamps.length > 0, "gate emits audio once a speech segment is confirmed");
  assert(
    firstGatedTimestamp !== null &&
      firstSpeechLabelTimestamp !== null &&
      firstGatedTimestamp < firstSpeechLabelTimestamp,
    "pre-roll backfill hands over audio from before the segment was confirmed, not just after"
  );
  assert(
    new Set(emittedTimestamps).size === emittedTimestamps.length,
    "gated chunks have distinct, monotonically meaningful timestamps (no duplicates)"
  );
}

console.log("\nspeechAudioGate: reset() clears pre-roll and speech state");
{
  const gate = new SpeechAudioGate({ frameDurationMs: FRAME_MS, preRollFrames: 2 });
  gate.push(toneFrame(), true, 100); // pretend we were mid-segment
  gate.reset();
  const chunksAfterReset = gate.push(silenceFrame(), false, 120);
  assert(chunksAfterReset.length === 0, "a silent frame right after reset() still produces no output");
}

console.log("\npcm: concatFloat32 assembles chunks in order");
{
  const a = new Float32Array([1, 2, 3]);
  const b = new Float32Array([4, 5]);
  const c = new Float32Array([6]);
  const joined = concatFloat32([a, b, c]);
  assert(joined.length === 6, "joined length is the sum of chunk lengths");
  assert(
    Array.from(joined).every((v, i) => v === i + 1),
    "joined samples preserve chunk order and values"
  );
  assert(concatFloat32([]).length === 0, "concatenating zero chunks yields a zero-length array, not a throw");
}

console.log("\nspeech with pauses: hangover frames prevent chopping brief pauses");
{
  const vad = new VadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    minSpeechFrames: 2,
    hangoverFrames: 4, // 4 frames = 80ms pause tolerance
  });

  // Start with silence
  for (let i = 0; i < 3; i++) vad.processFrame(silenceFrame());

  // First speech burst (3 frames = 60ms)
  for (let i = 0; i < 3; i++) vad.processFrame(toneFrame(FRAME_SIZE, 0.7));
  assert(vad.isInSpeech, "entered speech state after burst");

  // Brief pause (2 frames = 40ms, less than hangover of 4)
  vad.processFrame(silenceFrame());
  vad.processFrame(silenceFrame());
  assert(vad.isInSpeech, "remains in speech during pause shorter than hangover");

  // Second speech burst (3 frames)
  for (let i = 0; i < 3; i++) vad.processFrame(toneFrame(FRAME_SIZE, 0.7));
  assert(vad.isInSpeech, "still in speech as second burst arrives");

  // Extended silence (5 frames > hangover of 4)
  for (let i = 0; i < 5; i++) vad.processFrame(silenceFrame());
  assert(!vad.isInSpeech, "exits speech after silence exceeds hangover duration");
}

console.log("\nbackground noise: adaptive noise floor raises threshold to prevent false triggers");
{
  const vad = new VadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    noiseAdaptationEnabled: true,
    noiseMarginDb: 12,
    energyThresholdDb: -50,
  });

  // Moderate continuous background hiss/hum
  function noiseFrame(): Float32Array {
    return toneFrame(FRAME_SIZE, 0.08, 60); // low level hum (~ -28 dBFS)
  }

  // Feed 40 frames of background noise to let noise floor adapt
  for (let i = 0; i < 40; i++) {
    vad.processFrame(noiseFrame());
  }

  // Next frame of the same steady background noise should now be classified as silence/non-speech
  const result = vad.processFrame(noiseFrame());
  assert(
    !result.isSpeechFrame && result.label === "silence",
    "adapted noise floor prevents steady background noise from triggering false speech detection"
  );
}

console.log("\nSpeechSegment: validates full assembled utterance shape for ML pipeline");
{
  const vad = new VadStateMachine({
    sampleRate: SAMPLE_RATE,
    frameDurationMs: FRAME_MS,
    minSpeechFrames: 2,
    hangoverFrames: 2,
  });
  const gate = new SpeechAudioGate({ frameDurationMs: FRAME_MS, preRollFrames: 2 });
  const speechChunks: Float32Array[] = [];

  let startMs: number | null = null;
  let endMs: number | null = null;
  let wasInSpeech = false;

  // 3 silence frames
  for (let i = 0; i < 3; i++) {
    const frame = silenceFrame();
    const res = vad.processFrame(frame);
    gate.push(frame, vad.isInSpeech, res.timestampMs);
  }

  // 6 speech frames
  for (let i = 0; i < 6; i++) {
    const frame = toneFrame(FRAME_SIZE, 0.7);
    const res = vad.processFrame(frame);
    if (vad.isInSpeech && !wasInSpeech) {
      startMs = res.timestampMs;
    }
    wasInSpeech = vad.isInSpeech;
    const chunks = gate.push(frame, vad.isInSpeech, res.timestampMs);
    for (const ch of chunks) speechChunks.push(ch.samples);
  }

  // 4 silence frames to end segment
  for (let i = 0; i < 4; i++) {
    const frame = silenceFrame();
    const res = vad.processFrame(frame);
    if (!vad.isInSpeech && wasInSpeech && endMs === null) {
      endMs = res.timestampMs;
    }
    wasInSpeech = vad.isInSpeech;
    const chunks = gate.push(frame, vad.isInSpeech, res.timestampMs);
    for (const ch of chunks) speechChunks.push(ch.samples);
  }

  const pcm = concatFloat32(speechChunks);
  const durationMs = (endMs ?? 0) - (startMs ?? 0);

  assert(pcm.length > 0, "assembled PCM contains non-empty audio samples");
  assert(startMs !== null && endMs !== null && endMs > startMs, "segment has valid start and end timestamps");
  assert(durationMs > 0, "segment has valid calculated duration in ms");
  assert(pcm instanceof Float32Array, "pcm is a valid Float32Array");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
