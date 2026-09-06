import test from "node:test";
import assert from "node:assert/strict";
import { xgboostIntegrityService, XGBoostFeatures } from "../../../services/xgboostIntegrity.service";

test("Phase E: XGBoost service correctly reports model artifact status", () => {
  const status = xgboostIntegrityService.getModelStatus();
  assert.equal(status.modelStatus, "REQUIRES_MODEL_ARTIFACT");
  assert.equal(status.isModelTrained, false);
  assert.equal(status.modelVersion, "XGBoost-VIRA-v1");
});

test("Phase E: Feature vector extraction outputs exact 12-dimensional vector in canonical order", () => {
  const features: XGBoostFeatures = {
    ecapaSimilarity: 0.94,
    aasistSpoofScore: 0.08,
    wav2vec2SpoofScore: null,
    vadSpeechRatio: 0.85,
    speechDurationSec: 4.2,
    transcriptRiskScore: 15,
    hasMoneyRequest: false,
    hasUrgencySignal: false,
    hasCredentialRequest: false,
    isSpeakerMismatch: false,
    audioRmsEnergy: 0.25,
    acousticConfidence: 0.98,
  };

  const vector = xgboostIntegrityService.extractFeatureVector(features);
  assert.equal(vector.length, 12, "Feature vector must be exactly 12 dimensions");
  assert.equal(vector[0], 0.94); // ecapa_similarity
  assert.equal(vector[1], 0.08); // aasist_spoof_score
  assert.equal(vector[2], -1.0); // wav2vec2 absent indicator
  assert.equal(vector[3], 0.85); // vad_speech_ratio
  assert.equal(vector[4], 4.2);  // speech_duration_sec
  assert.equal(vector[5], 0.15); // transcript_risk_score (normalized to 0-1)
  assert.equal(vector[6], 0.0);  // has_money_request
  assert.equal(vector[7], 0.0);  // has_urgency_signal
  assert.equal(vector[8], 0.0);  // has_credential_request
  assert.equal(vector[9], 0.0);  // is_speaker_mismatch
  assert.equal(vector[10], 0.25); // audio_rms_energy
  assert.equal(vector[11], 0.98); // acoustic_confidence
});

test("Phase E: Genuine human speaker with clean transcript produces HIGH Voice Integrity and LOW Call Risk", () => {
  const features: XGBoostFeatures = {
    ecapaSimilarity: 0.98,
    aasistSpoofScore: 0.05, // 5% spoof probability = strong live human
    wav2vec2SpoofScore: null,
    vadSpeechRatio: 0.90,
    speechDurationSec: 6.0,
    transcriptRiskScore: 0,
    hasMoneyRequest: false,
    hasUrgencySignal: false,
    hasCredentialRequest: false,
    isSpeakerMismatch: false,
    audioRmsEnergy: 0.35,
    acousticConfidence: 0.99,
  };

  const result = xgboostIntegrityService.evaluateIntegrityAndRisk(features);
  assert.ok(result.voiceIntegrityScore >= 80, `Expected high integrity score, got ${result.voiceIntegrityScore}`);
  assert.equal(result.voiceIntegrityLevel, "HIGH");
  assert.ok(result.callRiskScore <= 15, `Expected low risk score, got ${result.callRiskScore}`);
  assert.equal(result.callRiskLevel, "LOW");
  assert.ok(result.contributingFactors.voiceIntegrity.length > 0);
});

test("Phase E: Synthetic clone / Impostor attempting credential theft produces LOW Voice Integrity and HIGH Call Risk", () => {
  const features: XGBoostFeatures = {
    ecapaSimilarity: 0.45,
    aasistSpoofScore: 0.96, // 96% spoof probability = synthetic vocoder
    wav2vec2SpoofScore: null,
    vadSpeechRatio: 0.85,
    speechDurationSec: 5.0,
    transcriptRiskScore: 80,
    hasMoneyRequest: true,
    hasUrgencySignal: true,
    hasCredentialRequest: true,
    isSpeakerMismatch: true,
    audioRmsEnergy: 0.20,
    acousticConfidence: 0.90,
  };

  const result = xgboostIntegrityService.evaluateIntegrityAndRisk(features);
  assert.ok(result.voiceIntegrityScore <= 20, `Expected low integrity score, got ${result.voiceIntegrityScore}`);
  assert.equal(result.voiceIntegrityLevel, "LOW");
  assert.ok(result.callRiskScore >= 80, `Expected high risk score, got ${result.callRiskScore}`);
  assert.equal(result.callRiskLevel, "HIGH");

  // Verify explainability
  const hasEscalation = result.contributingFactors.callRisk.some((f) =>
    f.includes("CRITICAL ESCALATION")
  );
  assert.ok(hasEscalation, "Contributing factors must include critical escalation");
});
