# VIRA — Voice Integrity and Real-Time Authentication

> **Real-time voice integrity scoring, anti-spoof deepfake detection, and caller identity verification for WebRTC voice communication.**

---

## 1. Project Overview

**VIRA (Voice Integrity and Real-Time Authentication)** is an intelligent audio security platform designed to defend voice communication against the rapidly accelerating threats of AI voice cloning, deepfake audio impersonation, and phone-based social engineering scams.

Modern synthetic voice models can replicate an individual's vocal timbre, cadence, and pitch from only seconds of clean reference audio. Traditional caller ID systems rely on easily spoofed metadata (such as phone numbers or user handles) and provide zero verification of who is actually speaking. 

VIRA solves this problem by analyzing the **acoustic integrity** of the incoming audio stream directly during an active call. By combining client-side Voice Activity Detection (VAD), deep neural network speaker embeddings, audio anti-spoofing classifiers, and real-time speech transcription, VIRA provides continuous, probabilistic caller verification and threat detection without compromising user privacy.

### Core Objectives
* **Real-Time Voice Integrity**: Continuous evaluation of remote audio for signs of synthetic generation, vocoder artifacts, and replay attacks.
* **Biometric Caller Verification**: 1:1 speaker identity comparison against enrolled voice profiles using deep speaker embeddings.
* **Conversational Threat Detection**: Real-time contextual analysis of transcribed speech to flag high-risk social engineering markers (e.g., urgent financial demands, OTP/credential harvesting).
* **Privacy-First Architecture**: Audio never leaves the client for recording storage; recordings and scam reports reside exclusively on-device in browser IndexedDB.

---

## 2. Key Features

The following features reflect the active, implemented codebase:

* **User Authentication & Profiles**: Secure user sign-up, sign-in, and session management powered by Supabase Auth with Row-Level Security (RLS).
* **Role-Based Access Control (RBAC)**: Distinct permissions for `admin` and `user` roles stored in database profiles.
* **Dual User Experiences**:
  * **Admin Experience**: Full access to the WebRTC calling interface, live voice verification diagnostics, and the ML dataset annotation and review pipeline.
  * **Normal User Experience ("Launching Soon")**: Clean, accessible landing page informing standard users that public access is launching soon, preventing unauthorized access to testing tools.
* **Peer-to-Peer WebRTC Calling**: High-quality, low-latency browser-to-browser voice calling using WebSockets and Socket.IO for signaling.
* **Client-Side Silero VAD**: Low-latency Voice Activity Detection running directly in the browser via ONNX Runtime Web and AudioWorklet, filtering out silence and isolating speech frames.
* **ECAPA-TDNN Voice ID**: Deep 192-dimensional speaker embeddings generated from clean speech windows, computing cosine similarity against enrolled caller profiles.
* **AASIST Anti-Spoofing**: State-of-the-art spectral graph neural network detecting artifacts characteristic of voice clones, text-to-speech (TTS) engines, and vocoders.
* **Deepgram Live Transcription**: Server-side speech-to-text integration converting speech-only audio chunks into real-time transcripts for conversational risk scanning.
* **Conversational Risk Analysis**: Context-aware heuristic scoring detecting urgency patterns, financial demands, and credential harvesting attempts.
* **Social & Contextual Signals**: Verification of caller relationship based on known vs. unknown contact status.
* **Live Voice Integrity Scoring**: Real-time fusion combining acoustic spoof scores, speaker verification, and contextual risk into clear integrity levels (`HIGH`, `MEDIUM`, `LOW`).
* **Voice ID Enrollment**: Guided client-side enrollment flow with speech gating, minimum duration enforcement, and secure storage of enrolled embeddings in Supabase `voice_profiles`.
* **Persistent Local Call Recordings**: Privacy-first audio recording stored locally in browser `IndexedDB` (`vira_local_recordings`), persisting across page reloads and browser restarts.
* **Recording Management**: On-device recording playback, WAV/Blob download, and permanent deletion with zero cloud uploads.
* **Scam-Call Reporting**: Direct on-device scam report logging, preserving flagged call context in IndexedDB alongside call recordings.
* **"Why VIRA Flagged It"**: Accessible transparency modal explaining the exact contributing factors (e.g., synthetic voice detection, voice mismatch, urgency patterns) in plain language.
* **Easy Mode (English & Hindi)**: High-contrast, large-font accessible interface mode with complete English and Hindi translations.
* **Supabase Data Persistence**: PostgreSQL database backing user profiles, contact lists, voice profile embeddings, and dataset telemetry.
* **Production Deployment Architecture**: Multi-cloud deployment topology separating frontend delivery, real-time signaling, and heavy GPU/CPU machine learning inference.

