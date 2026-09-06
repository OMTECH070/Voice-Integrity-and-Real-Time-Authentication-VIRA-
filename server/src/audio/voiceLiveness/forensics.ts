import { InferenceSession, Tensor } from "onnxruntime-node";
import path from "path";
import fs from "fs";

export async function inspectModels() {
  console.log("==========================================================================");
  console.log("FORENSIC MODEL INSPECTION: AASIST & ECAPA ONNX");
  console.log("==========================================================================");

  const aasistPath = path.resolve(__dirname, "../../../models/aasist.onnx");
  const ecapaPath = path.resolve(__dirname, "../../../models/ecapa.onnx");

  console.log(`Checking AASIST file: ${aasistPath}`);
  console.log(`  Exists: ${fs.existsSync(aasistPath)}, Size: ${(fs.statSync(aasistPath).size / (1024 * 1024)).toFixed(2)} MB`);

  const aasistDataPath = path.resolve(__dirname, "../../../models/aasist.onnx.data");
  if (fs.existsSync(aasistDataPath)) {
    console.log(`  External Data File exists: ${aasistDataPath}, Size: ${(fs.statSync(aasistDataPath).size / (1024 * 1024)).toFixed(2)} MB`);
  }

  const aasistSession = await InferenceSession.create(aasistPath);
  console.log("\nAASIST Session Metadata:");
  console.log("  Input names:", aasistSession.inputNames);
  console.log("  Output names:", aasistSession.outputNames);

  console.log(`\nChecking ECAPA file: ${ecapaPath}`);
  console.log(`  Exists: ${fs.existsSync(ecapaPath)}, Size: ${(fs.statSync(ecapaPath).size / (1024 * 1024)).toFixed(2)} MB`);
  const ecapaSession = await InferenceSession.create(ecapaPath);
  console.log("\nECAPA Session Metadata:");
  console.log("  Input names:", ecapaSession.inputNames);
  console.log("  Output names:", ecapaSession.outputNames);

  // Test AASIST with various audio waveforms
  console.log("\n--------------------------------------------------------------------------");
  console.log("AASIST INFERENCE WITH MULTIPLE WAVEFORM TYPES");
  console.log("--------------------------------------------------------------------------");

  const sampleRate = 16000;
  const numSamples = 64600; // 64,600 samples = exactly ~4.0375s expected by raw AASIST architecture

  // Test 1: Complete Silence (all zeros)
  const silence = new Float32Array(numSamples);
  const silenceTensor = new Tensor("float32", silence, [1, numSamples]);
  const silenceOut = await aasistSession.run({ [aasistSession.inputNames[0]]: silenceTensor });
  const silenceRaw = silenceOut[aasistSession.outputNames[0]];
  console.log("Test 1 (Pure Silence):");
  console.log("  Raw Output dims:", silenceRaw.dims);
  console.log("  Raw Output data:", Array.from(silenceRaw.data as Float32Array));

  // Test 2: Low-level Gaussian Noise (amplitude 0.005)
  const noise = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    noise[i] = 0.005 * (Math.random() - 0.5);
  }
  const noiseTensor = new Tensor("float32", noise, [1, numSamples]);
  const noiseOut = await aasistSession.run({ [aasistSession.inputNames[0]]: noiseTensor });
  const noiseRaw = noiseOut[aasistSession.outputNames[0]];
  console.log("\nTest 2 (Low-level Ambient Noise):");
  console.log("  Raw Output dims:", noiseRaw.dims);
  console.log("  Raw Output data:", Array.from(noiseRaw.data as Float32Array));

  // Test 3: Synthetic pure sine wave (440Hz + 880Hz, amplitude 0.3)
  const synth = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    synth[i] = 0.3 * Math.sin(2 * Math.PI * 440 * t) + 0.2 * Math.sin(2 * Math.PI * 880 * t);
  }
  const synthTensor = new Tensor("float32", synth, [1, numSamples]);
  const synthOut = await aasistSession.run({ [aasistSession.inputNames[0]]: synthTensor });
  const synthRaw = synthOut[aasistSession.outputNames[0]];
  console.log("\nTest 3 (Synthetic Pure Tones / Harmonic Artifact):");
  console.log("  Raw Output dims:", synthRaw.dims);
  console.log("  Raw Output data:", Array.from(synthRaw.data as Float32Array));

  // Check WAV files in repo
  console.log("\n--------------------------------------------------------------------------");
  console.log("SEARCHING FOR WAV SAMPLES IN REPOSITORY");
  console.log("--------------------------------------------------------------------------");

  function findWavFiles(dir: string, results: string[] = []): string[] {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist") {
        findWavFiles(fullPath, results);
      } else if (entry.isFile() && entry.name.endsWith(".wav")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const wavs = findWavFiles(path.resolve(__dirname, "../../../.."));
  console.log(`Found ${wavs.length} WAV files:`);
  for (const w of wavs) {
    console.log(`  - ${w} (${(fs.statSync(w).size / 1024).toFixed(1)} KB)`);
  }
}

inspectModels().catch(console.error);
