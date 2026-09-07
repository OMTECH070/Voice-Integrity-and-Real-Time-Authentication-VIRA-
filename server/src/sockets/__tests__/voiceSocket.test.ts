/**
 * Tests for voice.socket.ts payload validation and session cleanup.
 *
 * Run with:  npx tsx server/src/sockets/__tests__/voiceSocket.test.ts
 */
import {
  cleanupVoiceAnalysisSession,
  validateAndTrackChunk,
  VoiceChunkValidationParams,
} from "../voice.socket";
import { callService } from "../../services/call.service";

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

console.log("voice.socket: session lifecycle cleanup");
{
  // Test cleanup does not throw on non-existent or existing sessions
  assert(
    (() => {
      cleanupVoiceAnalysisSession("non-existent-call-id");
      return true;
    })(),
    "cleanup on non-existent callId executes cleanly without error"
  );

  const session = callService.createSession("user_1", "user_2");
  assert(
    (() => {
      cleanupVoiceAnalysisSession(session.callId);
      callService.endSession(session.callId);
      return true;
    })(),
    "cleanup after active call end runs cleanly"
  );
}

console.log("\nvoice.socket: audio stream timestamp & sequence validation");
{
  const callA = "call_test_timestamp_001";
  cleanupVoiceAnalysisSession(callA);

  const defaultChunk: VoiceChunkValidationParams = {
    callId: callA,
    userId: "user_alice",
    speakerDirection: "remote",
    sequenceNumber: 0,
    timestampMs: 2240, // Genuine initial VAD buffering delay
    durationMs: 3000,
    sampleRate: 16000,
    byteLength: 48000 * 4, // 48000 Float32 samples
  };

  // 1. First chunk with timestampMs = 2240 and sequence = 0 MUST BE ACCEPTED
  const res0 = validateAndTrackChunk({ ...defaultChunk });
  assert(res0.valid === true, "1. First chunk with timestampMs=2240, sequence=0 is ACCEPTED");

  // 2. Subsequent chunk with sequence = 1 and timestampMs = 3740 (stride 1.5s) MUST BE ACCEPTED
  const res1 = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 1,
    timestampMs: 3740,
  });
  assert(res1.valid === true, "2. Subsequent chunk with sequence=1, timestampMs=3740 is ACCEPTED");

  // 3. Duplicate sequence number MUST BE REJECTED
  const resDupSeq = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 1,
    timestampMs: 5240,
  });
  assert(resDupSeq.valid === false, "3. Duplicate sequenceNumber (1) is REJECTED");

  // 4. Decreasing / out-of-order sequence number MUST BE REJECTED
  const resOldSeq = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 0,
    timestampMs: 5240,
  });
  assert(resOldSeq.valid === false, "4. Out-of-order sequenceNumber (0 after 1) is REJECTED");

  // 5. Decreasing / backwards timestampMs with higher sequence MUST BE REJECTED
  const resBackwardsTime = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 2,
    timestampMs: 2000, // lower than last 3740
  });
  assert(resBackwardsTime.valid === false, "5. Backwards timestampMs (2000 after 3740) is REJECTED");

  // 6. Next legitimate increasing chunk (sequence=2, timestampMs=5240) MUST BE ACCEPTED
  const res2 = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 2,
    timestampMs: 5240,
  });
  assert(res2.valid === true, "6. Next legitimate chunk (sequence=2, timestampMs=5240) is ACCEPTED");

  // 7. Wildly future timestamp (> 24h) MUST BE REJECTED
  const resFuture = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 3,
    timestampMs: 9999999999, // > 24 hours
  });
  assert(resFuture.valid === false, "7. Wildly future timestampMs (> 24h) is REJECTED");

  // 8. Negative timestamp MUST BE REJECTED
  const resNegative = validateAndTrackChunk({
    ...defaultChunk,
    sequenceNumber: 3,
    timestampMs: -100,
  });
  assert(resNegative.valid === false, "8. Negative timestampMs is REJECTED");

  // 9. Independent local direction starts its own sequence/timestamp tracker without collision
  const resLocal0 = validateAndTrackChunk({
    ...defaultChunk,
    speakerDirection: "local",
    sequenceNumber: 0,
    timestampMs: 1500,
  });
  assert(resLocal0.valid === true, "9. Local speaker direction sequence 0 is ACCEPTED independently");

  // 10. Cross-call isolation: Call B with sequence 0 and timestampMs 2240 is unaffected by Call A
  const callB = "call_test_timestamp_002";
  cleanupVoiceAnalysisSession(callB);
  const resCallB = validateAndTrackChunk({
    ...defaultChunk,
    callId: callB,
    sequenceNumber: 0,
    timestampMs: 2240,
  });
  assert(resCallB.valid === true, "10. Cross-call isolation: Call B starts cleanly at sequence 0, timestamp 2240");

  // 11. Cleanup clears Call A and allows reset
  cleanupVoiceAnalysisSession(callA);
  const resReset = validateAndTrackChunk({
    ...defaultChunk,
    callId: callA,
    sequenceNumber: 0,
    timestampMs: 1000,
  });
  assert(resReset.valid === true, "11. After cleanup, Call A can restart at sequence 0 cleanly");

  cleanupVoiceAnalysisSession(callA);
  cleanupVoiceAnalysisSession(callB);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