---

## 3. System Architecture

VIRA employs a distributed, service-oriented architecture designed to isolate heavy neural network inference from real-time WebSockets signaling and client UI interactions.

```
       ┌─────────────────────────────────────────────────────────┐
       │                   Vercel Frontend                       │
       │  - React 18 + Vite UI (Dashboard / Active Call / Admin) │
       │  - Web Audio API + AudioWorklet                         │
       │  - Silero VAD (ONNX Runtime Web)                        │
       │  - IndexedDB Local Recording Storage                    │
       └────────────────────────────┬────────────────────────────┘
                                    │
               WebRTC Peer-to-Peer  │  Socket.IO Signaling &
               Audio (Direct Stream)│  Gated Analysis Chunks
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                    Render Backend                       │
       │  - Express + Socket.IO Server                           │
       │  - WebRTC Signaling & Call Lifecycle Orchestration      │
       │  - Voice ID Verification & Profile Caching              │
       │  - Risk Engine & Social Context Integration             │
       │  - In-Memory Fallback & Queue Backpressure Engine       │
       └──────────────┬───────────────────────────┬──────────────┘
                      │                           │
  HTTP POST /analyze  │ Server-to-Server          │ HTTP Streaming
  (16kHz Float32LE)   │ (X-API-Key Protected)     │ Linear16 PCM
                      ▼                           ▼
       ┌─────────────────────────────┐   ┌───────────────────────────┐
       │  Railway ML Inference       │   │    Deepgram API           │
       │  - FastAPI Service          │   │  - Real-Time Speech-to-   │
       │  - ECAPA-TDNN (192-dim)     │   │    Text Transcription     │
       │  - AASIST Anti-Spoof        │   └───────────────────────────┘
       │  - Eager Startup Loading    │
       └─────────────────────────────┘
                      │
                      ▼
       ┌─────────────────────────────────────────────────────────┐
       │                    Supabase                             │
       │  - PostgreSQL + Row-Level Security (RLS)                │
       │  - User Profiles (`profiles`) & Contacts (`contacts`)   │
       │  - Enrolled Voice Biometrics (`voice_profiles`)         │
       │  - ML Telemetry & Dataset Review Tables                 │
       └─────────────────────────────────────────────────────────┘
```

### Architectural Responsibilities

1. **WebRTC Peer-to-Peer Layer**: The raw, full-bandwidth voice call audio travels directly between browser peers via WebRTC media tracks. This guarantees low latency for the ongoing human conversation.
2. **Client-Side VAD & Chunking**: The browser intercepts the remote audio track using an `AudioWorklet`. Silero VAD identifies speech frames, and a `RollingSpeechBuffer` accumulates speech into sliding 3-second windows (48,000 samples at 16 kHz), omitting silence and background noise.
3. **Render Backend**: Serves as the signaling gateway, authentication validator, call orchestrator, and risk fusion hub. It routes analysis windows, queries caller profiles, streams audio to Deepgram, and coordinates telemetry.
4. **Railway ML Inference Service**: Heavy neural network models (ECAPA-TDNN and AASIST) run in an isolated FastAPI service hosted on Railway. Render communicates with Railway strictly server-to-server via an internal or HTTPS API protected by a shared secret key.
5. **Database & Storage (Supabase)**: Stores relational data, authentication state, and enrolled 192-dimensional embeddings. Raw audio recordings are never stored in Supabase.
6. **Speech-to-Text (Deepgram)**: Provides real-time speech transcription to feed the server-side contextual risk analyzer.
7. **Zero Secret Exposure**: Model weight files, service-role keys, and external API credentials remain strictly confined to backend environments. The frontend client bundle contains only public URLs and public anonymous keys.

---

## 4. Machine Learning Models

| Model | Purpose | Location | Status |
| :--- | :--- | :--- | :--- |
| **Silero VAD** | Speech detection & silence gating | Client-side (ONNX Runtime Web / AudioWorklet) | **Operational** |
| **ECAPA-TDNN** | 192-dim speaker embeddings & Voice ID verification | Railway ML Service (Server ONNX fallback available) | **Operational** |
| **AASIST** | Spectral graph anti-spoofing / voice clone detection | Railway ML Service (Server ONNX fallback available) | **Operational** |
| **Wav2Vec2** | Secondary acoustic anti-spoofing signal | Server (`server/src/audio/voiceLiveness/wav2vec2AntiSpoof.ts`) | **Scaffolded / NOT_READY** (Checkpoint required) |
| **XGBoost** | Multi-feature risk & voice integrity fusion | Server (`server/src/services/xgboostIntegrity.service.ts`) | **Scaffolded / Calibrated Baseline** (Artifact required) |

