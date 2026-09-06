import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptionService, TranscriptSegment } from "../../../services/transcription.service";
import { callRiskService } from "../../../services/callRisk.service";

test("Phase D: TranscriptionService generates chronological timestamped segments", async () => {
  const service = new TranscriptionService({ provider: "mock" });
  const dummyPcm = new Float32Array(16000); // 1s
  const callId = "call-transcript-001";

  const res1 = await service.transcribeSpeechChunk(callId, dummyPcm, 16000, 0, 1000, "remote");
  assert.equal(res1.success, true);
  assert.ok(res1.segment);
  assert.equal(res1.segment!.startTimeMs, 0);
  assert.equal(res1.segment!.endTimeMs, 1000);

  const res2 = await service.transcribeSpeechChunk(callId, dummyPcm, 16000, 1000, 2000, "remote");
  assert.equal(res2.success, true);
  assert.equal(res2.segment!.startTimeMs, 1000);
  assert.equal(res2.segment!.endTimeMs, 2000);

  const fullTranscript = service.getCallTranscript(callId);
  assert.equal(fullTranscript.length, 2);
  assert.equal(fullTranscript[0].startTimeMs, 0);
  assert.equal(fullTranscript[1].startTimeMs, 1000);
});

test("Phase D: TranscriptionService reports API key requirement honestly when missing", async () => {
  const service = new TranscriptionService({ provider: "whisper", apiKey: undefined });
  const status = service.getProviderStatus();
  assert.equal(status.provider, "whisper");
  assert.equal(status.hasApiKey, false);
  assert.equal(status.ready, false);

  const dummyPcm = new Float32Array(16000);
  const result = await service.transcribeSpeechChunk("call-002", dummyPcm, 16000, 0, 1000);
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("REQUIRES_EXTERNAL_API_KEY"));
});

test("Phase D: CallRiskService evaluates normal conversation as LOW RISK with 0 signals", () => {
  const segments: TranscriptSegment[] = [
    {
      callId: "normal-call",
      speakerDirection: "remote",
      text: "Hey! How are you doing today? Just wanted to catch up about the weekend hiking trip.",
      startTimeMs: 0,
      endTimeMs: 3000,
      createdAt: new Date().toISOString(),
    },
    {
      callId: "normal-call",
      speakerDirection: "local",
      text: "I'm doing great! The weather looks perfect for hiking on Saturday morning.",
      startTimeMs: 3200,
      endTimeMs: 6500,
      createdAt: new Date().toISOString(),
    },
  ];

  const assessment = callRiskService.analyzeTranscript("normal-call", segments);
  assert.equal(assessment.riskLevel, "LOW RISK");
  assert.equal(assessment.detectedSignals.length, 0);
  assert.equal(assessment.evidence.length, 0);
  assert.ok(assessment.riskScore < 20);
});

test("Phase D: CallRiskService detects single Money Request signal with evidence snippets", () => {
  const segments: TranscriptSegment[] = [
    {
      callId: "money-call",
      speakerDirection: "remote",
      text: "Could you please wire transfer funds to this account number when you get a chance?",
      startTimeMs: 5000,
      endTimeMs: 9000,
      createdAt: new Date().toISOString(),
    },
  ];

  const assessment = callRiskService.analyzeTranscript("money-call", segments);
  assert.ok(assessment.detectedSignals.includes("MONEY_REQUEST"));
  assert.ok(assessment.evidence.length > 0);
  assert.equal(assessment.evidence[0].signal, "MONEY_REQUEST");
  assert.ok(assessment.evidence[0].matchedPattern.toLowerCase().includes("wire"));
  assert.equal(assessment.evidence[0].startTimeMs, 5000);
});

test("Phase D: CallRiskService detects Urgency signal", () => {
  const segments: TranscriptSegment[] = [
    {
      callId: "urgent-call",
      speakerDirection: "remote",
      text: "You have to do this immediately right now before it's too late.",
      startTimeMs: 12000,
      endTimeMs: 15000,
      createdAt: new Date().toISOString(),
    },
  ];

  const assessment = callRiskService.analyzeTranscript("urgent-call", segments);
  assert.ok(assessment.detectedSignals.includes("URGENCY"));
  assert.equal(assessment.evidence[0].signal, "URGENCY");
});

test("Phase D: CallRiskService detects Credential Request with OTP harvesting warning", () => {
  const segments: TranscriptSegment[] = [
    {
      callId: "cred-call",
      speakerDirection: "remote",
      text: "I sent a one-time password to your phone. Read me the code to verify your identity.",
      startTimeMs: 2000,
      endTimeMs: 6000,
      createdAt: new Date().toISOString(),
    },
  ];

  const assessment = callRiskService.analyzeTranscript("cred-call", segments);
  assert.ok(assessment.detectedSignals.includes("CREDENTIAL_REQUEST"));
  assert.equal(assessment.evidence[0].signal, "CREDENTIAL_REQUEST");
  assert.ok(assessment.riskScore >= 35);
});

test("Phase D: Combined Impersonation + Pressure + Urgency + Money escalates to HIGH RISK", () => {
  const segments: TranscriptSegment[] = [
    {
      callId: "social-eng-call",
      speakerDirection: "remote",
      text: "This is officer Davis calling from the fraud department of your bank.",
      startTimeMs: 0,
      endTimeMs: 4000,
      createdAt: new Date().toISOString(),
    },
    {
      callId: "social-eng-call",
      speakerDirection: "remote",
      text: "An arrest warrant will be issued if you do not stay on the line and act immediately.",
      startTimeMs: 4500,
      endTimeMs: 8000,
      createdAt: new Date().toISOString(),
    },
    {
      callId: "social-eng-call",
      speakerDirection: "remote",
      text: "You must move your money to a temporary holding account right now to protect your assets.",
      startTimeMs: 8500,
      endTimeMs: 13000,
      createdAt: new Date().toISOString(),
    },
  ];

  const assessment = callRiskService.analyzeTranscript("social-eng-call", segments);
  assert.equal(assessment.riskLevel, "HIGH RISK");
  assert.ok(assessment.riskScore >= 75);
  assert.ok(assessment.detectedSignals.includes("IMPERSONATION_SIGNAL"));
  assert.ok(assessment.detectedSignals.includes("PRESSURE_TACTIC"));
  assert.ok(assessment.detectedSignals.includes("URGENCY"));
  assert.ok(assessment.detectedSignals.includes("MONEY_REQUEST"));
  assert.ok(assessment.disclaimer.includes("Risk assistance advisory"));
});
