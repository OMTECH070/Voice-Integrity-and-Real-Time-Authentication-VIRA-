import fs from "fs";

export interface ParsedWav {
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  samples: Float32Array;
}

/**
 * Parses a standard RIFF/WAVE PCM buffer (16-bit integer PCM or 32-bit float PCM) into a Float32Array mono stream.
 */
export function parseWavBuffer(buffer: Buffer): ParsedWav {
  // Check RIFF header
  if (buffer.toString("utf8", 0, 4) !== "RIFF" || buffer.toString("utf8", 8, 12) !== "WAVE") {
    throw new Error("Invalid WAV format: Missing RIFF/WAVE header");
  }

  let offset = 12;
  let audioFormat = 1; // 1 = PCM integer, 3 = IEEE float
  let channels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString("utf8", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (!dataOffset || dataSize === 0) {
    throw new Error("Invalid WAV format: Missing data chunk");
  }

  let samples: Float32Array;

  if (audioFormat === 1 && bitsPerSample === 16) {
    const totalSamples = Math.floor(dataSize / 2);
    const rawFloats = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const int16 = buffer.readInt16LE(dataOffset + i * 2);
      rawFloats[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }

    if (channels === 2) {
      // Downmix stereo to mono
      const monoLength = Math.floor(totalSamples / 2);
      samples = new Float32Array(monoLength);
      for (let i = 0; i < monoLength; i++) {
        samples[i] = (rawFloats[i * 2] + rawFloats[i * 2 + 1]) / 2;
      }
    } else {
      samples = rawFloats;
    }
  } else if ((audioFormat === 3 || audioFormat === 1) && bitsPerSample === 32) {
    const totalSamples = Math.floor(dataSize / 4);
    const rawFloats = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      rawFloats[i] = buffer.readFloatLE(dataOffset + i * 4);
    }

    if (channels === 2) {
      const monoLength = Math.floor(totalSamples / 2);
      samples = new Float32Array(monoLength);
      for (let i = 0; i < monoLength; i++) {
        samples[i] = (rawFloats[i * 2] + rawFloats[i * 2 + 1]) / 2;
      }
    } else {
      samples = rawFloats;
    }
  } else {
    throw new Error(
      `Unsupported WAV encoding: format=${audioFormat}, bitsPerSample=${bitsPerSample}, channels=${channels}`
    );
  }

  const durationSeconds = samples.length / sampleRate;

  return {
    sampleRate,
    channels: 1, // Normalized to mono
    durationSeconds,
    samples,
  };
}

/**
 * Reads and parses a WAV file from disk.
 */
export function readWavFile(filePath: string): ParsedWav {
  const buffer = fs.readFileSync(filePath);
  return parseWavBuffer(buffer);
}

/**
 * Creates a standard 16-bit PCM WAV buffer from a Float32Array (useful for generating test fixtures).
 */
export function createWavBuffer(samples: Float32Array, sampleRate = 16000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.round(int16), 44 + i * 2);
  }

  return buffer;
}