### Detailed Model Documentation

#### Silero VAD
* **Purpose**: Identifies human speech frames and filters out silence, breathing, and non-speech acoustic background noise before dispatching audio to the server.
* **Execution**: Client-side execution in the browser via ONNX Runtime Web.
* **Status**: **Operational**. Actively runs in both standard and Easy Mode call screens.

#### ECAPA-TDNN (Emphasized Channel Attention, Propagation, and Aggregation)
* **Purpose**: Generates compact, highly discriminative 192-dimensional speaker embeddings for biometric verification.
* **Mechanism**: Compares live speech embeddings against the enrolled caller profile stored in Supabase using L2-normalized cosine similarity.
* **Location**: Hosted on the Railway ML inference service; a local ONNX Runtime Node fallback is retained on Render.
* **Status**: **Operational**.

#### AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention)
* **Purpose**: Evaluates raw 16 kHz audio waveforms for deepfake artifacts, vocoder signatures, text-to-speech synthesis, and replay attacks.
* **Mechanism**: Analyzes 48,000-sample windows (padded/cropped to 64,600 samples) and outputs a calibrated spoof probability between `0.0` (genuine human) and `1.0` (synthetic / spoof).
* **Location**: Hosted on Railway ML service (with local server ONNX fallback).
* **Status**: **Operational**.

#### Wav2Vec2 Anti-Spoof Classifier
* **Purpose**: Intended as a secondary deep acoustic feature representation for synthetic speech detection.
* **Current Status**: **NOT_READY / MODEL_NOT_FOUND**. While the architectural integration and interface are implemented in `wav2vec2AntiSpoof.ts`, a fine-tuned downstream classification checkpoint (`models/wav2vec2_antispoof.onnx`) is not bundled. The system explicitly detects the missing checkpoint, surfaces an honest `NOT_READY` status, and safely operates in AASIST-only mode without fabricating scores.

#### XGBoost Risk & Integrity Fusion
* **Purpose**: Intended as the non-linear classification model combining the 12-dimensional feature vector (ECAPA similarity, AASIST score, speech ratio, RMS energy, transcript risk, financial/urgency flags, etc.).
* **Current Status**: **Scaffolded / Calibrated Baseline**. The 12-feature vector extraction pipeline is fully implemented and tested. Because a trained model artifact (`models/xgboost_risk.json`) is not yet produced, the service operates in `CALIBRATED_BASELINE` mode using deterministic, calibrated heuristic fusion.

---

## 5. Voice ID (Biometric Speaker Verification)

Voice ID allows users to enroll their voice so that when calling known contacts, the recipient's VIRA system can verify that the live speaker matches the enrolled caller.

### Enrollment Flow
```
[User initiates enrollment]
        │
        ▼
[Microphone records clean audio (Target: 12s, Min: 2.0s)]
        │
        ▼
[Silero VAD filters out non-speech audio]
        │
        ▼
[Speech frames emitted via Socket.IO: voice:enroll]
        │
        ▼
[Render backend receives PCM buffer]
        │
        ▼
[ECAPA-TDNN extracts 192-dimensional embedding]
        │
        ▼
[Embedding vector stored in Supabase public.voice_profiles]
        │
        ▼
[Client receives confirmation: voice:enroll-result]
```

### Verification Principles
* **1:1 Targeted Verification**: The system does **not** compare the live voice against every user in the database. It compares the live speaker exclusively against the enrolled voice profile of the specific registered caller.
* **Single Query per Call**: The target caller's enrolled embedding is fetched from Supabase once when the call session initializes and cached in memory for the duration of the call.
* **Privacy Preservation**: Raw biometric embedding vectors are never transmitted to the client application. The client receives only high-level verification labels (`match`, `mismatch`, `uncertain`, `not-enrolled`) and similarity scores.
* **Unenrolled Graceful Handling**: If a caller has not set up Voice ID, the system reports `not-enrolled` and evaluates the call based on anti-spoofing and conversational signals without generating false mismatch warnings.

---

## 6. Real-Time Call Pipeline

During an active WebRTC call, audio flows through a sequential analysis pipeline:

