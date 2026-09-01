"""
vad_utils.py — Voice Activity Detection wrapper around Silero VAD.

Responsible for:
- Loading the Silero VAD model once (cached after first download)
- Given a buffer of audio samples, returning which parts are speech
- Providing a simple is_speech(chunk) check for real-time streaming use
"""
import numpy as np
import torch

_model = None
_utils = None
SAMPLE_RATE = 16000


def load_vad_model():
    """Loads Silero VAD once and caches it in memory for the process lifetime.
    First call downloads the model (needs internet); subsequent calls on the
    same machine use torch.hub's local cache (~/.cache/torch/hub)."""
    global _model, _utils
    if _model is None:
        try:
            _model, _utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=False,
                trust_repo=True,
            )
        except Exception as e:
            raise RuntimeError(
                "Failed to load Silero VAD model. This usually means no "
                "internet connection on first run (the model must download "
                "once). Check your connection and try again.\n"
                f"Original error: {e}"
            )
    return _model, _utils


def get_speech_timestamps(audio_np: np.ndarray, sample_rate: int = SAMPLE_RATE):
    """audio_np: 1D float32 numpy array, values in [-1, 1].
    Returns list of dicts: [{'start': sample_idx, 'end': sample_idx}, ...]
    """
    model, utils = load_vad_model()
    get_speech_ts_fn = utils[0]
    audio_tensor = torch.from_numpy(audio_np.astype(np.float32))
    return get_speech_ts_fn(audio_tensor, model, sampling_rate=sample_rate)


def is_speech_present(audio_np: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bool:
    """Quick boolean check: does this chunk contain any detected speech?"""
    timestamps = get_speech_timestamps(audio_np, sample_rate)
    return len(timestamps) > 0


def extract_speech_only(audio_np: np.ndarray, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """Returns a new array containing only the speech portions, concatenated,
    with silence removed."""
    timestamps = get_speech_timestamps(audio_np, sample_rate)
    if not timestamps:
        return np.array([], dtype=np.float32)
    segments = [audio_np[ts["start"]:ts["end"]] for ts in timestamps]
    return np.concatenate(segments)
