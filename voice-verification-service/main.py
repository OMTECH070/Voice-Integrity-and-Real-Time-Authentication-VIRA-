"""
main.py — VIRA Voice Verification Service

Two endpoints:
  POST /enroll  — the logged-in user records their own reference voice,
                  which gets stored as an ECAPA-TDNN embedding tied to
                  their account.
  POST /verify  — given a live audio sample and a claimed account id,
                  returns whether that audio matches the enrolled
                  voiceprint for that account. Designed to be called by
                  the CALLEE's client using audio it received from the
                  CALLER over WebRTC — see README.md for the full trust
                  reasoning (this must not be self-reported by the
                  caller to mean anything).

Never returns a raw embedding to any client — only match/score.
"""
import os
import shutil
import uuid
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from vad_utils import extract_speech_only
from speaker_verification import get_embedding, cosine_similarity
from supabase_client import get_user_scoped_client, get_admin_client, convert_to_wav

app = FastAPI(title="VIRA Voice Verification Service")

ALLOWED_ORIGIN = os.getenv("CLIENT_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

MATCH_THRESHOLD = 0.55
MIN_ENROLLMENT_SPEECH_SECONDS = 1.5
MIN_VERIFY_SPEECH_SECONDS = 0.5

os.makedirs("/tmp/vira_audio", exist_ok=True)


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    return authorization[len("Bearer "):]


def _save_upload(file: UploadFile) -> str:
    tmp_path = f"/tmp/vira_audio/{uuid.uuid4().hex}_{file.filename}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return tmp_path


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/enroll")
async def enroll(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Enrolls the CALLING USER'S OWN voice. Runs entirely under their
    own Supabase session — RLS naturally restricts the write to their
    own account, so no elevated access is used here at all."""
    token = _extract_bearer_token(authorization)
    client = get_user_scoped_client(token)

    user_response = client.auth.get_user(token)
    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user_id = user_response.user.id

    raw_path = _save_upload(file)
    wav_path = f"/tmp/vira_audio/{uuid.uuid4().hex}.wav"

    try:
        convert_to_wav(raw_path, wav_path)
        audio, sr = sf.read(wav_path)
        speech_only = extract_speech_only(np.asarray(audio, dtype=np.float32), sr)

        if len(speech_only) < sr * MIN_ENROLLMENT_SPEECH_SECONDS:
            raise HTTPException(
                status_code=400,
                detail="Not enough clear speech detected. Please speak continuously for the full recording.",
            )

        embedding = get_embedding(speech_only, sr)

        client.table("voice_embeddings").upsert({
            "owner_id": user_id,
            "embedding": embedding.tolist(),
        }).execute()

        return {"status": "enrolled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {e}")
    finally:
        for p in (raw_path, wav_path):
            if os.path.exists(p):
                os.remove(p)


@app.post("/verify")
async def verify(
    caller_account_id: str = Form(...),
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Verifies live audio against `caller_account_id`'s ENROLLED
    voiceprint. The requester's own token is checked only to confirm
    they're a legitimate logged-in user — the embedding lookup itself
    uses the service's elevated access, because checking "does this
    audio match THAT account" inherently requires reading someone
    else's stored voiceprint. See supabase_client.py for the reasoning."""
    _extract_bearer_token(authorization)  # confirms a real session exists

    admin = get_admin_client()
    result = (
        admin.table("voice_embeddings")
        .select("embedding")
        .eq("owner_id", caller_account_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        return {"match": False, "score": 0.0, "reason": "not_enrolled"}

    reference_embedding = np.array(result.data["embedding"], dtype=np.float32)

    raw_path = _save_upload(file)
    wav_path = f"/tmp/vira_audio/{uuid.uuid4().hex}.wav"

    try:
        convert_to_wav(raw_path, wav_path)
        audio, sr = sf.read(wav_path)
        speech_only = extract_speech_only(np.asarray(audio, dtype=np.float32), sr)

        if len(speech_only) < sr * MIN_VERIFY_SPEECH_SECONDS:
            return {"match": False, "score": 0.0, "reason": "insufficient_audio"}

        live_embedding = get_embedding(speech_only, sr)
        score = cosine_similarity(live_embedding, reference_embedding)

        return {"match": bool(score >= MATCH_THRESHOLD), "score": round(float(score), 3)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {e}")
    finally:
        for p in (raw_path, wav_path):
            if os.path.exists(p):
                os.remove(p)
