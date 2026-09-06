/**
 * Manual smoke test: runs audio through the REAL integration —
 * VoiceLivenessAnalyzer + OnnxNodeVoiceLivenessBackend + the actual
 * aasist.onnx file — not just raw onnxruntime like verify_onnx.py did.
 *
 * Always runs two synthetic baseline cases (tone, silence). Any extra
 * arguments after the model path are treated as paths to real WAV files
 * — each one is run through the identical pipeline.
 *
 * IMPORTANT — v5 fix: SpeechChunkBuffer.push() assumes it's fed small
 * incremental pieces (like ~20ms VAD frames), the way it will actually
 * be called in production. It has no logic to split a single piece that
 * already contains more than one window's worth of audio — if you hand
 * it a whole file in one push(), it emits that entire oversized blob as
 * ONE chunk, which then gets silently cropped down to the model's
 * required length by fitToLength, discarding everything after the first
 * ~4 seconds. (v3/v4 of this script had exactly that bug — see the
 * chunkBuffer.ts discussion raised with Om.)
 *
 * This version feeds real WAV files in ~20ms slices with correctly
 * incrementing timestamps — the same shape real streaming audio would
 * arrive in — so SpeechChunkBuffer's actual multi-window behavior is
 * exercised properly across the whole file, not just its first window.
 *
 * Run with:
 *   npx tsx src/audio/voiceLiveness/smokeTest.ts <path-to-aasist.onnx>
 *   npx tsx src/audio/voiceLiveness/smokeTest.ts <path-to-aasist.onnx> my-voice.wav
 *   npx tsx src/audio/voiceLiveness/smokeTest.ts <path-to-aasist.onnx> my-voice.wav tts-sample.wav
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { OnnxNodeVoiceLivenessBackend } from "./adapters/onnxNodeBackend";
import { VoiceLivenessAnalyzer } from "./VoiceLivenessAnalyzer";
import type { VoiceLivenessResult } from "./types";

const modelPath = process.argv[2];
const wavPaths = process.argv.slice(3);

if (!modelPath) {
  console.error("Usage: npx tsx smokeTest.ts <path-to-aasist.onnx> [real-audio.wav ...]");
  process.exit(1);
}

const SETTLE_MS = 4000;
const FEED_SLICE_MS = 20; // mimics the ~20ms VAD frame size this buffer is designed around

function silence(sampleRate: number, ms: number): Float32Array {
  return new Float32Array(Math.round((sampleRate * ms) / 1000));
}

function tone(sampleRate: number, ms: number, freqHz = 180, amplitude = 0.4): Float32Array {
  const n = Math.round((sampleRate * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

function loadWav(path: string): { samples: Float32Array; sampleRate: number } {
  const buf = readFileSync(path);

  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path}: not a RIFF/WAVE file (only uncompressed .wav is supported)`);
  }

  let offset = 12;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let audioFormat: number | null = null;
  let numChannels: number | null = null;
  let dataStart: number | null = null;
  let dataLength: number | null = null;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkBody = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buf.readUInt16LE(chunkBody);
      numChannels = buf.readUInt16LE(chunkBody + 2);
      sampleRate = buf.readUInt32LE(chunkBody + 4);
      bitsPerSample = buf.readUInt16LE(chunkBody + 14);
    } else if (chunkId === "data") {
      dataStart = chunkBody;
      dataLength = chunkSize;
    }

    offset = chunkBody + chunkSize + (chunkSize % 2);
  }

  if (sampleRate === null || bitsPerSample === null || dataStart === null || dataLength === null) {
    throw new Error(`${path}: missing fmt or data chunk — is this a valid WAV file?`);
  }
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error(
      `${path}: unsupported WAV audio format code ${audioFormat} — only PCM (1) and IEEE float (3) are supported`
    );
  }

  const channels = numChannels ?? 1;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / bytesPerSample / channels);
  const mono = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const byteOffset = dataStart + (i * channels + ch) * bytesPerSample;
      let value: number;
      if (audioFormat === 3 && bitsPerSample === 32) {
        value = buf.readFloatLE(byteOffset);
      } else if (bitsPerSample === 16) {
        value = buf.readInt16LE(byteOffset) / 32768;
      } else if (bitsPerSample === 32) {
        value = buf.readInt32LE(byteOffset) / 2147483648;
      } else if (bitsPerSample === 8) {
        value = (buf.readUInt8(byteOffset) - 128) / 128;
      } else {
        throw new Error(`${path}: unsupported bits-per-sample ${bitsPerSample}`);
      }
      sum += value;
    }
    mono[i] = sum / channels;
  }

  return { samples: mono, sampleRate };
}

interface Outcome {
  label: string;
  result?: VoiceLivenessResult;
  error?: Error;
}

/**
 * Runs one case through its own analyzer instance, feeding the audio in
 * small ~20ms slices with correctly incrementing timestamps (mirroring
 * how real streaming audio arrives) rather than one giant push — this is
 * what actually exercises SpeechChunkBuffer's windowing across a whole
 * multi-chunk file instead of triggering its single-oversized-chunk
 * behavior. Collects every chunk result produced, not just the first.
 */
