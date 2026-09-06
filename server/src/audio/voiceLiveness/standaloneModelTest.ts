import path from "path";
import fs from "fs";
import { parseWavBuffer, createWavBuffer } from "./validation/wavHelper";
import { voiceLivenessService } from "../../services/voiceLiveness.service";
import { voiceAuthService } from "../../services/voiceAuth.service";

/**
 * Generates an acoustic glottal pulse train + vocal tract filter modeling human speech.
 * Glottal flow derivative model (Rosenberg / Liljencrants-Fant pulse) with natural jitter and formant filtering.
 */
export function generateRealisticHumanSpeechWav(
  durationSeconds = 4.0,
  pitchHz = 125,
  sampleRate = 16000
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const audio = new Float32Array(numSamples);

  let phase = 0;
  // Vocal tract formant bandwidths & centers (e.g. vowel /a/ -> F1=730Hz, F2=1090Hz, F3=2440Hz)
  const F1 = 730;
  const F2 = 1090;
  const F3 = 2440;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Pitch jitter (natural cycle-to-cycle frequency variation)
    const jitter = 1.0 + 0.015 * Math.sin(2 * Math.PI * 6.0 * t) + 0.008 * (Math.sin(2 * Math.PI * 13.7 * t));
    const currentF0 = pitchHz * jitter;
    const periodSamples = sampleRate / currentF0;

    phase += 1.0;
    if (phase >= periodSamples) {
      phase -= periodSamples;
    }

    // Glottal excitation pulse (damped acoustic flow)
    const normalizedPhase = phase / periodSamples;
    let glottal = 0;
    if (normalizedPhase < 0.4) {
      glottal = 0.5 * (1 - Math.cos((Math.PI * normalizedPhase) / 0.4));
    } else if (normalizedPhase < 0.56) {
      glottal = Math.cos((Math.PI * (normalizedPhase - 0.4)) / 0.32);
    } else {
      glottal = 0;
    }

    // Speech envelope syllabic modulation (2.5 Hz speech rate)
    const syllableEnv = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.5 * t);

    // Formant filtering (superposition of impulse-excited formant resonators)
    const formantResonance =
      Math.sin(2 * Math.PI * F1 * t) * Math.exp(-t * 0.05 % (1 / currentF0) * 150) +
      0.6 * Math.sin(2 * Math.PI * F2 * t) * Math.exp(-t * 0.05 % (1 / currentF0) * 200) +
      0.3 * Math.sin(2 * Math.PI * F3 * t) * Math.exp(-t * 0.05 % (1 / currentF0) * 300);

    // Speech signal with slight aspiration noise floor
    const aspiration = 0.02 * (Math.random() - 0.5);
    audio[i] = (glottal * (0.4 + 0.6 * formantResonance) + aspiration) * syllableEnv * 0.15;
  }

  return audio;
}

/**
 * Generates an artificial synthetic vocoder / phase-locked attack waveform.
 */
export function generateSyntheticVocoderWav(
  durationSeconds = 4.0,
  pitchHz = 125,
  sampleRate = 16000
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const audio = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Rigid phase, unnatural harmonic richness with high-frequency buzz (typical of basic vocoders)
    let sample = 0;
    for (let h = 1; h <= 30; h++) {
      const freq = pitchHz * h;
      if (freq >= sampleRate / 2) break;
      sample += (1.0 / h) * Math.sin(2 * Math.PI * freq * t);
    }
    // High-frequency aliasing artifact
    sample += 0.15 * Math.sin(2 * Math.PI * 3800 * t);
    audio[i] = sample * 0.08;
  }

  return audio;
}

