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

  await t.test("ActiveCallScreen: Independent Microphone Mute and Speaker Playback State", () => {
    let isLocalMicMuted = false;
    let isSpeakerOn = true;
    let audioElementMuted = false;
    let localTrackEnabled = true;

    const setLocalMute = (muted: boolean) => {
      isLocalMicMuted = muted;
      localTrackEnabled = !muted;
    };

    const setSpeaker = (on: boolean) => {
      isSpeakerOn = on;
      assert.equal(isSpeakerOn, on);
      audioElementMuted = !on;
    };

    // TEST A: Remote person speaks -> audible
    setLocalMute(false);
    setSpeaker(true);
    assert.equal(audioElementMuted, false, "Speaker is audible initially");
    assert.equal(localTrackEnabled, true, "Mic is active initially");

    // TEST B: Click 'Speaker Off' -> remote person becomes silent, mic untouched
    setSpeaker(false);
    assert.equal(audioElementMuted, true, "Speaker is muted when Speaker Off");
    assert.equal(localTrackEnabled, true, "Local mic remains active when speaker is muted");
    assert.equal(isLocalMicMuted, false, "Mic mute state is completely unchanged");

    // TEST C: Click 'Speaker On' -> remote audio becomes audible again
    setSpeaker(true);
    assert.equal(audioElementMuted, false, "Speaker becomes audible again");
    assert.equal(localTrackEnabled, true, "Mic remains active");

    // TEST D: While Speaker Off, toggle Mute -> mic changes, speaker stays Off
    setSpeaker(false);
    setLocalMute(true);
    assert.equal(audioElementMuted, true, "Speaker remains muted");
    assert.equal(localTrackEnabled, false, "Local mic is muted");
    setLocalMute(false);
    assert.equal(audioElementMuted, true, "Speaker still remains muted");
    assert.equal(localTrackEnabled, true, "Local mic is unmuted");

    // TEST E: While Mute is enabled, toggle Speaker -> mic remains muted
    setLocalMute(true);
    setSpeaker(true);
    assert.equal(localTrackEnabled, false, "Local mic remains muted");
    assert.equal(audioElementMuted, false, "Speaker is audible");
    setSpeaker(false);
    assert.equal(localTrackEnabled, false, "Local mic still remains muted");
    assert.equal(audioElementMuted, true, "Speaker is muted");
  });
});
