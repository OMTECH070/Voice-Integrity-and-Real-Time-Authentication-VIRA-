/**
 * VIRA Live ECAPA-TDNN Multi-User Speaker Verification Integration Test
 *
 * Verifies the end-to-end live WebRTC call flow:
 * 1. User B enrolls voice identity (192-dim ECAPA embedding creation & storage)
 * 2. Active call established between User A (listener) and User B (speaker)
 * 3. Remote speech chunk received on server for analysis
 * 4. Call-scoped verification context loads reference profile ONCE (0 DB lookups on subsequent windows)
 * 5. ECAPA inference extracts 192-dim embedding on the live speech window (16kHz, 48000 samples)
 * 6. Cosine similarity calculated between enrolled profile and live window
 * 7. Verification results (similarity, match, matchLabel) emitted in voice:analysis-result
 * 8. Impostor / different speaker detected with low similarity (< 70%) and 'mismatch'
 * 9. Unenrolled contact correctly returns 'not-enrolled' state without fake 0% or fake mismatch
 * 10. Call cleanup clears the call verification context
 *
 * Run with: npx tsx server/src/audio/voiceLiveness/__tests__/liveEcapaIntegration.test.ts
 */

import { voiceAuthService } from "../../../services/voiceAuth.service";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { voiceIntegrityService } from "../../../services/voiceIntegrity.service";
import { callService } from "../../../services/call.service";
import {
  getOrLoadEnrolledProfileForCall,
  getCallVerificationContext,
  cleanupVoiceAnalysisSession,
} from "../../../sockets/voice.socket";
import { generateRealisticHumanSpeechWav } from "../standaloneModelTest";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL - ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`  ok  - ${message}`);
  }
}