```
1. Microphone Audio Capture
        │
2. WebRTC PeerConnection (Remote Audio Track)
        │
3. Web Audio API / AudioWorklet
        │
4. Silero VAD (Frame-by-frame speech probability)
        │
5. SpeechAudioGate (Passes speech frames, discards silence)
        │
6. RollingSpeechBuffer (Accumulates speech into sliding windows)
        │  - Target duration: 3.0 seconds (48,000 samples @ 16 kHz)
        │  - Hop duration: 1.5 seconds (50% overlap stride)
        │  - Pause retention: Retains speech across conversational pauses up to 5.0s
        │  - Silence reset: Discards incomplete windows after >5.0s prolonged silence
        │
7. Socket.IO Event: voice:analysis-chunk (Emits Float32 PCM chunk + sequence number)
        │
8. Render Backend Router
        │
9. Server-to-Server Dispatch: Railway ML Service (POST /analyze)
        │  - ECAPA-TDNN generates 192-dim live embedding
        │  - AASIST generates calibrated spoof probability score
        │
10. ECAPA Cosine Comparison (Live embedding vs. Enrolled caller profile)
        │
11. Parallel Deepgram Transcription (Linear16 streaming conversion)
        │
12. Risk Engine & Feature Fusion (Acoustic + Transcript + Social signals)
        │
13. ML Dataset Ingestion (Captures 12-feature telemetry into dataset_samples)
        │
14. Socket.IO Event: voice:analysis-result (Emitted to client)
        │
15. Client UI Updates (Displays live integrity gauge, warning banners, and explanation)
```

---

## 7. Railway ML Service

The heavy machine learning inference layer is deployed as a standalone, containerized Python service on **Railway**.

* **Framework**: FastAPI with Uvicorn.
* **Model Engine**: ONNX Runtime (CPU execution provider with graph optimization).
* **Endpoints**:
  * `GET /health`: Probes service availability and reports individual model readiness (`ecapa: true/false`, `aasist: true/false`). Returns `200 OK` (`status: "ok"`) when both models are loaded, or `status: "degraded"` if any model fails.
  * `POST /analyze`: Accepts 16 kHz audio chunks and executes ECAPA-TDNN and AASIST inference.
* **Payload Format**: Supports Float32 sample arrays or Base64-encoded binary PCM (`pcm_format: "f32le"`).
* **Response Output**:
  * `embedding`: 192-dimensional L2-normalized float array.
  * `spoof_score`: AASIST probability score between `0.0` and `1.0`.
  * `inference_latency_ms`: Execution time taken by ONNX sessions.
* **Authentication**: Server-to-server authorization enforced via `X-API-Key` or `Authorization: Bearer <key>` matching the `VIRA_ML_API_KEY` environment variable.
* **Eager Initialization**: Models are pre-warmed once during FastAPI application startup via lifespan management, eliminating cold-start latency on call requests.

---

## 8. Render Backend

The Render service (`server/`) serves as the central application and signaling controller:

* **WebSockets & Signaling**: Houses the Socket.IO server handling WebRTC signaling (`call:initiate`, `call:offer`, `call:answer`, `call:ice-candidate`, `call:end`).
* **Authentication Validation**: Validates user identities and checks active sessions against Supabase Auth.
* **Audio Chunk Ingestion**: Ingests `voice:analysis-chunk` payloads, validating sample rates, sequence ordering, and monotonic timestamps to prevent replay attacks.
* **Voice ID Verification**: Coordinates with `VoiceAuthService` to retrieve caller embeddings and calculate cosine similarity.
* **Transcription Pipeline**: Manages the Deepgram STT connection, converting incoming Float32 buffers to signed 16-bit Linear PCM (`linear16`).
* **Risk Engine**: Evaluates conversational risk triggers (money transfers, urgency words, banking terms) and combines them with acoustic signals.
* **Telemetry & Dataset Collection**: Records 12-dimensional feature vectors into Supabase `dataset_samples` for ongoing ML model training and annotation.
* **Resilient ML Fallback**: If the Railway ML service times out (2500ms threshold) or is unavailable, Render automatically falls back to local in-process ONNX Runtime Node execution (`voiceLivenessService`).

---

## 9. Supabase Database

VIRA uses Supabase PostgreSQL with **Row-Level Security (RLS)** enabled across all tables.

### Active Schema Tables

1. `profiles`:
   * Extends Supabase `auth.users` with application metadata.
   * Columns: `id` (UUID, PK), `username`, `display_name`, `avatar_url`, `role` (`'admin'` | `'user'`), `created_at`.
2. `contacts`:
   * Manages known user connections.
   * Columns: `owner_id` (UUID), `contact_user_id` (UUID), `added_at`. Composite primary key: `(owner_id, contact_user_id)`.
