# VIRA — Final Deployment & Operations Guide

**Project:** VIRA — Voice Integrity and Real-Time Authentication  
**Version:** 1.0.0 (Production / Demo Certified)  
**Date:** August 2026

---

## 1. Project Overview

VIRA is an end-to-end, privacy-preserving real-time communication platform that authenticates caller identity and detects synthetic voice clones (deepfakes) during active WebRTC calls.

Unlike traditional post-call forensic tools or single-purpose biometrics, VIRA runs a dual-engine ML pipeline during active conversation:
1. **AASIST ONNX (Anti-Spoofing):** Evaluates spectral and temporal voice artifacts to distinguish live human vocal tract dynamics from synthetic TTS, voice conversions, and vocoded replays.
2. **ECAPA-TDNN ONNX (Speaker Verification):** Extracts 192-dimensional speaker embeddings and computes cosine similarity against the registered contact's biometric profile.
3. **VoiceIntegrityService (Multi-Model Fusion):** Combines authenticity and identity signals with 5-window temporal smoothing into real-time visual telemetry for the user.

---

## 2. System Architecture

```
                                  ACTIVE WEBRTC CALL
                                          │
                                          ▼
                             Client-Side AudioWorklet VAD
                          (Filters silence & background noise)
                                          │
                                          ▼
                                Speech-Only PCM Buffer
                           (3.0s window / 1.5s sliding hop)
                                          │
                                          ▼
                              Socket.IO Binary Transport
                                (Rate limited & aligned)
                                          │
                      ┌───────────────────┴───────────────────┐
                      ▼                                       ▼
             AASIST ONNX Engine                      ECAPA-TDNN ONNX Engine
         (Anti-Spoof Classification)             (192-dim Speaker Embedding)
                      │                                       │
                      ▼                                       ▼
            Spoof Probability [0, 1]                Cosine Similarity [-1, 1]
                      │                                       │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                              VoiceIntegrityService
                          (Dual Fusion Decision Matrix)
                                          │
                                          ▼
                              5-Window Temporal Smoothing
                            (Hysteresis & Anomaly Filter)
                                          │
                                          ▼
                                VoiceIntegrityBadge
                          (Live UI Status & Telemetry)
```

---

## 3. System Requirements

### 3.1 Hardware Recommendations
- **CPU:** 2+ cores ($x86\_64$ or ARM64). CPU execution is optimized via ONNX Runtime Node.
- **RAM:** 2 GB minimum (4 GB recommended for high concurrent call volume).
- **Storage:** ~200 MB for repository, models, and node modules.

### 3.2 Software Prerequisites
- **Node.js:** v18.0.0+ or v20.0.0+ (LTS recommended).
- **npm:** v9.0.0+.
- **Supabase Account:** Free tier or self-hosted Supabase instance for authentication and PostgreSQL storage with RLS.
- **WebRTC Browser:** Google Chrome, Microsoft Edge, Firefox, or Safari (supporting `AudioWorklet` and `getUserMedia`).

---

## 4. Installation & Environment Setup

### 4.1 Clone and Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/vira.git
cd vira

# Install all monorepo dependencies (client + server)
npm install
```

### 4.2 Environment Configuration
Copy `.env.example` to configure the server and client environments:

#### Server Configuration (`server/.env`):
```ini
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

# Optional: Override default model paths
# VIRA_AASIST_MODEL_PATH=./models/aasist.onnx
# VIRA_ECAPA_MODEL_PATH=./models/ecapa.onnx

# Optional: Calibration thresholds
# VIRA_AASIST_SPOOF_THRESH=0.70
# VIRA_AASIST_LIVE_THRESH=0.55
# VIRA_ECAPA_MATCH_THRESH=0.92
# VIRA_ECAPA_MISMATCH_THRESH=0.82
# VIRA_ECAPA_UNCERTAIN_THRESH=0.82
```

#### Client Configuration (`client/.env`):
```ini
VITE_SERVER_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 5. Model Files Verification

Ensure the following ONNX model files are present in `server/models/`:
- `server/models/aasist.onnx` (1.02 MB)
- `server/models/aasist.onnx.data` (1.19 MB)
- `server/models/ecapa.onnx` (84.1 MB)

