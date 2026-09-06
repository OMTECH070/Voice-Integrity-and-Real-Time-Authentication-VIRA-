/**
 * Small, dependency-free PCM utilities. Kept separate from vadCore.ts
 * because these operate on already-gated speech audio (see
 * speechAudioGate.ts), not on the speech/non-speech decision itself.
 */

/**
 * Concatenates Float32Array PCM chunks, in order, into one contiguous
 * buffer — used to assemble a full speech segment from the frame-by-frame
 * chunks the worklet hands over, for consumers (ECAPA, Whisper, ...) that
 * want one clean utterance rather than a frame stream.
 *
 * Returns a zero-length array for empty input rather than throwing, since
 * a segment with no captured audio (e.g. gate produced nothing before
 * stop() was called mid-segment) is a valid, if unusual, edge case.
 */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  if (chunks.length === 0) return new Float32Array(0);
  if (chunks.length === 1) return chunks[0];

  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;

  const out = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Encodes 32-bit float PCM as a 16-bit signed PCM WAV file (mono). This is
 * a manual-verification aid, not a production transcoding path — it lets
 * a human actually listen to a captured segment (e.g. via the demo panel)
 * to confirm silence was excluded, without pulling in an audio library.
 */
export function encodeWavPCM16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Resamples a Float32Array PCM stream from inSampleRate to outSampleRate (e.g. 48000 -> 16000)
 * using linear interpolation.
 */
export function resamplePcm(samples: Float32Array, inSampleRate: number, outSampleRate: number): Float32Array {
  if (inSampleRate === outSampleRate || samples.length === 0) {
    return samples;
  }
  const ratio = inSampleRate / outSampleRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const fraction = srcIndex - i0;
    out[i] = samples[i0] * (1 - fraction) + samples[i1] * fraction;
  }

  return out;
}

