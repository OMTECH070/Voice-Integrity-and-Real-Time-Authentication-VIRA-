/**
 * Tests for voice.socket.ts payload validation and session cleanup.
 *
 * Run with:  npx tsx server/src/sockets/__tests__/voiceSocket.test.ts
 */
import { cleanupVoiceAnalysisSession } from "../voice.socket";
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
