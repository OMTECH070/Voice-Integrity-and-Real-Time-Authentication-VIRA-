import test from "node:test";
import assert from "node:assert/strict";
import {
  TranscriptionService,
  float32ToLinear16Pcm,
} from "../../../services/transcription.service";
import { callRiskService } from "../../../services/callRisk.service";

test("Phase D: Float32Array to linear16 PCM conversion produces valid 16-bit signed little-endian buffer", () => {
  const samples = new Float32Array([0.0, 1.0, -1.0, 0.5, -0.5, 2.0, -2.0]);
  const pcm = float32ToLinear16Pcm(samples);

  assert.equal(pcm.length, samples.length * 2);
  assert.equal(pcm.readInt16LE(0), 0); // 0.0 -> 0
  assert.equal(pcm.readInt16LE(2), 32767); // 1.0 -> 32767
  assert.equal(pcm.readInt16LE(4), -32768); // -1.0 -> -32768
  assert.ok(Math.abs(pcm.readInt16LE(6) - 16384) <= 1); // 0.5 -> ~16384
  assert.ok(Math.abs(pcm.readInt16LE(8) - -16384) <= 1); // -0.5 -> ~-16384
  assert.equal(pcm.readInt16LE(10), 32767); // 2.0 clamped -> 32767
  assert.equal(pcm.readInt16LE(12), -32768); // -2.0 clamped -> -32768
});

test("Phase D: Deepgram request construction and successful response parsing", async () => {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
    capturedBody = init?.body;

    const mockResponse = {
      metadata: { request_id: "test-req-123" },
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "I need you to wire the money immediately to avoid arrest.",
                confidence: 0.982,
                words: [],
              },
            ],
          },
        ],
      },
    };

    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const service = new TranscriptionService({
    provider: "deepgram",
    apiKey: "mock-test-key-001",
    model: "nova-2",
    fetchFn: mockFetch,
  });

  const dummyPcm = new Float32Array(48000); // 3 seconds at 16kHz
  const result = await service.transcribeSpeechChunk(
    "call-deepgram-001",
    dummyPcm,
    16000,
    0,
    3000,
    "remote",
    "user-remote-001"
  );

  assert.equal(result.success, true);
  assert.ok(result.segment);
  assert.equal(
    result.segment!.text,
    "I need you to wire the money immediately to avoid arrest."
  );
  assert.equal(result.segment!.confidence, 0.982);

  // Validate Deepgram URL & Parameters
  assert.ok(capturedUrl.startsWith("https://api.deepgram.com/v1/listen"));
  assert.ok(capturedUrl.includes("model=nova-2"));
  assert.ok(capturedUrl.includes("smart_format=true"));
  assert.ok(capturedUrl.includes("encoding=linear16"));
  assert.ok(capturedUrl.includes("sample_rate=16000"));

  // Validate Headers
  assert.equal(capturedHeaders["Authorization"], "Token mock-test-key-001");
  assert.equal(capturedHeaders["Content-Type"], "audio/raw");
  assert.ok(capturedBody instanceof Buffer || capturedBody instanceof Uint8Array);
  assert.equal((capturedBody as Buffer).length, 48000 * 2);
});

test("Phase D: Deepgram empty speech handling returns empty transcript without fabricating text", async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        results: {
          channels: [{ alternatives: [{ transcript: "", confidence: 0.0 }] }],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const service = new TranscriptionService({
    provider: "deepgram",
    apiKey: "mock-key",
    fetchFn: mockFetch,
  });

  const dummyPcm = new Float32Array(16000);
  const result = await service.transcribeSpeechChunk("call-empty", dummyPcm, 16000, 0, 1000);

  assert.equal(result.success, true);
  assert.ok(result.segment);
  assert.equal(result.segment!.text, "");
  assert.notEqual(result.segment!.text, "[External API transcription]");
});

test("Phase D: Missing DEEPGRAM_API_KEY returns typed error without throwing", async () => {
  const service = new TranscriptionService({
    provider: "deepgram",
    apiKey: undefined,
  });

  const status = service.getProviderStatus();
  assert.equal(status.hasApiKey, false);
  assert.equal(status.ready, false);

  const result = await service.transcribeSpeechChunk(
    "call-nokey",
    new Float32Array(16000),
    16000,
    0,
    1000
  );
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("REQUIRES_EXTERNAL_API_KEY"));
});

test("Phase D: Deepgram HTTP error returns typed error without crashing or inventing text", async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ err_code: "INVALID_AUTH", err_msg: "Invalid credentials" }), {
      status: 401,
      statusText: "Unauthorized",
    });
  };

  const service = new TranscriptionService({
    provider: "deepgram",
    apiKey: "bad-key",
    fetchFn: mockFetch,
  });

  const result = await service.transcribeSpeechChunk(
    "call-err",
    new Float32Array(16000),
    16000,
    0,
    1000
  );
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("Deepgram API HTTP 401"));
});

test("Phase D: Real Deepgram transcript flows directly into Risk Engine and triggers threat assessment", async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript:
                    "This is officer Davis calling from the fraud department of your bank. We sent an OTP one-time passcode to your phone. Read me the code right now or we freeze your accounts.",
                  confidence: 0.99,
                },
              ],
            },
          ],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const service = new TranscriptionService({
    provider: "deepgram",
    apiKey: "mock-key-threat",
    fetchFn: mockFetch,
  });

  const callId = "call-threat-flow-001";
  const dummyPcm = new Float32Array(48000);

  const res = await service.transcribeSpeechChunk(callId, dummyPcm, 16000, 0, 3000, "remote");
  assert.equal(res.success, true);
  assert.ok(res.segment);

  // Evaluate transcripts in Call Risk Engine
  const callTranscripts = service.getCallTranscript(callId);
  const riskAssessment = callRiskService.analyzeTranscript(callId, callTranscripts);

  assert.equal(riskAssessment.riskLevel, "HIGH RISK");
  assert.ok(riskAssessment.riskScore >= 70);
  assert.ok(riskAssessment.detectedSignals.includes("CREDENTIAL_REQUEST"));
  assert.ok(riskAssessment.detectedSignals.includes("IMPERSONATION_SIGNAL"));
  assert.ok(riskAssessment.detectedSignals.includes("URGENCY"));
  assert.ok(riskAssessment.evidence.some((e) => e.snippet.toLowerCase().includes("otp")));
});

test("Phase D: Placeholder [External API transcription] is NEVER returned under any provider or condition", async () => {
  const serviceMock = new TranscriptionService({ provider: "mock" });
  const resMock = await serviceMock.transcribeSpeechChunk(
    "call-check-mock",
    new Float32Array(16000),
    16000,
    0,
    1000
  );
  if (resMock.segment) {
    assert.notEqual(resMock.segment.text, "[External API transcription]");
  }

  const serviceDeepgramEmpty = new TranscriptionService({
    provider: "deepgram",
    apiKey: "test",
    fetchFn: async () =>
      new Response(JSON.stringify({ results: { channels: [] } }), { status: 200 }),
  });
  const resDeepgram = await serviceDeepgramEmpty.transcribeSpeechChunk(
    "call-check-dg",
    new Float32Array(16000),
    16000,
    0,
    1000
  );
  if (resDeepgram.segment) {
    assert.notEqual(resDeepgram.segment.text, "[External API transcription]");
  }
});
