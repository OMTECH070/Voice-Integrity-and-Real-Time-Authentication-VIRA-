"""
Unit & Integration Tests for VIRA ML Inference Service.
Covers all 13 required test cases:
1. /health
2. ECAPA model loading
3. AASIST model loading
4. valid 16 kHz input
5. invalid input
6. empty input
7. incorrect sample rate
8. ECAPA embedding dimension = 192
9. ECAPA inference (deterministic and L2 normalized)
10. AASIST inference (valid float in [0, 1])
11. model-not-ready behavior (503 and degraded health)
12. authentication failure (401 on invalid/missing key)
13. no fake scores (deterministic model output, distinct across distinct inputs)
"""

import os
import base64
import numpy as np
import pytest
from starlette.testclient import TestClient

from app import app, engine, REQUIRED_SAMPLE_RATE


@pytest.fixture(scope="session", autouse=True)
def load_engine_models():
    """Ensure models are loaded for testing."""
    engine.load_models()


@pytest.fixture
def client():
    # Ensure no API key required by default
    old_key = os.environ.get("VIRA_ML_API_KEY")
    if "VIRA_ML_API_KEY" in os.environ:
        del os.environ["VIRA_ML_API_KEY"]
    
    with TestClient(app) as test_client:
        yield test_client

    if old_key is not None:
        os.environ["VIRA_ML_API_KEY"] = old_key


def generate_synthetic_tone(freq: float = 440.0, duration_sec: float = 3.0, sample_rate: int = 16000) -> np.ndarray:
    num_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, num_samples, endpoint=False, dtype=np.float32)
    tone = 0.5 * np.sin(2 * np.pi * freq * t)
    return tone.astype(np.float32)


# ==============================================================================
# 1. /health
# ==============================================================================
def test_1_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "vira-ml"
    assert data["ecapa"] is True
    assert data["aasist"] is True


# ==============================================================================
# 2. ECAPA model loading
# ==============================================================================
def test_2_ecapa_model_loading():
    assert engine.is_ecapa_ready is True
    assert engine.ecapa_session is not None
    assert engine.ecapa_error is None


# ==============================================================================
# 3. AASIST model loading
# ==============================================================================
def test_3_aasist_model_loading():
    assert engine.is_aasist_ready is True
    assert engine.aasist_session is not None
    assert engine.aasist_error is None


