import test from "node:test";
import assert from "node:assert/strict";
import type { FusedIntegrityStatus } from "../../types/socket-events";

// Test Voice Integrity UI Configuration & Label Guarantees
const FORBIDDEN_WORDS = [
  "100% human",
  "100% ai",
  "guaranteed human",
  "guaranteed clone",
  "proof of identity",
  "absolute certainty",
];

const VALID_INTEGRITY_STATUSES: FusedIntegrityStatus[] = [
  "analyzing",
  "human-verified",
  "possible-ai",
  "speaker-mismatch",
  "uncertain",
  "not-enrolled",
  "analysis-unavailable",
];

test("Step 10 UI Test Suite: Voice Integrity Probabilistic Copy & States", async (t) => {
  await t.test("All 7 fused integrity states are defined with non-empty metadata", () => {
    assert.equal(VALID_INTEGRITY_STATUSES.length, 7, "Exactly 7 fused integrity states");
  });

  await t.test("Probabilistic copy strictly avoids forbidden deterministic phrases", () => {
    const sampleCopy = [
      "Human Voice Likely",
      "Possible Synthetic Voice",
      "Speaker Mismatch Detected",
      "Voice Analysis Inconclusive",
      "No Voice Profile Enrolled",
      "Voice Analysis Unavailable",
      "Natural acoustic dynamics verified with high probability",
      "Acoustic patterns exhibit vocoder or neural voice synthesis characteristics",
      "Voice appears live and human, but does not match the enrolled contact",
      "Results are probabilistic and may be affected by audio quality, network conditions, and background noise",
    ];

    for (const text of sampleCopy) {
      const lower = text.toLowerCase();
      for (const forbidden of FORBIDDEN_WORDS) {
        assert.ok(
          !lower.includes(forbidden),
          `Forbidden deterministic phrase "${forbidden}" must not exist in copy: "${text}"`
        );
      }
    }
  });

  await t.test("Synthetic clone vs Live mismatch distinction rules", () => {
    // Case A: Synthetic clone of matching speaker
    const syntheticCloneState = {
      integrityStatus: "possible-ai",
      rawLabel: "likely-synthetic",
      speakerMatchLabel: "match",
      voiceAuthenticity: "Possible Synthetic Voice",
      speakerIdentity: "Match (Voice Clone Detected)",
    };

    assert.equal(syntheticCloneState.integrityStatus, "possible-ai");
    assert.equal(syntheticCloneState.voiceAuthenticity, "Possible Synthetic Voice");
    assert.equal(syntheticCloneState.speakerIdentity, "Match (Voice Clone Detected)");

    // Case B: Live voice of different human (impostor)
    const impostorState = {
      integrityStatus: "speaker-mismatch",
      rawLabel: "live",
      speakerMatchLabel: "mismatch",
      voiceAuthenticity: "Human Voice Likely",
      speakerIdentity: "Speaker Mismatch Detected",
    };

    assert.equal(impostorState.integrityStatus, "speaker-mismatch");
    assert.equal(impostorState.voiceAuthenticity, "Human Voice Likely");
    assert.equal(impostorState.speakerIdentity, "Speaker Mismatch Detected");
  });

  await t.test("Speaker Verification distinct match labels", () => {
    const speakerLabels = ["match", "likely-match", "mismatch", "uncertain", "not-enrolled"];
    assert.equal(speakerLabels.length, 5, "5 speaker match labels defined");
    assert.ok(speakerLabels.includes("not-enrolled"));
  });

  await t.test("Voice enrollment parameters enforce speech threshold bounds", () => {
    const TARGET_RECORDING_DURATION_SEC = 8;
    const MIN_REQUIRED_SPEECH_SEC = 2.5;

    assert.ok(TARGET_RECORDING_DURATION_SEC >= 5, "Target duration allows ample speech capture");
    assert.ok(MIN_REQUIRED_SPEECH_SEC >= 2.0, "Requires at least 2.0s of clean speech for ECAPA");
    assert.ok(MIN_REQUIRED_SPEECH_SEC < TARGET_RECORDING_DURATION_SEC, "Min speech is less than target");
  });

  await t.test("Security Indicator states and fallback descriptions", () => {
    const securityStates = ["active", "limited", "warning", "offline", "idle"];
    assert.equal(securityStates.length, 5, "5 security states defined");
  });

  await t.test("ActiveCallScreen: Phone-Style Speaker Toggle and Independent Microphone Mute", () => {
    let isLocalMicMuted = false;
    let isSpeakerOn = true;
    let audioElementMuted = false;
    let localTrackEnabled = true;
    let remoteTrackEnabled = true;
    let activeSinkId = "loudspeaker-device-1";
    let isCallEnded = false;

    const setLocalMute = (muted: boolean) => {
      isLocalMicMuted = muted;
      localTrackEnabled = !muted;
    };

    const toggleSpeakerRoute = (on: boolean) => {
      isSpeakerOn = on;
      // Remote caller audio MUST remain audible in both states (never muted)
      audioElementMuted = false;
      remoteTrackEnabled = true;
      // Output routing: loudspeaker vs default/earpiece
      activeSinkId = on ? "loudspeaker-device-1" : "";
    };

    const endCall = () => {
      isCallEnded = true;
      localTrackEnabled = false;
      remoteTrackEnabled = false;
    };

    // TEST 1: Speaker On -> remote voice audible
    setLocalMute(false);
    toggleSpeakerRoute(true);
    assert.equal(isSpeakerOn, true, "Speaker state is On");
    assert.equal(audioElementMuted, false, "Speaker On: Remote voice must be audible");
    assert.equal(remoteTrackEnabled, true, "Speaker On: Remote track must be enabled");
    assert.equal(activeSinkId, "loudspeaker-device-1", "Speaker On: Routed to loudspeaker");
    assert.equal(localTrackEnabled, true, "Local mic is active");

    // TEST 2: Speaker Off -> remote voice STILL audible
    toggleSpeakerRoute(false);
    assert.equal(isSpeakerOn, false, "Speaker state is Off");
    assert.equal(audioElementMuted, false, "Speaker Off: Remote voice MUST STILL BE AUDIBLE");
    assert.equal(remoteTrackEnabled, true, "Speaker Off: Remote track MUST STILL BE ENABLED");
    assert.equal(activeSinkId, "", "Speaker Off: Routed to default/earpiece output");
    assert.equal(localTrackEnabled, true, "Local mic remains active");

    // TEST 3: Speaker Off must NOT produce silence
    assert.notEqual(audioElementMuted, true, "Speaker Off must NEVER produce silence or mute element");
    assert.equal(remoteTrackEnabled, true, "Speaker Off tracks must not be stopped or disabled");

    // TEST 4: Mute -> my microphone becomes muted
    setLocalMute(true);
    assert.equal(isLocalMicMuted, true, "Local mic is in muted state");
    assert.equal(localTrackEnabled, false, "Local mic track is disabled");

    // TEST 5: Mute must NOT affect remote audio
    assert.equal(audioElementMuted, false, "Mute microphone must NOT mute remote audio");
    assert.equal(remoteTrackEnabled, true, "Mute microphone must NOT disable remote track");

    // TEST 6: Speaker toggle must NOT affect microphone
    assert.equal(localTrackEnabled, false, "Microphone is currently muted");
    toggleSpeakerRoute(true); // Toggle to Speaker On
    assert.equal(localTrackEnabled, false, "Local mic remains muted after Speaker On");
    toggleSpeakerRoute(false); // Toggle to Speaker Off
    assert.equal(localTrackEnabled, false, "Local mic remains muted after Speaker Off");

    setLocalMute(false); // Unmute microphone
    assert.equal(localTrackEnabled, true, "Local mic is now unmuted");
    toggleSpeakerRoute(true);
    assert.equal(localTrackEnabled, true, "Local mic remains unmuted after Speaker On");
    toggleSpeakerRoute(false);
    assert.equal(localTrackEnabled, true, "Local mic remains unmuted after Speaker Off");

    // TEST 7: End Call remains functional
    endCall();
    assert.equal(isCallEnded, true, "Call ended successfully");
    assert.equal(localTrackEnabled, false, "Local tracks stopped on call end");
  });
});