Verify model presence and integrity via the health endpoint once the server starts:
```bash
curl http://localhost:4000/health
```
Expected output:
```json
{
  "status": "ok",
  "service": "vira-server",
  "uptimeSeconds": 12,
  "models": {
    "aasist": {
      "ready": true,
      "version": "AASIST-v1"
    },
    "ecapa": {
      "ready": true,
      "version": "ECAPA-TDNN-v1"
    }
  }
}
```

---

## 6. Supabase Database Setup & RLS Migration

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Paste and run the entire contents of [`supabase/schema.sql`](file:///c:/Users/NISHANT/Downloads/Voice-Integrity-and-Real-Time-Authentication-VIRA--main/supabase/schema.sql).
4. Verify that the following tables exist with Row-Level Security enabled:
   - `public.profiles` (User profile metadata)
   - `public.contacts` (Peer relationships)
   - `public.voice_profiles` (192-dim biometric embeddings protected by `auth.uid() = user_id`)

---

## 7. Startup & Development Mode

To run both server and client in development mode with hot reloading:

```bash
# Terminal 1: Start Signaling & ML Inference Server
npm run dev:server

# Terminal 2: Start Vite Client
npm run dev:client
```
The client will be accessible at `http://localhost:5173` and the server at `http://localhost:4000`.

---

## 8. Production Build & Deployment

### 8.1 Build Workspaces
```bash
# Compile TypeScript on server and bundle Vite client
npm run build
```

### 8.2 Start Production Server
```bash
# Start the compiled Node.js backend
npm start --workspace=server
```

### 8.3 Client Static Hosting
The built client artifacts are located in `client/dist/` and can be deployed to any static host (e.g., Vercel, Cloudflare Pages, Netlify, AWS S3/CloudFront).

---

## 9. Security Architecture & Privacy Policy

1. **Ephemeral Transient Audio:** Raw PCM audio chunks are processed in transient memory buffers and discarded immediately after feature extraction. Raw audio is **never written to disk or database**.
2. **Biometric Secrecy:** Only mathematical 192-dimensional vector embeddings are stored in `voice_profiles`. Stored embeddings are **never transmitted over Socket.IO to client applications**.
3. **Database Isolation:** PostgreSQL RLS strictly ensures that users can only select, insert, update, or delete their own voice profile.
4. **Transport Hardening:** Socket events are protected against tampering, chunk flooding (4 chunks/sec rate limit), payload size limits (5 MB max), and historical replay ($\pm 30\text{s}$ freshness check).
5. **Overwrite Protection:** Re-enrolling requires explicit user confirmation before replacing an existing baseline embedding.

---

## 10. Performance Benchmarks

| Metric | Measured Benchmark (CPU) | Requirement / SLA |
| :--- | :---: | :---: |
| **AASIST Inference Latency** | ~60 – 120 ms | $< 250\text{ ms}$ |
| **ECAPA Embedding Latency** | ~40 – 90 ms | $< 200\text{ ms}$ |
| **Fusion & Temporal Smoothing** | $< 1\text{ ms}$ | $< 5\text{ ms}$ |
| **Total Pipeline Latency** | ~110 – 210 ms | $< 500\text{ ms}$ |
| **Analysis Window / Stride** | 3.0s window / 1.5s hop | Real-time streaming |
| **Concurrent Call Isolation** | 10 calls tested concurrently | Zero crosstalk / leakage |

---

## 11. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `status: analysis-unavailable` | ONNX model files missing in `server/models/` | Ensure `aasist.onnx`, `aasist.onnx.data`, and `ecapa.onnx` are located in `server/models/` or set `VIRA_*_MODEL_PATH`. |
| Microphone permission denied | Browser blocked audio access | Grant microphone permissions in browser settings and reload. |
| Socket connection failed | CORS or wrong server URL | Check `VITE_SERVER_URL` in `client/.env` and `CLIENT_ORIGIN` in `server/.env`. |
| Voice ID enrollment too short | Insufficient speech accumulated ($< 2.5\text{s}$) | Speak clearly for the full 8-second countdown during enrollment. |