3. `voice_profiles`:
   * Stores enrolled ECAPA-TDNN speaker embeddings.
   * Columns: `user_id` (UUID, PK), `embedding` (`double precision[]`, length 192), `sample_duration_seconds`, `model_version`, `enrolled_at`, `updated_at`.
4. `dataset_samples`:
   * Ingests 12-feature telemetry vectors captured from live analysis windows for machine learning dataset building.
   * Columns: `id` (UUID, PK), `call_id`, `speaker_id`, `speaker_direction`, `feature_vector` (JSONB), `ground_truth_status`, `ground_truth_label`, `review_status`, `dataset_split`, `created_at`.
5. `dataset_reviews`:
   * Stores human ground-truth labels and forensic reviews submitted by administrators.
   * Columns: `id` (UUID, PK), `sample_id` (FK), `reviewer_id` (FK), `ground_truth_label`, `label_confidence`, `notes`, `created_at`.
6. `dataset_adjudications`:
   * Records consensus resolutions for samples with conflicting reviewer labels.
   * Columns: `id` (UUID, PK), `sample_id` (FK), `adjudicator_id` (FK), `resolved_label`, `resolution_notes`, `created_at`.
7. `dataset_versions`:
   * Tracks frozen dataset snapshots and export manifests for reproducible ML model training.
   * Columns: `id` (UUID, PK), `version_tag`, `sample_count`, `manifest` (JSONB), `created_by`, `created_at`.

> **Note on Database Cleanliness**: All legacy/obsolete tables (including `integrity_scores`, `call_risk_events`, `transcript_segments`, `voice_verification_events`, `anti_spoof_events`, `call_sessions`, and `voice_embeddings`) were removed during database cleanup migrations and are no longer referenced in the codebase.

---

## 10. Recording System

VIRA includes an on-device call recording and safety reporting system:

* **Zero-Cloud Audio Storage**: Audio blobs are stored directly on the user's device using browser **IndexedDB** (`vira_local_recordings`, store: `recordings`). Audio files are never transmitted to Supabase, external clouds, or third-party storage.
* **Persistence**: Recordings survive page refreshes, browser restarts, and session logouts.
* **User Control**: Users can preview audio playback, download recordings as standard audio files, or permanently delete them from their browser storage.
* **On-Device Scam Reports**: When a user flags a call as suspicious, a scam report record is created in IndexedDB (store: `scam_reports`) referencing the local recording ID and timestamp.
* **Storage Quota Resilience**: IndexedDB storage operations feature built-in quota checks and error handling to ensure client stability if device disk space is constrained.

---

## 11. Security

* **Environment Secret Segregation**:
  * Production secrets (`DEEPGRAM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VIRA_ML_API_KEY`) reside solely on backend servers and are never bundled into client code.
  * The frontend client accesses Supabase strictly through `VITE_SUPABASE_ANON_KEY` subject to database Row-Level Security.
* **Server-Side Authorization & RLS**:
  * Database operations verify user ownership via Supabase RLS policies.
  * Cross-user voice verification lookups bypass client RLS by executing exclusively within the server using the service-role client.
* **API Key Protection (Server-to-Server)**:
  * Communication between the Render backend and the Railway ML service is authenticated via `X-API-Key` headers.
* **Request Timeouts & Circuit Breaking**:
  * Remote ML requests utilize an `AbortSignal.timeout(2500)` circuit breaker. If Railway takes longer than 2.5 seconds, the request aborts and the system gracefully degrades to local fallback.
* **Model Protection**:
  * Raw ONNX weights, embeddings, and server architectures are shielded behind backend APIs and cannot be downloaded by client users.
* **Sanitized Logging**:
  * Production logging explicitly excludes raw audio samples, base64 payloads, biometric vectors, and API keys.

---

## 12. Environment Variables

Configure the following variable names in their respective deployment environments. **Never commit actual secrets or credentials into version control.**

### Render Backend (`server/`)
* `PORT`: Port on which the Express and Socket.IO server listens (default: `4000`).
* `CLIENT_ORIGIN`: Allowed CORS origin URL for client web requests (e.g., `https://your-app.vercel.app`).
* `SUPABASE_URL`: Supabase project URL (e.g., `https://xyzcompany.supabase.co`).
* `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret service-role key for administrative operations.
* `DEEPGRAM_API_KEY`: Secret API key for Deepgram speech-to-text service.
* `TRANSCRIPTION_PROVIDER`: STT provider identifier (`deepgram`).
* `VIRA_ML_URL`: URL of the Railway ML inference service (e.g., `https://vira-ml.up.railway.app`).
* `VIRA_ML_API_KEY`: Shared secret key for authenticating requests from Render to Railway.

