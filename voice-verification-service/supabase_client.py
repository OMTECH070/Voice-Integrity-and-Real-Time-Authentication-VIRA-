"""
supabase_client.py — two deliberately different ways of talking to
Supabase from this service, matching two different trust levels:

- get_user_scoped_client(): makes requests AS the calling user (their
  own JWT), so Row Level Security applies exactly as it would for any
  normal client request. Used for enrollment — writing your OWN
  voiceprint is safe under ordinary RLS, no special access needed.

- get_admin_client(): uses the service_role key, which BYPASSES RLS
  entirely. Used ONLY inside the /verify endpoint's one legitimate
  cross-user read (checking a caller's audio against THEIR stored
  embedding, on behalf of the person receiving the call — see main.py
  for the full reasoning). Never used for writes in this service.
"""
import os
import subprocess

from dotenv import load_dotenv
from supabase import create_client, Client

# Loads variables from a .env file in this folder, if one exists.
# On Hugging Face Spaces (or any real deployment), you won't have a
# .env file — you'll set these as actual environment variables /
# repository secrets instead, and load_dotenv() simply does nothing in
# that case (no .env file to find), which is exactly the behavior you
# want: same code works both ways.
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY. "
        "Set them in this service's environment before starting."
    )


def get_user_scoped_client(user_jwt: str) -> Client:
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(user_jwt)
    return client


def get_admin_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def convert_to_wav(input_path: str, output_path: str, sample_rate: int = 16000) -> None:
    """Browser MediaRecorder output (webm/opus) -> mono 16kHz WAV, which
    both Silero VAD and ECAPA-TDNN expect."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ac", "1", "-ar", str(sample_rate),
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
