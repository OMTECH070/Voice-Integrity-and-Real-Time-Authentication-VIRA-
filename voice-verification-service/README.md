# VIRA Voice Verification Service

Standalone Python service: VAD (Silero) + ECAPA-TDNN speaker verification
(SpeechBrain). Reuses the exact VAD/ECAPA code already built and tested in
the standalone `deepfake-voice-detector` project.

## Why this is a separate service

The Node/Express/Socket.IO server handles call signaling only — it was
never meant to run heavy Python ML models. This service is deployed
independently (recommended: Hugging Face Spaces, since it's built for
exactly this "expose a model behind a URL" use case and needs no AWS/Azure
knowledge) and the client talks to it directly over HTTP.

## The trust model (read this before changing anything)

- **`/enroll`** runs under the enrolling user's OWN Supabase session
  (their JWT). Row Level Security naturally restricts this to writing
  their own row — no elevated access needed or used.
- **`/verify`** is called by the CALLEE's client, using audio the callee
  already legitimately received over WebRTC from the caller — never
  audio or a result self-reported by the caller. The service uses its
  elevated `service_role` key ONLY to read the claimed caller's stored
  embedding (the one legitimate cross-user read this service needs — see
  `supabase_client.py`). The raw embedding is never returned to any
  client; only a match boolean and a similarity score.

This matters: if verification were driven by the caller's own client, a
malicious or stolen-and-still-logged-in device could simply lie about
passing. Driving it from the callee's side, using audio the callee
independently captured, closes that gap.

## Local setup

```bash
pip install -r requirements.txt
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
export SUPABASE_URL=https://your-project-ref.supabase.co
export SUPABASE_ANON_KEY=your-anon-public-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
uvicorn main:app --reload --port 8001
```

## Deploying to Hugging Face Spaces (recommended, free)

1. Create a Space at huggingface.co/spaces → **Docker** SDK
2. Push this folder's contents to the Space's git repo (Spaces work like
   a git remote — `git remote add space <space-git-url>`, then push)
3. In the Space's **Settings → Repository secrets**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLIENT_ORIGIN` (your Vercel URL, for CORS)
4. The Space builds automatically. Your service URL will be something
   like `https://your-username-your-space-name.hf.space`

**Set expectations:** free Spaces sleep after inactivity, similar to
Render's free tier — the first request after idle time can take 30-60+
seconds while it wakes up and loads the ECAPA-TDNN model into memory.
This is fine for testing, worth knowing before you assume something's
broken.

## Client configuration

In `client/.env`:
```
VITE_VOICE_VERIFICATION_URL=https://your-username-your-space-name.hf.space
```

## Required Supabase setup

Run `supabase/voice_embeddings_schema.sql` (in the main VIRA project) once
in the SQL Editor before using this service — it creates the
`voice_embeddings` table and its RLS policies.