### Vercel Frontend (`client/`)
* `VITE_SERVER_URL`: Public WebSocket and HTTP URL of the Render backend.
* `VITE_SUPABASE_URL`: Public Supabase project URL.
* `VITE_SUPABASE_ANON_KEY`: Public Supabase anonymous API key.

### Railway ML Service (`ml-service/`)
* `VIRA_ML_API_KEY`: Secret key required to access the `/analyze` endpoint.
* `PORT`: Listening port assigned dynamically by Railway (default: `8000`).

---

## 13. Deployment Architecture

VIRA is partitioned across modern cloud infrastructure platforms:

| Service | Provider | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | **Vercel** | Delivers the static React 18 single-page application, Web Audio worklets, and client-side ONNX models. |
| **Backend API** | **Render** | Runs the Node.js / Express server, Socket.IO WebRTC signaling engine, risk calculations, and Supabase server client. |
| **ML Inference** | **Railway** | Runs the containerized FastAPI Python service hosting ECAPA-TDNN and AASIST ONNX models. |
| **Database & Auth** | **Supabase** | Provides managed PostgreSQL, authentication services, Row-Level Security, and biometric voice profile storage. |
| **Speech-to-Text** | **Deepgram** | High-speed cloud API performing streaming audio transcription. |

---

## 14. Local Development

### Prerequisites
* **Node.js**: v20.x or higher
* **npm**: v10.x or higher
* **Python**: v3.10 or higher (for `ml-service`)

### Installation

Clone the repository and install dependencies for all workspaces:
```bash
# Install root, client, and server dependencies
npm install

# Install ML service Python dependencies
cd ml-service
pip install -r requirements.txt
cd ..
```

### Running Locally

Run each component in separate terminal windows:

```bash
# Terminal 1: Run Render Backend (Port 4000)
npm run dev:server

# Terminal 2: Run Client Application (Port 5173)
npm run dev:client

# Terminal 3: Run Railway ML Service locally (Port 8000)
cd ml-service
uvicorn app:app --reload --port 8000
```

### Testing & Verification

Run automated test suites and type checks using existing workspace scripts:

```bash
# Run all client and server unit/integration tests
npm test

# Run TypeScript checks across both client and server
npm run typecheck

# Run ML Service unit & integration tests (Pytest)
cd ml-service
pytest test_app.py
cd ..

# Build production bundles for client and server
npm run build
```

---

## 15. Testing

The VIRA repository maintains automated test coverage across all architectural boundaries:

* **Client Test Suite (`10 test suites`)**:
  * `src/audio/vad/__tests__/vadCore.test.ts`: Core VAD state machine and energy gating.
  * `src/audio/vad/__tests__/adaptiveVad.test.ts`: Dynamic background noise threshold adaptation.
  * `src/audio/vad/__tests__/sileroVad.test.ts`: Silero ONNX runtime execution and tensor mapping.
  * `src/audio/analysis/__tests__/rollingBuffer.test.ts`: Sliding window accumulation, pause retention, and silence resets.
  * `src/components/__tests__/voiceIntegrityUi.test.ts`: Fused integrity UI states, probabilistic copy, and color tokens.
  * `src/components/__tests__/easyMode.test.ts`: Easy Mode state management, high-contrast styling, and English/Hindi translations.
  * `src/components/__tests__/viraAppSkeleton.test.ts`: App loading state, skeleton accessibility, and error handling.
  * `src/components/__tests__/authFlow.test.ts`: Authentication state transitions, session handling, and login/signup flows.
  * `src/components/__tests__/callRecordingAndSafety.test.ts`: IndexedDB local recording CRUD, scam reporting, and privacy isolation.
  * `src/components/__tests__/roleAccessAndLaunchingSoon.test.ts`: Role-based gating, admin vs. normal user routing, and Launching Soon page.
