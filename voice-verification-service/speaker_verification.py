"""
speaker_verification.py — Speaker verification using SpeechBrain's
pretrained ECAPA-TDNN (spkrec-ecapa-voxceleb).

Responsible for:
- Loading the ECAPA-TDNN model once
- Converting speech audio -> 192-dim embedding
- Comparing an embedding against an enrolled reference via cosine similarity
"""
import os
import numpy as np
import torch
import torchaudio

# --- Compatibility patch: torchaudio removed list_audio_backends() in
# version 2.9 (Oct 2025); audio backend handling moved to torchcodec.
# speechbrain (as of 1.0.x) still calls this function directly during
# its own internal setup, which crashes with:
#   AttributeError: module 'torchaudio' has no attribute 'list_audio_backends'
# This adds a harmless stand-in so that check doesn't crash, regardless
# of which torchaudio version ends up installed — pip resolution can
# drift over time even with pinned requirements, across platforms.
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]

_classifier = None
MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), "model_cache", "ecapa")


def load_speaker_model():
    global _classifier
    if _classifier is None:
        try:
            from speechbrain.inference.speaker import SpeakerRecognition
            _classifier = SpeakerRecognition.from_hparams(
                source=MODEL_SOURCE,
                savedir=MODEL_CACHE_DIR,
            )
        except Exception as e:
            raise RuntimeError(
                "Failed to load the ECAPA-TDNN speaker verification model. "
                "This usually means no internet connection on first run "
                "(the model must download once from Hugging Face).\n"
                f"Original error: {e}"
            )
    return _classifier


def get_embedding(audio_np: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """audio_np: 1D float32 numpy array of speech-only audio.
    Returns a 192-dim embedding as a numpy array."""
    model = load_speaker_model()
    audio_tensor = torch.from_numpy(audio_np.astype(np.float32)).unsqueeze(0)
    with torch.no_grad():
        embedding = model.encode_batch(audio_tensor)
    return embedding.squeeze().cpu().numpy()


def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    emb1 = emb1.flatten()
    emb2 = emb2.flatten()
    denom = (np.linalg.norm(emb1) * np.linalg.norm(emb2))
    if denom == 0:
        return 0.0
    return float(np.dot(emb1, emb2) / denom)


def verify_against_reference(
    audio_np: np.ndarray,
    reference_embedding: np.ndarray,
    sample_rate: int = 16000,
    threshold: float = 0.55,
):
    """Returns (is_match: bool, score: float)."""
    if len(audio_np) < sample_rate * 0.3:
        # Too short a clip to get a reliable embedding
        return False, 0.0
    emb = get_embedding(audio_np, sample_rate)
    score = cosine_similarity(emb, reference_embedding)
    return score >= threshold, score
