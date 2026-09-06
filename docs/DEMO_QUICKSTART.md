# VIRA LIVE DEMO QUICKSTART

Use this concise step-by-step guide to run a live demonstration of VIRA.

---

## 1. Start Backend Server
```bash
npm run dev:server
```
*Server starts on `http://localhost:4000`.*

---

## 2. Start Frontend Client
```bash
npm run dev:client
```
*App is available at `http://localhost:5173`.*

---

## 3. Verify Health & Models
Open `http://localhost:4000/health` in your browser. Verify:
```json
{
  "status": "ok",
  "models": {
    "aasist": { "ready": true, "version": "AASIST-v1" },
    "ecapa": { "ready": true, "version": "ECAPA-TDNN-v1" }
  }
}
```

---

## 4. Log In
1. Open two browser windows (Window 1: Host/Alice, Window 2: Caller/Bob).
2. Log in using email/password or test accounts.

---

## 5. Enroll Voice ID
1. On Window 1, click **VOICE ID SETUP** (`/voice-enrollment`).
2. Click **Start Recording** and speak clearly for 8 seconds:
   > *"VIRA protects real-time voice communications against AI deepfakes."*
3. Verify that accumulated clean speech reaches $\ge 2.5\text{s}$.
4. Receive confirmation: **"Voice ID Registered (192-dim Profile Created)"**.

---

## 6. Start Secure Call
1. In Window 1, select the contact and click **START SECURE CALL**.
2. In Window 2, click **Accept** on the incoming call modal.
3. Call connects and audio starts streaming over WebRTC.

---

## 7. Demonstrate Genuine Speaker
1. Host speaks normally into Window 1 microphone.
2. Window 2 shows:
   - **Status:** `🟢 Human Voice Likely [AUTHENTIC]`
   - **Gauges:** `AI Spoof Likelihood: Low (< 10%)` | `Speaker Match: High (> 95%)`

---

## 8. Demonstrate Human Impostor
1. Have a different unregistered person speak into Window 1 microphone.
2. Window 2 shows:
   - **Status:** `🟠 Speaker Mismatch Detected`
   - **Distinction:** `Voice Authenticity: Human Voice Likely` | `Speaker Identity: Mismatch (< 80%)`

---

## 9. Demonstrate AI Voice Clone
1. Play synthetic / vocoded clone speech of the enrolled user into Window 1 microphone.
2. Window 2 shows:
   - **Status:** `🔴 Possible Synthetic Voice`
   - **Distinction Callout:** `Voice Authenticity: Possible Synthetic Voice` | `Speaker Identity: Match (Voice Clone Detected!)`

---

## 10. Show Analysis Details
1. Click **"Analysis Details ▼"** on the live badge.
2. Highlight:
   - Real-time processing latency (~150 ms).
   - 3.0-second speech window with 1.5-second sliding hop.
   - 5-window temporal smoothing history preventing false blips.

---

## 11. Show Privacy & Security Behavior
1. Open the **Privacy Policy** modal in the header.
2. Emphasize:
   - **Raw Audio:** Transient in memory, never saved to disk.
   - **Biometrics:** Only 192-dim mathematical vectors stored in Supabase with RLS.
   - **Socket Privacy:** Raw embeddings are never broadcast to client devices.

---

## 12. End Call
1. Click the red **End Call** button.
2. Verify call state tears down cleanly and memory sessions are freed on the server.