async function runCase(
  backend: OnnxNodeVoiceLivenessBackend,
  label: string,
  samples: Float32Array,
  sourceSampleRate: number
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  const analyzer = new VoiceLivenessAnalyzer(
    backend,
    {
      onResult: (result) => outcomes.push({ label, result }),
      onError: (error) => outcomes.push({ label, error }),
    },
    { chunkDurationMs: (64600 / 16000) * 1000 }
  );

  const sliceSamples = Math.max(1, Math.round((sourceSampleRate * FEED_SLICE_MS) / 1000));
  let t = 0;
  for (let offset = 0; offset < samples.length; offset += sliceSamples) {
    const piece = samples.subarray(offset, Math.min(offset + sliceSamples, samples.length));
    analyzer.push(piece, t, sourceSampleRate);
    t += (piece.length / sourceSampleRate) * 1000;
  }
  analyzer.flush(t);

  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  return outcomes;
}

async function main(): Promise<void> {
  const backend = new OnnxNodeVoiceLivenessBackend({
    antispoofModelPath: modelPath,
    antispoofInputName: "input",
    antispoofOutputName: "spoof_prob",
    antispoofRequiredInputLength: 64600,
  });

  const sourceRate = 48000;
  const chunkMs = (64600 / 16000) * 1000;

  const cases: Array<{ label: string; samples: Float32Array; sourceSampleRate: number }> = [
    { label: "synthetic tone", samples: tone(sourceRate, chunkMs), sourceSampleRate: sourceRate },
    { label: "silence", samples: silence(sourceRate, chunkMs), sourceSampleRate: sourceRate },
  ];

  for (const wavPath of wavPaths) {
    try {
      const { samples, sampleRate } = loadWav(wavPath);
      cases.push({ label: basename(wavPath), samples, sourceSampleRate: sampleRate });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`Failed to load ${wavPath}: ${error.message}`);
    }
  }

  const allOutcomes: Outcome[] = [];
  for (const c of cases) {
    const durationS = c.samples.length / c.sourceSampleRate;
    const expectedChunks = Math.max(1, Math.ceil((durationS * 1000) / chunkMs));
    console.log(
      `Feeding "${c.label}" (${durationS.toFixed(2)}s @ ${c.sourceSampleRate}Hz, ` +
        `fed in ${FEED_SLICE_MS}ms slices, ~${expectedChunks} chunk(s) expected)...`
    );
    const outcomes = await runCase(backend, c.label, c.samples, c.sourceSampleRate);
    allOutcomes.push(...outcomes);
  }

  const results = allOutcomes.filter((o) => o.result);
  const errors = allOutcomes.filter((o) => o.error);

  console.log(`\n${results.length} result(s), ${errors.length} error(s)\n`);
  for (const { label, result: r } of results) {
    console.log(
      `  [${label}]  atMs=${r!.atMs.toFixed(0)}  spoofScore=${r!.spoofScore.toFixed(4)}  ` +
        `label=${r!.label}  inferenceMs=${r!.inferenceMs}`
    );
  }
  for (const { label, error } of errors) {
    console.error(`  ERROR [${label}]: ${error!.message}`);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  } else if (results.length === 0) {
    console.error("No results produced at all — investigate before trusting anything above.");
    process.exitCode = 1;
  } else {
    console.log("\nOK: the real analyzer + ONNX backend pipeline ran end-to-end without errors.");
  }
}

main();