* **Server Test Suite (`13 test suites`)**:
  * `src/sockets/__tests__/voiceSocket.test.ts`: Socket.IO call signaling, sequence validation, and timestamp replay defense.
  * `src/audio/voiceLiveness/__tests__/aasistInference.test.ts`: AASIST model execution and backpressure queue handling.
  * `src/audio/voiceLiveness/__tests__/ecapaVoiceAuth.test.ts`: ECAPA-TDNN embedding generation and cosine verification.
  * `src/audio/voiceLiveness/__tests__/voiceIntegrityFusion.test.ts`: Multi-signal fusion, temporal smoothing, and calibration.
  * `src/audio/voiceLiveness/__tests__/validationPipeline.test.ts`: End-to-end synthetic voice detection and speaker separation.
  * `src/audio/voiceLiveness/__tests__/hardeningSecurity.test.ts`: Session concurrency, multi-call isolation, and malformed audio rejection.
  * `src/audio/voiceLiveness/__tests__/forensicModelValidation.test.ts`: Forensic separation of genuine human speech vs. vocoder clones.
  * `src/audio/voiceLiveness/__tests__/liveEcapaIntegration.test.ts`: Real-time ECAPA verification lifecycle and impostor rejection.
  * `src/audio/voiceLiveness/__tests__/ecapaStructuredVerification.test.ts`: Threshold band decisions (`match`, `mismatch`, `uncertain`).
  * `src/audio/voiceLiveness/__tests__/wav2vec2AntiSpoof.test.ts`: Wav2Vec2 status reporting and graceful degradation without checkpoint fabrication.
  * `src/audio/voiceLiveness/__tests__/transcriptionRisk.test.ts`: Deepgram STT payload transformation and conversational threat detection.
  * `src/audio/voiceLiveness/__tests__/xgboostIntegrity.test.ts`: 12-feature vector extraction and calibrated baseline fusion.
  * `src/services/__tests__/remoteMl.service.test.ts`: Server-to-server Railway ML client, timeout handling, authentication, and fallback.
* **ML Service Pytest Suite (`13 test cases in test_app.py`)**:
  * Validates `/health` model probe, 16 kHz audio validation, base64 decoding, 192-dim ECAPA embeddings, calibrated AASIST spoof probabilities, and API-key security.

---

## 16. Production Verification Checklist

Follow this checklist to verify a live production deployment across Vercel, Render, Railway, and Supabase:

- [ ] **Render Backend is Live**: Access `https://your-render-service.onrender.com/health` and verify `status: "ok"`.
- [ ] **Railway ML Service is Healthy**: Access `https://your-railway-service.up.railway.app/health` and verify `{"status": "ok", "ecapa": true, "aasist": true}`.
- [ ] **Render Configured with Railway URL**: Verify that `VIRA_ML_URL` in the Render dashboard matches the Railway deployment domain.
- [ ] **Shared API Keys Match**: Verify that `VIRA_ML_API_KEY` in Render matches `VIRA_ML_API_KEY` in Railway.
- [ ] **Supabase Connectivity**: Verify that database migrations (`profiles`, `contacts`, `voice_profiles`, `dataset_samples`) are applied.
- [ ] **Voice ID Enrolled**: Using an enrolled account, confirm that a 192-dimensional vector exists in `public.voice_profiles`.
- [ ] **Two-User Production Call**: Establish a live call between two browser devices over WebRTC.
- [ ] **VAD Chunk Generation**: Verify in browser console that `RollingSpeechBuffer` emits speech chunks (`voice:analysis-chunk`).
- [ ] **Render Dispatches to Railway**: Verify Render server logs show `[VIRA][ML-CLIENT] Railway request started`.
- [ ] **Railway Returns 200 OK**: Verify Render logs report `Railway inference successful` with reported latency.
- [ ] **AASIST Score Evaluated**: Confirm spoof probability is received and evaluated.
- [ ] **ECAPA Verification Evaluated**: Confirm speaker similarity against the caller's enrolled profile is evaluated.
- [ ] **Downstream Risk Processing**: Confirm conversational risk signals and contact status integrate into the assessment.
- [ ] **Live UI Score Updates**: Confirm that the client UI receives `voice:analysis-result` and updates the voice integrity gauge in real time.

---

## 17. Project Structure