# ==============================================================================
# 4. Valid 16 kHz input
# ==============================================================================
def test_4_valid_16khz_input(client):
    samples = generate_synthetic_tone(440.0, 3.0, 16000)
    payload = {
        "sample_rate": 16000,
        "samples": samples.tolist(),
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["sample_rate"] == 16000
    assert data["sample_count"] == 48000
    assert data["duration_seconds"] == 3.0
    assert len(data["embedding"]) == 192
    assert 0.0 <= data["spoof_score"] <= 1.0


# ==============================================================================
# 5. Invalid input
# ==============================================================================
def test_5_invalid_input(client):
    # Case A: NaN values in audio (encoded via base64 float32)
    nan_bytes = np.array([0.0, np.nan, 0.1], dtype=np.float32).tobytes()
    nan_b64 = base64.b64encode(nan_bytes).decode("ascii")
    res1 = client.post("/analyze", json={"sample_rate": 16000, "pcm_base64": nan_b64})
    assert res1.status_code == 400
    assert "NaN or Inf" in res1.json()["detail"]

    # Case B: Corrupted base64
    res2 = client.post("/analyze", json={"sample_rate": 16000, "pcm_base64": "not_valid_base64_!!"})
    assert res2.status_code == 400

    # Case C: Missing audio fields
    res3 = client.post("/analyze", json={"sample_rate": 16000})
    assert res3.status_code == 400
    assert "Missing audio data" in res3.json()["detail"]

    # Case D: Non-numeric strings in samples list (pydantic validation error)
    res4 = client.post("/analyze", json={"sample_rate": 16000, "samples": ["not_a_number"]})
    assert res4.status_code == 422


# ==============================================================================
# 6. Empty input
# ==============================================================================
def test_6_empty_input(client):
    # Empty samples array
    res1 = client.post("/analyze", json={"sample_rate": 16000, "samples": []})
    assert res1.status_code == 400
    assert "Empty audio buffer" in res1.json()["detail"]

    # Empty base64 payload
    empty_b64 = base64.b64encode(b"").decode("ascii")
    res2 = client.post("/analyze", json={"sample_rate": 16000, "pcm_base64": empty_b64})
    assert res2.status_code == 400
    assert "Empty audio buffer" in res2.json()["detail"]


# ==============================================================================
# 7. Incorrect sample rate
# ==============================================================================
def test_7_incorrect_sample_rate(client):
    samples = [0.1] * 1000
    for bad_rate in [8000, 22050, 44100, 48000]:
        response = client.post("/analyze", json={"sample_rate": bad_rate, "samples": samples})
        assert response.status_code == 400
        assert "Invalid sample_rate" in response.json()["detail"]
        assert "16000" in response.json()["detail"]


# ==============================================================================
# 8. ECAPA embedding dimension = 192
# ==============================================================================
def test_8_ecapa_embedding_dimension(client):
    samples = generate_synthetic_tone(500.0, 3.0, 16000)
    response = client.post("/analyze", json={"sample_rate": 16000, "samples": samples.tolist()})
    assert response.status_code == 200
    data = response.json()
    emb = data["embedding"]
    assert len(emb) == 192
    assert data["embedding_dimension"] == 192

    # Verify L2 normalization: norm should equal ~1.0
    arr = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(arr)
    assert abs(norm - 1.0) < 1e-4


# ==============================================================================
# 9. ECAPA inference
# ==============================================================================
def test_9_ecapa_inference():
    audio1 = generate_synthetic_tone(300.0, 3.0, 16000)
    audio2 = generate_synthetic_tone(1200.0, 3.0, 16000)

    emb1 = np.array(engine.run_ecapa(audio1))
    emb2 = np.array(engine.run_ecapa(audio2))
    emb1_repeat = np.array(engine.run_ecapa(audio1))

    # Determinism check: identical audio produces identical embedding
    cos_self = np.dot(emb1, emb1_repeat) / (np.linalg.norm(emb1) * np.linalg.norm(emb1_repeat))
    assert cos_self > 0.9999

    # Separation check: different frequency tones produce distinct embeddings
    cos_diff = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
    assert cos_diff < 0.90


# ==============================================================================
# 10. AASIST inference
# ==============================================================================
def test_10_aasist_inference():
    audio = generate_synthetic_tone(440.0, 3.0, 16000)
    spoof_score = engine.run_aasist(audio)
    assert isinstance(spoof_score, float)
    assert 0.0 <= spoof_score <= 1.0


# ==============================================================================
# 11. Model-not-ready behavior
# ==============================================================================
def test_11_model_not_ready_behavior(client):
    # Temporarily stash sessions
    real_ecapa = engine.ecapa_session
    real_aasist = engine.aasist_session

    try:
        # Simulate unready ECAPA
        engine.ecapa_session = None
        engine.ecapa_error = "Mock unready ECAPA"

        # Check /health reports degraded
        h_res = client.get("/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] == "degraded"
        assert h_res.json()["ecapa"] is False

        # Check /analyze returns 503
        samples = [0.0] * 16000
        a_res = client.post("/analyze", json={"sample_rate": 16000, "samples": samples})
        assert a_res.status_code == 503
        assert "Models not ready" in a_res.json()["detail"]
    finally:
        # Restore sessions
        engine.ecapa_session = real_ecapa
        engine.aasist_session = real_aasist
        engine.ecapa_error = None
        engine.aasist_error = None


# ==============================================================================
# 12. Authentication failure
# ==============================================================================
def test_12_authentication_failure(client):
    secret_key = "production-super-secret-key-12345"
    os.environ["VIRA_ML_API_KEY"] = secret_key

    try:
        samples = generate_synthetic_tone(440.0, 1.0, 16000).tolist()
        payload = {"sample_rate": 16000, "samples": samples}

        # Case A: Request with no auth header -> 401
        res_no_auth = client.post("/analyze", json=payload)
        assert res_no_auth.status_code == 401
        assert "Unauthorized" in res_no_auth.json()["detail"]

        # Case B: Request with wrong X-API-Key -> 401
        res_wrong_key = client.post("/analyze", json=payload, headers={"X-API-Key": "wrong-key"})
        assert res_wrong_key.status_code == 401

        # Case C: Request with wrong Bearer token -> 401
        res_wrong_bearer = client.post("/analyze", json=payload, headers={"Authorization": "Bearer wrong-token"})
        assert res_wrong_bearer.status_code == 401

        # Case D: Request with correct X-API-Key -> 200
        res_correct_key = client.post("/analyze", json=payload, headers={"X-API-Key": secret_key})
        assert res_correct_key.status_code == 200

        # Case E: Request with correct Bearer token -> 200
        res_correct_bearer = client.post("/analyze", json=payload, headers={"Authorization": f"Bearer {secret_key}"})
        assert res_correct_bearer.status_code == 200

        # /health remains open for Railway liveness checks
        res_health = client.get("/health")
        assert res_health.status_code == 200
    finally:
        del os.environ["VIRA_ML_API_KEY"]


# ==============================================================================
# 13. No fake scores (deterministic model output, distinct across distinct inputs)
# ==============================================================================
def test_13_no_fake_scores(client):
    audio_a = generate_synthetic_tone(220.0, 3.0, 16000).tolist()
    audio_b = generate_synthetic_tone(1760.0, 3.0, 16000).tolist()

    res_a1 = client.post("/analyze", json={"sample_rate": 16000, "samples": audio_a})
    res_a2 = client.post("/analyze", json={"sample_rate": 16000, "samples": audio_a})
    res_b = client.post("/analyze", json={"sample_rate": 16000, "samples": audio_b})

    data_a1 = res_a1.json()
    data_a2 = res_a2.json()
    data_b = res_b.json()

    # Deterministic inference (identical input gives identical output, not random)
    assert data_a1["spoof_score"] == data_a2["spoof_score"]
    assert np.allclose(data_a1["embedding"], data_a2["embedding"], atol=1e-6)

    # Real model separation across distinct waveforms
    assert not np.allclose(data_a1["embedding"], data_b["embedding"], atol=1e-3)


# ==============================================================================
# Base64 PCM Input Test (bonus helper verification for Node.js backend)
# ==============================================================================
def test_base64_pcm_input(client):
    tone = generate_synthetic_tone(440.0, 3.0, 16000)
    raw_bytes = tone.tobytes()
    b64_str = base64.b64encode(raw_bytes).decode("ascii")

    res = client.post(
        "/analyze",
        json={
            "sample_rate": 16000,
            "pcm_base64": b64_str,
            "pcm_format": "f32le",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sample_count"] == 48000
    assert len(data["embedding"]) == 192