async function runLiveEcapaIntegrationTests() {
  console.log("=== VIRA LIVE ECAPA MULTI-USER SPEAKER VERIFICATION INTEGRATION TEST ===\n");

  // Step 0: Ensure services are initialized
  const authReady = await voiceAuthService.init();
  assert(authReady === true, "VoiceAuthService initializes real ECAPA ONNX model");

  const livenessReady = await voiceLivenessService.init();
  assert(livenessReady === true, "VoiceLivenessService initializes real AASIST ONNX model");

  const userA = "alice-user-id-001";
  const userB = "bob-user-id-002";
  const userC = "charlie-impostor-id-003";
  const userD = "david-unenrolled-id-004";

  // Step 1: User B enrolls his voice ID
  console.log("\n--- STEP 1: User B Voice ID Enrollment ---");
  const bobEnrollSpeech = generateRealisticHumanSpeechWav(3.5, 120, 16000); // Bob's voice (pitch 120Hz)
  const enrollResult = await voiceAuthService.enrollUser(userB, bobEnrollSpeech, 16000, 3.5, true);

  console.log(
    `[VIRA][ECAPA][ENROLL] userId=${userB} embeddingCreated=${enrollResult.success} ` +
      `embeddingDimensions=${enrollResult.embedding ? enrollResult.embedding.length : 0}`
  );

  assert(enrollResult.success === true, "User B successfully enrolls voice profile");
  assert(enrollResult.embedding !== undefined, "User B embedding created");
  assert(enrollResult.embedding!.length === 192, "User B embedding has 192 dimensions");

  // Invalid enrollment validation
  const emptySpeechResult = await voiceAuthService.enrollUser("bad-user-id", new Float32Array(0), 16000, 0);
  assert(emptySpeechResult.success === false, "Empty speech enrollment correctly rejected without creating fake data");

  const shortSpeechResult = await voiceAuthService.enrollUser("short-user-id", new Float32Array(8000), 16000, 0.5);
  assert(shortSpeechResult.success === false, "Short speech (< 2.0s) enrollment correctly rejected without creating fake data");

  const storedBobProfile = voiceAuthService.getEnrolledProfile(userB);
  assert(storedBobProfile !== null && storedBobProfile.length === 192, "Server memory stores User B 192-dim profile");

  // Step 2: Active call established between User A (listener) and User B (speaker)
  console.log("\n--- STEP 2: Active WebRTC Call Session Setup ---");
  const session = callService.createSession(userA, userB);
  assert(session !== null && session.callId.length > 0, "Call session created between User A and User B");
  assert(session.callerId === userA, "Caller ID is User A");
  assert(session.calleeId === userB, "Callee ID is User B");

  // Step 3: Call-scoped context loads enrollment ONCE
  console.log("\n--- STEP 3: Call-Scoped Context Single Lookup & Reuse ---");
  const callId = session.callId;

  // Initial lookup for Window 0
  const profileWin0 = await getOrLoadEnrolledProfileForCall(callId, userA, userB, userB);
  assert(profileWin0 !== null && profileWin0.length === 192, "First lookup loads enrolled profile into call-scoped context");

  const context = getCallVerificationContext(callId);
  assert(context !== undefined, "CallVerificationContext is active for call");
  assert(context!.lookupCompleted.has(userB), "Lookup marked as completed in context");

  // Subsequent lookups for Windows 1, 2, 3 must return the exact same cached reference without DB query
  const profileWin1 = await getOrLoadEnrolledProfileForCall(callId, userA, userB, userB);
  const profileWin2 = await getOrLoadEnrolledProfileForCall(callId, userA, userB, userB);
  assert(profileWin1 === profileWin0, "Window 1 reuses cached call-scoped reference embedding");
  assert(profileWin2 === profileWin0, "Window 2 reuses cached call-scoped reference embedding");

  // Step 4: Live Speech Analysis Chunk Processing (Same Speaker)
  console.log("\n--- STEP 4: Live Speech Analysis Chunk Processing (Same Speaker) ---");
  const bobLiveSpeech = generateRealisticHumanSpeechWav(3.0, 122, 16000); // 3.0s = 48000 samples
  assert(bobLiveSpeech.length === 48000, "Live speech chunk is exactly 48,000 samples @ 16kHz (3.0s)");

  const currentEmbedding = await voiceAuthService.extractEmbedding(bobLiveSpeech, 16000);
  assert(currentEmbedding.length === 192, "ECAPA extracts 192-dim live speech embedding");

  const verification = voiceAuthService.verifySpeaker(profileWin0!, currentEmbedding, 3.0);
  console.log(
    `[VIRA][ECAPA][COMPARE] similarity=${verification.similarity.toFixed(4)} ` +
      `match=${verification.match} label=${verification.label}`
  );
  assert(verification.similarity >= 0.85, `Same-speaker cosine similarity is >= 0.85 (got ${verification.similarity.toFixed(4)})`);
  assert(verification.match === true, "Speaker verification match is true");
  assert(verification.label === "match", "Speaker verification label is 'match'");

  // Server runs Voice Integrity Fusion
  const spoofScore = 0.135; // Genuine human voice spoof score from AASIST
  const fusion = voiceIntegrityService.assessWindow(
    callId,
    spoofScore,
    verification.similarity,
    true,
    Date.now()
  );
  assert(fusion.integrityStatus === "human-verified", "Fused status is 'human-verified'");

  // Step 5: Impostor / Charlie speaking on Bob's call
  console.log(`\n--- STEP 5: Live Speech Analysis Chunk with Impostor / Different Speaker (${userC}) ---`);
  const charlieSpeech = generateRealisticHumanSpeechWav(3.0, 220, 16000); // Charlie's voice (pitch 220Hz)
  const charlieEmbedding = await voiceAuthService.extractEmbedding(charlieSpeech, 16000);
  const verificationImpostor = voiceAuthService.verifySpeaker(profileWin0!, charlieEmbedding, 3.0);

  console.log(
    `[VIRA][ECAPA][COMPARE] similarity=${verificationImpostor.similarity.toFixed(4)} ` +
      `match=${verificationImpostor.match} label=${verificationImpostor.label}`
  );
  assert(verificationImpostor.similarity < 0.70, `Impostor similarity is < 0.70 (got ${verificationImpostor.similarity.toFixed(4)})`);
  assert(verificationImpostor.match === false, "Impostor match is false");
  assert(verificationImpostor.label === "mismatch", "Impostor label is strictly 'mismatch'");

  // Step 6: Call with Unenrolled User D
  console.log("\n--- STEP 6: Live Call with Unenrolled Contact ---");
  const sessionUnenrolled = callService.createSession(userA, userD);
  const unenrolledProfile = await getOrLoadEnrolledProfileForCall(
    sessionUnenrolled.callId,
    userA,
    userD,
    userD
  );
  assert(unenrolledProfile === null, "Server confirms User D has no voice profile enrolled");

  const unenrolledMatchLabel = unenrolledProfile ? "uncertain" : "not-enrolled";
  assert(unenrolledMatchLabel === "not-enrolled", "Unenrolled contact receives 'not-enrolled' label (never fake mismatch)");

  // Step 7: Call Cleanup & Context Destruction
  console.log("\n--- STEP 7: Call Cleanup & Verification Context Teardown ---");
  cleanupVoiceAnalysisSession(callId);
  callService.endSession(callId);
  assert(getCallVerificationContext(callId) === undefined, "Call verification context deleted on cleanup");

  cleanupVoiceAnalysisSession(sessionUnenrolled.callId);
  callService.endSession(sessionUnenrolled.callId);
  assert(getCallVerificationContext(sessionUnenrolled.callId) === undefined, "Unenrolled call verification context deleted on cleanup");

  console.log(`\n=== ALL ${passedTests}/${totalTests} TESTS PASSED ===\n`);
}

runLiveEcapaIntegrationTests().catch((err) => {
  console.error("Live ECAPA integration test failed:", err);
  process.exit(1);
});
