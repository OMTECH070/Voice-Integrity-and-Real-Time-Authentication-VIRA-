# VIRA — Live Presentation Demonstration Script

**Project:** VIRA — Voice Integrity and Real-Time Authentication  
**Demonstration Target:** End-to-End Live Evaluation & Product Walkthrough  
**Document Version:** 1.0.0 (Demo Certified)

---

## Presentation Overview

This script provides the presenter with a structured, step-by-step procedure to demonstrate VIRA's real-time capabilities to stakeholders, evaluators, and audiences.

---

## 1. Pre-Demo Setup & Environment Checklist

1. Start the VIRA Server:
   ```bash
   npm run dev:server
   ```
2. Start the VIRA Client:
   ```bash
   npm run dev:client
   ```
3. Open `http://localhost:5173` in two browser windows (or two separate devices / profiles):
   - **User A (Alice):** Enrolled host contact.
   - **User B (Bob):** Caller / Participant.
4. Verify backend health at `http://localhost:4000/health`:
   - `models.aasist.ready: true`
   - `models.ecapa.ready: true`

---

## 2. Walkthrough Scenarios

---

### SCENARIO A: Genuine Enrolled Speaker (Live Human)

**Goal:** Demonstrate seamless authentication of a legitimate enrolled contact.

#### Steps:
1. On **User A's** window, navigate to **Voice ID Setup** (`/voice-enrollment`).
2. Click **Start Recording** and speak clearly for 8 seconds:
   > *"My voice is my password. VIRA authenticates my identity and protects against synthetic clones."*
3. Observe the live VAD speech meter accumulating $\ge 2.5\text{s}$ of speech.
4. Verify the success confirmation screen: **"Voice ID Registered (192-dim Profile Created)"**.
5. Initiate a secure WebRTC call between User A and User B.
6. User A speaks naturally into their microphone.

#### Expected Live UI Feedback:
- **Status Badge:** `🟢 Human Voice Likely`
- **Authenticity Gauge:** `AI Spoof Likelihood: Low (< 15%)`
- **Identity Gauge:** `Speaker Match: High (> 95% - Verified)`
- **Telemetry Expand:** ECAPA similarity $\approx 0.98$, AASIST spoof probability $\approx 0.02$.

---

### SCENARIO B: Human Impostor (Unregistered Live Speaker)

**Goal:** Demonstrate that a live human speaker whose voice does NOT match the enrolled profile is flagged as a mismatch while correctly recognized as human.

#### Steps:
1. Maintain User A's enrolled profile on the call.
2. Have a different speaker (User C / Impostor) speak into User A's microphone (or play genuine speech from another human).

#### Expected Live UI Feedback:
- **Status Badge:** `🟠 Speaker Mismatch Detected`
- **Distinct Callout:**
  - `Voice Authenticity: Human Voice Likely (Live Acoustic Dynamics)`
  - `Speaker Identity: Speaker Mismatch Detected (< 82% Similarity)`
- **Identity Gauge:** `Speaker Match: Low (< 75% - Mismatch)`

---

### SCENARIO C: AI Voice Clone / Deepfake Impersonation

**Goal:** Demonstrate VIRA's core breakthrough: distinguishing between **Voice Authenticity** (Synthetic) and **Speaker Identity** (Matching Target).

#### Steps:
1. Play a synthetic AI-generated audio sample (e.g., ElevenLabs / XTTS clone of User A's voice or vocoded speech) into the microphone.
2. Observe VIRA's real-time dual-engine inference.

#### Expected Live UI Feedback:
- **Status Badge:** `🔴 Possible Synthetic Voice`
- **Core Distinction Banner:**
  - `Voice Authenticity: Possible Synthetic Voice (High Artifact Score)`
  - `Speaker Identity: Match (Voice Clone Detected!)`
- **Authenticity Gauge:** `AI Spoof Likelihood: Critical (> 85%)`
- **Identity Gauge:** `Speaker Match: High (> 90%)`

---

### SCENARIO D: Contact With No Enrolled Voice Profile

**Goal:** Demonstrate graceful operation when a peer has not yet registered a Voice ID.

#### Steps:
1. Call a contact who has not completed Voice ID onboarding.
2. Speak as a live human.

#### Expected Live UI Feedback:
- **Status Badge:** `🔵 Human Voice Likely (No Voice Profile Enrolled)`
- **Identity Notice:** `No voice profile enrolled for this contact. Live anti-spoof protection remains active.`
- **Authenticity Gauge:** Active & operational.

---

### SCENARIO E: Inconclusive / Low SNR / High Noise Audio

**Goal:** Demonstrate that uncertain or boundary-level audio is never falsely categorized as 100% genuine or 100% spoof.

#### Steps:
1. Introduce heavy background noise, whispering, or low-energy transient bursts.

#### Expected Live UI Feedback:
- **Status Badge:** `🟡 Voice Analysis Inconclusive`
- **Probabilistic Note:** `Acoustic features in boundary range. Maintaining current call state.`

---

### SCENARIO F: Model Offline / Resilience Simulation

**Goal:** Demonstrate that system errors or model unavailability fail safely without generating fake scores.

#### Steps:
1. Simulate network drop or backend model failure in test harness.

#### Expected Live UI Feedback:
- **Status Badge:** `⚪ Voice Analysis Unavailable`
- **Fail-Safe Integrity:** No fabricated or simulated numbers shown to the user.

---

## 3. Key Talking Points for Presentation

1. **Active Real-Time Analysis:** Unlike post-call forensics, VIRA operates *during* active conversation on 3.0-second speech windows.
2. **Dual-Signal Independence:** Authenticity (AASIST) and Identity (ECAPA) are evaluated independently. An AI clone mimicking the speaker is caught as *Synthetic + Identity Match*.
3. **Zero Raw Audio Retention:** Raw PCM audio is transient and discarded immediately after feature extraction. Only derived 192-dimensional embeddings are saved.
4. **Hardware Efficiency:** Runs on standard CPU nodes via ONNX Runtime without requiring specialized GPU clusters.