export async function runStandaloneModelValidation() {
  console.log("==========================================================================");
  console.log("VIRA STANDALONE MODEL VALIDATION AUDIT (AASIST & ECAPA)");
  console.log("==========================================================================");

  // Initialize server services
  voiceLivenessService.init();
  await voiceAuthService.init();

  const sampleRate = 16000;

  // 1. Generate and save known human speech WAV
  console.log("\n[TASK 4] Generating Known Human Speech WAV...");
  const humanSamples = generateRealisticHumanSpeechWav(4.0, 120, sampleRate);
  const humanWavPath = path.resolve(__dirname, "known_human_speech.wav");
  fs.writeFileSync(humanWavPath, createWavBuffer(humanSamples, sampleRate));
  console.log(`  Saved: ${humanWavPath} (${(fs.statSync(humanWavPath).size / 1024).toFixed(1)} KB)`);

  // 2. Generate and save known synthetic vocoder WAV
  console.log("\n[TASK 4] Generating Known Synthetic Vocoder Speech WAV...");
  const synthSamples = generateSyntheticVocoderWav(4.0, 120, sampleRate);
  const synthWavPath = path.resolve(__dirname, "known_synthetic_speech.wav");
  fs.writeFileSync(synthWavPath, createWavBuffer(synthSamples, sampleRate));
  console.log(`  Saved: ${synthWavPath} (${(fs.statSync(synthWavPath).size / 1024).toFixed(1)} KB)`);

  // 3. Test AASIST directly on Human Speech WAV
  console.log("\n--------------------------------------------------------------------------");
  console.log("AASIST DIRECT INFERENCE: KNOWN HUMAN SPEECH WAV");
  console.log("--------------------------------------------------------------------------");
  const humanWav = parseWavBuffer(fs.readFileSync(humanWavPath));
  const humanAasistRes = await voiceLivenessService.analyze(humanWav.samples, humanWav.sampleRate);
  console.log(`Human Audio Metrics:`);
  console.log(`  Sample Rate: ${humanWav.sampleRate} Hz`);
  console.log(`  Samples Count: ${humanWav.samples.length} (${humanWav.durationSeconds.toFixed(2)}s)`);
  console.log(`  Raw Spoof Score: ${humanAasistRes.spoofScore.toFixed(6)}`);
  console.log(`  Spoof Likelihood: ${(humanAasistRes.spoofScore * 100).toFixed(2)}%`);
  console.log(`  Label: ${humanAasistRes.label}`);
  console.log(`  Inference Latency: ${humanAasistRes.processingLatencyMs} ms`);

  // 4. Test AASIST directly on Synthetic Speech WAV
  console.log("\n--------------------------------------------------------------------------");
  console.log("AASIST DIRECT INFERENCE: KNOWN SYNTHETIC SPEECH WAV");
  console.log("--------------------------------------------------------------------------");
  const synthWav = parseWavBuffer(fs.readFileSync(synthWavPath));
  const synthAasistRes = await voiceLivenessService.analyze(synthWav.samples, synthWav.sampleRate);
  console.log(`Synthetic Audio Metrics:`);
  console.log(`  Sample Rate: ${synthWav.sampleRate} Hz`);
  console.log(`  Samples Count: ${synthWav.samples.length} (${synthWav.durationSeconds.toFixed(2)}s)`);
  console.log(`  Raw Spoof Score: ${synthAasistRes.spoofScore.toFixed(6)}`);
  console.log(`  Spoof Likelihood: ${(synthAasistRes.spoofScore * 100).toFixed(2)}%`);
  console.log(`  Label: ${synthAasistRes.label}`);
  console.log(`  Inference Latency: ${synthAasistRes.processingLatencyMs} ms`);

  // 5. Test ECAPA-TDNN Speaker Verification on Known Enrollment, Same Speaker, and Different Speaker
  console.log("\n--------------------------------------------------------------------------");
  console.log("[TASK 7] ECAPA-TDNN SPEAKER VERIFICATION DIRECT AUDIT");
  console.log("--------------------------------------------------------------------------");
  const enrollSpeakerSamples = generateRealisticHumanSpeechWav(3.5, 125, sampleRate);
  const sameSpeakerSamples = generateRealisticHumanSpeechWav(3.5, 126, sampleRate);
  const diffSpeakerSamples = generateRealisticHumanSpeechWav(3.5, 230, sampleRate);

  const enrollEmbedding = await voiceAuthService.extractEmbedding(enrollSpeakerSamples, sampleRate);
  const sameEmbedding = await voiceAuthService.extractEmbedding(sameSpeakerSamples, sampleRate);
  const diffEmbedding = await voiceAuthService.extractEmbedding(diffSpeakerSamples, sampleRate);

  const sameSim = voiceAuthService.computeCosineSimilarity(enrollEmbedding, sameEmbedding);
  const diffSim = voiceAuthService.computeCosineSimilarity(enrollEmbedding, diffEmbedding);

  const sameVer = voiceAuthService.verifySpeaker(enrollEmbedding, sameEmbedding);
  const diffVer = voiceAuthService.verifySpeaker(enrollEmbedding, diffEmbedding);

  console.log(`ECAPA Embedding Dimension: ${enrollEmbedding.length}-dim (L2-normalized)`);
  console.log(`Same-Speaker Cosine Similarity: ${sameSim.toFixed(4)} (${(sameSim * 100).toFixed(1)}%) -> Label: ${sameVer.label} (match=${sameVer.match})`);
  console.log(`Different-Speaker Cosine Similarity: ${diffSim.toFixed(4)} (${(diffSim * 100).toFixed(1)}%) -> Label: ${diffVer.label} (match=${diffVer.match})`);

  // Clean up temporary WAV files
  if (fs.existsSync(humanWavPath)) fs.unlinkSync(humanWavPath);
  if (fs.existsSync(synthWavPath)) fs.unlinkSync(synthWavPath);

  console.log("\n==========================================================================");
  console.log("FORENSIC AUDIT SUMMARY");
  console.log("==========================================================================");
  console.log(`AASIST Model Output Interpretation: spoof_prob [0.0 = Live Human, 1.0 = Synthetic Spoof]`);
  console.log(`Human Speech Spoof Likelihood: ${(humanAasistRes.spoofScore * 100).toFixed(2)}% (${humanAasistRes.label})`);
  console.log(`Synthetic Speech Spoof Likelihood: ${(synthAasistRes.spoofScore * 100).toFixed(2)}% (${synthAasistRes.label})`);
  console.log(`ECAPA Same-Speaker Similarity: ${(sameSim * 100).toFixed(2)}%`);
  console.log(`ECAPA Different-Speaker Similarity: ${(diffSim * 100).toFixed(2)}%`);
  console.log("==========================================================================");
}

if (require.main === module) {
  runStandaloneModelValidation().catch(console.error);
}
