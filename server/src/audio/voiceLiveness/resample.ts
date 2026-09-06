/**
 * Minimal resampler. The VAD hands over audio at whatever rate the
 * caller's AudioContext used (commonly 48000Hz); ECAPA-TDNN and
 * AASIST/RawNet2-style anti-spoof models are almost universally trained
 * at 16000Hz. This is that conversion step — deliberately simple linear
 * interpolation, not a high-quality resampling library, because speech
 * models are tolerant of the mild aliasing this introduces and it keeps
 * this module dependency-free. If you find spoof-score accuracy is
 * sensitive to resample quality, swap this for a proper polyphase/sinc
 * resampler (e.g. wrapping a WASM build of libsamplerate) — the call
 * site (VoiceLivenessAnalyzer) doesn't care how resampling is done, only
 * that it produces `targetRate` audio.
 */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;

  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;
    const a = samples[srcIndex] ?? samples[samples.length - 1] ?? 0;
    const b = samples[srcIndex + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }

  return out;
}
