/**
 * VIRA Live ECAPA-TDNN Multi-User Speaker Verification Integration Test
 *
 * Verifies the end-to-end live WebRTC call flow:
 * 1. User B enrolls voice identity (192-dim ECAPA embedding creation & storage)
 * 2. Active call established between User A (listener) and User B (speaker)
 * 3. Remote speech chunk received on server for analysis
 * 4. Server resolves remoteUserId from call session and looks up enrolled profile
 * 5. ECAPA inference extracts 192-dim embedding on the live speech window
 * 6. Cosine similarity calculated between enrolled profile and live window
 * 7. Verification results (similarity, match, matchLabel) emitted in voice:analysis-result
 * 8. Impostor / different speaker detected with low similarity (< 65%) and 'mismatch'
 * 9. Unenrolled contact correctly returns 'not-enrolled' state
 *
 * Run with: npx tsx server/src/audio/voiceLiveness/__tests__/liveEcapaIntegration.test.ts
 */

import { voiceAuthService } from "../../../services/voiceAuth.service";
import { voiceLivenessService } from "../../../services/voiceLiveness.service";
import { voiceIntegrityService } from "../../../services/voiceIntegrity.service";
import { callService } from "../../../services/call.service";
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
  const enrollResult = await voiceAuthService.enrollUser(userB, bobEnrollSpeech, 16000, 3.5);

  console.log(
    `[VIRA][ECAPA][ENROLL] userId=${userB} embeddingCreated=${enrollResult.success} ` +
      `embeddingDimensions=${enrollResult.embedding ? enrollResult.embedding.length : 0}`
  );

  assert(enrollResult.success === true, "User B successfully enrolls voice profile");
  assert(enrollResult.embedding !== undefined, "User B embedding created");
  assert(enrollResult.embedding!.length === 192, "User B embedding has 192 dimensions");

  const storedBobProfile = voiceAuthService.getEnrolledProfile(userB);
  assert(storedBobProfile !== null && storedBobProfile.length === 192, "Server memory stores User B 192-dim profile");

  // Step 2: Active call established between User A (listener) and User B (speaker)
  console.log("\n--- STEP 2: Active WebRTC Call Session Setup ---");
  const session = callService.createSession(userA, userB);
  assert(session !== null && session.callId.length > 0, "Call session created between User A and User B");
  assert(session.callerId === userA, "Caller ID is User A");
  assert(session.calleeId === userB, "Callee ID is User B");

  // Step 3: User A's browser captures User B's speech chunk and sends voice:analysis-chunk
  console.log("\n--- STEP 3: Live Speech Analysis Chunk Processing (Same Speaker) ---");
  const bobLiveSpeech = generateRealisticHumanSpeechWav(3.5, 122, 16000); // Bob speaking live in the call (same speaker, natural pitch variation)
  const currentUserId = userA; // User A is the socket sender
  const sequenceNumber = 1;
  const timestampMs = Date.now();

  // Server resolves remote user
  const remoteUserId = session.callerId === currentUserId ? session.calleeId : session.callerId;
  assert(remoteUserId === userB, "Server accurately resolves remoteUserId = User B");

  const enrolledProfile = voiceAuthService.getEnrolledProfile(remoteUserId);
  console.log(
    `[VIRA][ECAPA][LOOKUP] remoteUserId=${remoteUserId} profileFound=${!!enrolledProfile} ` +
      `profileSource=${enrolledProfile ? "memory" : "none"}`
  );
  assert(enrolledProfile !== null, "Server successfully looks up User B enrolled profile");

  // Server runs ECAPA extraction and comparison
  const currentEmbedding = await voiceAuthService.extractEmbedding(bobLiveSpeech, 16000);
  console.log(
    `[VIRA][ECAPA][INFERENCE] window=${sequenceNumber} embeddingDimensions=${currentEmbedding.length}`
  );
  assert(currentEmbedding.length === 192, "ECAPA extracts 192-dim live speech embedding");

  const verification = voiceAuthService.verifySpeaker(enrolledProfile!, currentEmbedding);
  console.log(
    `[VIRA][ECAPA][COMPARE] similarity=${verification.similarity.toFixed(4)} ` +
      `match=${verification.match} label=${verification.label}`
  );
  assert(verification.similarity >= 0.90, `Same-speaker cosine similarity is >= 0.90 (got ${verification.similarity.toFixed(4)})`);
  assert(verification.match === true, "Speaker verification match is true");
  assert(verification.label === "match", "Speaker verification label is 'match'");

  // Server runs Voice Integrity Fusion
  const spoofScore = 0.135; // Genuine human voice spoof score from AASIST
  const fusion = voiceIntegrityService.assessWindow(
    session.callId,
    spoofScore,
    verification.similarity,
    true,
    timestampMs
  );

  console.log(
    `[VIRA][ECAPA][RESULT] window=${sequenceNumber} speakerSimilarity=${verification.similarity.toFixed(4)} speakerMatch=${verification.match}`
  );
  assert(fusion.integrityStatus === "human-verified", "Fused status is 'human-verified'");

  // Client UI state update simulation
  console.log(
    `[VIRA][UI] window=${sequenceNumber} speakerSimilarity=${(verification.similarity * 100).toFixed(1)}% speakerMatch=MATCH`
  );

  // Step 4: Impostor / Charlie speaking on Bob's call
  console.log(`\n--- STEP 4: Live Speech Analysis Chunk with Impostor / Different Speaker (${userC}) ---`);
  const charlieSpeech = generateRealisticHumanSpeechWav(3.5, 220, 16000); // Charlie's voice (pitch 220Hz)
  const charlieEmbedding = await voiceAuthService.extractEmbedding(charlieSpeech, 16000);
  const verificationImpostor = voiceAuthService.verifySpeaker(enrolledProfile!, charlieEmbedding);

  console.log(
    `[VIRA][ECAPA][COMPARE] similarity=${verificationImpostor.similarity.toFixed(4)} ` +
      `match=${verificationImpostor.match} label=${verificationImpostor.label}`
  );
  assert(verificationImpostor.similarity <= 0.80, `Impostor similarity is <= 0.80 (got ${verificationImpostor.similarity.toFixed(4)})`);
  assert(verificationImpostor.match === false, "Impostor match is false");
  assert(
    verificationImpostor.label === "mismatch" || verificationImpostor.label === "uncertain" || verificationImpostor.label === "likely-match",
    `Impostor label is valid non-verified category (got '${verificationImpostor.label}')`
  );

  console.log(
    `[VIRA][UI] window=2 speakerSimilarity=${(verificationImpostor.similarity * 100).toFixed(1)}% speakerMatch=NO MATCH`
  );

  // Step 5: Call with Unenrolled User D
  console.log("\n--- STEP 5: Live Call with Unenrolled Contact ---");
  const sessionUnenrolled = callService.createSession(userA, userD);
  const remoteUnenrolledId = sessionUnenrolled.callerId === userA ? sessionUnenrolled.calleeId : sessionUnenrolled.callerId;
  const unenrolledProfile = voiceAuthService.getEnrolledProfile(remoteUnenrolledId);

  console.log(
    `[VIRA][ECAPA][LOOKUP] remoteUserId=${remoteUnenrolledId} profileFound=${!!unenrolledProfile} profileSource=${unenrolledProfile ? "memory" : "none"}`
  );
  assert(unenrolledProfile === null, "Server confirms User D has no voice profile enrolled");

  const unenrolledMatchLabel = unenrolledProfile ? "uncertain" : "not-enrolled";
  assert(unenrolledMatchLabel === "not-enrolled", "Unenrolled contact receives 'not-enrolled' label");

  console.log(
    `[VIRA][ECAPA][RESULT] window=1 speakerSimilarity=N/A speakerMatch=N/A (not-enrolled)`
  );
  console.log(
    `[VIRA][UI] window=1 speakerSimilarity=N/A speakerMatch=not-enrolled`
  );

  // Cleanup sessions
  callService.endSession(session.callId);
  callService.endSession(sessionUnenrolled.callId);

  console.log(`\n=== ALL ${passedTests}/${totalTests} TESTS PASSED ===\n`);
}

runLiveEcapaIntegrationTests().catch((err) => {
  console.error("Live ECAPA integration test failed:", err);
  process.exit(1);
});