```
Voice-Integrity-and-Real-Time-Authentication-VIRA-/
├── client/                               # Frontend Application (Vercel)
│   ├── src/
│   │   ├── audio/                        # Audio processing & VAD engines
│   │   │   ├── analysis/                 # RollingSpeechBuffer & windowing
│   │   │   └── vad/                      # Silero VAD ONNX & AudioWorklet
│   │   ├── components/                   # React UI components (Call, Modals)
│   │   ├── pages/                        # Home, VoiceEnrollment, LaunchingSoon, Admin
│   │   ├── services/                     # WebRTC, Socket.IO, Supabase, IndexedDB
│   │   └── utils/                        # Easy Mode English/Hindi translations
│   ├── package.json
│   └── vite.config.ts
│
├── server/                               # Backend Application (Render)
│   ├── src/
│   │   ├── audio/                        # Voice liveness & model adapters
│   │   │   └── voiceLiveness/            # Local AASIST, ECAPA, Wav2Vec2 adapters
│   │   ├── controllers/                  # Health & HTTP route handlers
│   │   ├── services/                     # remoteMl, voiceAuth, riskEngine, dataset
│   │   ├── sockets/                      # Socket.IO WebRTC signaling & chunk handlers
│   │   └── server.ts                     # Express application entry point
│   ├── models/                           # Local ONNX fallback models
│   └── package.json
│
├── ml-service/                           # ML Inference Service (Railway)
│   ├── app.py                            # FastAPI service (ECAPA + AASIST inference)
│   ├── test_app.py                       # Pytest test suite
│   ├── requirements.txt                  # Python dependencies (FastAPI, ONNX Runtime)
│   ├── Dockerfile                        # Railway container deployment specification
│   └── models/                           # ecapa.onnx and aasist.onnx
│
├── supabase/                             # Database Schemas & Migrations
│   ├── migrations/
│   │   ├── ensure_voice_profiles_schema.sql
│   │   └── cleanup_unused_tables.sql
│   ├── add_role_column.sql
│   ├── ml_dataset_schema.sql
│   └── schema.sql
│
├── package.json                          # Workspace orchestration (npm workspaces)
└── README.md                             # Project documentation
```

---

## 18. Current Implementation Status

To provide complete transparency regarding development status:

### Implemented & Fully Operational
* **Client-Side Speech Gating**: Silero VAD running in Web Audio AudioWorklet.
* **Rolling Speech Buffering**: 3.0s windowing with 1.5s overlap and 5.0s conversational pause retention.
* **WebRTC Voice Calling**: Browser-to-browser voice communication with Socket.IO signaling.
* **Railway ML Inference Service**: FastAPI service executing ECAPA-TDNN and AASIST on 16 kHz audio.
* **Biometric Voice ID**: 192-dimensional speaker embedding enrollment and 1:1 verification.
* **AASIST Anti-Spoofing**: Real-time detection of synthetic, vocoded, and clone speech.
* **Deepgram STT Integration**: Streaming speech-to-text with conversational risk keyword analysis.
* **On-Device Call Recording**: Local storage in browser IndexedDB with zero cloud audio uploads.
* **Role-Based Routing**: Admin dashboard access vs. Launching Soon page for standard users.
* **Accessibility**: Full Easy Mode support with verified English and Hindi translations.

### Scaffolded / In Active Development
* **XGBoost Risk Classifier**: The 12-dimensional feature vector extraction and fusion interface are complete and tested. However, the system currently operates in `CALIBRATED_BASELINE` mode using calibrated heuristic fusion while production training data is accumulated.
* **Wav2Vec2 Classifier**: Code architecture and pipeline integration are present in `wav2vec2AntiSpoof.ts`. Because a fine-tuned downstream classification checkpoint (`models/wav2vec2_antispoof.onnx`) is not bundled, the system explicitly operates in `NOT_READY` mode without fabricating scores.
* **Dataset Collection Pipeline**: Telemetry collection into `dataset_samples` and admin review interfaces are functional; continuous data labeling is ongoing.

---

## 19. Future Roadmap

The following tasks represent planned future enhancements:

* **Production XGBoost Training**: Train, evaluate, and benchmark the final non-linear XGBoost fusion model using labeled ground truth from the `dataset_samples` and `dataset_adjudications` pipeline.
* **Fine-Tuned Wav2Vec2 Checkpoint**: Train and deploy a fine-tuned downstream classification head on ASVspoof 2021 / In-the-Wild datasets to activate secondary anti-spoof verification.
* **Multilingual Risk NLP**: Expand conversational threat detection beyond English keyword heuristics into multilingual intent classification (including Hindi and regional languages).
* **Cross-Session Caller Trust Graphs**: Develop historical trust scores between known contacts to refine false-positive suppression over extended contact relationships.
* **Mobile Native Builds**: Finalize Capacitor mobile application wrappers for Android and iOS devices.

---

## 20. Disclaimer & License

### Disclaimer
**VIRA is a research and engineering security platform.** All voice integrity assessments, anti-spoof probabilities, speaker verification outcomes, and conversational risk ratings generated by VIRA are **probabilistic evaluations**, not deterministic guarantees. 

Voice characteristics can vary based on microphone hardware, network packet loss, acoustic reverberation, ambient background noise, and physical health conditions (e.g., vocal strain or illness). VIRA's scores should be treated as automated security assistance and decision support, not as definitive legal or biometric proof of identity or fraud.

### License
This project is licensed under the [MIT License](LICENSE).
