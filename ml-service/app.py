"""
VIRA ML Service — Isolated Inference Layer for ECAPA-TDNN & AASIST.
Designed for server-to-server deployment on Railway.

Endpoints:
  GET  /health  — Healthcheck and model readiness probe (used by Railway).
  POST /analyze — Runs ECAPA-TDNN (192-dim embedding) and AASIST (spoof score)
                  on a 16kHz speech analysis window.
"""

import base64
import os
import time
from contextlib import asynccontextmanager
from typing import List, Optional

import numpy as np
import onnxruntime as ort
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ==============================================================================
# Configuration & Constants
# ==============================================================================
REQUIRED_SAMPLE_RATE = 16000
AASIST_REQUIRED_INPUT_LENGTH = 64600  # 64,600 samples @ 16kHz (~4.0375s)
EXPECTED_EMBEDDING_DIM = 192

# Optional server-to-server shared secret for Render -> Railway communication
API_KEY_ENV = os.getenv("VIRA_ML_API_KEY", "").strip()


# ==============================================================================
# Model Engine (Singleton Lifecycle)
# ==============================================================================
class ModelEngine:
    def __init__(self):
        self.ecapa_session: Optional[ort.InferenceSession] = None
        self.aasist_session: Optional[ort.InferenceSession] = None
        self.ecapa_input_name: str = "audio_input"
        self.ecapa_output_name: str = "embedding_output"
        self.aasist_input_name: str = "input"
        self.aasist_output_name: str = "spoof_prob"
        self.ecapa_error: Optional[str] = None
        self.aasist_error: Optional[str] = None

    def resolve_model_path(self, filename: str) -> Optional[str]:
        candidates = [
            os.path.join(os.path.dirname(__file__), "models", filename),
            os.path.join(os.getcwd(), "models", filename),
            os.path.join(os.getcwd(), "ml-service", "models", filename),
            os.path.join(os.getcwd(), "server", "models", filename),
            os.path.join(os.path.dirname(__file__), "..", "server", "models", filename),
        ]
        for path in candidates:
            normalized = os.path.normpath(path)
            if os.path.isfile(normalized):
                return normalized
        return None

    def load_models(self) -> None:
        # 1. ECAPA-TDNN
        ecapa_path = self.resolve_model_path("ecapa.onnx")
        if ecapa_path:
            try:
                opts = ort.SessionOptions()
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.ecapa_session = ort.InferenceSession(ecapa_path, opts, providers=["CPUExecutionProvider"])
                inputs = self.ecapa_session.get_inputs()
                outputs = self.ecapa_session.get_outputs()
                if inputs:
                    self.ecapa_input_name = inputs[0].name
                if outputs:
                    self.ecapa_output_name = outputs[0].name
                self.ecapa_error = None
            except Exception as e:
                self.ecapa_session = None
                self.ecapa_error = str(e)
        else:
            self.ecapa_session = None
            self.ecapa_error = "ecapa.onnx not found in models/"

        # 2. AASIST
        aasist_path = self.resolve_model_path("aasist.onnx")
        if aasist_path:
            try:
                opts = ort.SessionOptions()
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.aasist_session = ort.InferenceSession(aasist_path, opts, providers=["CPUExecutionProvider"])
                inputs = self.aasist_session.get_inputs()
                outputs = self.aasist_session.get_outputs()
                if inputs:
                    self.aasist_input_name = inputs[0].name
                if outputs:
                    self.aasist_output_name = outputs[0].name
                self.aasist_error = None
            except Exception as e:
                self.aasist_session = None
                self.aasist_error = str(e)
        else:
            self.aasist_session = None
            self.aasist_error = "aasist.onnx not found in models/"

    @property
    def is_ecapa_ready(self) -> bool:
        return self.ecapa_session is not None

    @property
    def is_aasist_ready(self) -> bool:
        return self.aasist_session is not None

    def run_ecapa(self, samples: np.ndarray) -> List[float]:
        if not self.ecapa_session:
            raise RuntimeError(f"ECAPA model not ready: {self.ecapa_error}")

        # Input shape: [1, num_samples]
        tensor_in = samples.astype(np.float32).reshape(1, -1)
        outputs = self.ecapa_session.run(
            [self.ecapa_output_name],
            {self.ecapa_input_name: tensor_in},
        )
        raw_out = outputs[0].reshape(-1)

        # L2 normalize
        norm = float(np.linalg.norm(raw_out)) + 1e-12
        normalized = raw_out / norm
        return normalized.astype(float).tolist()

    def run_aasist(self, samples: np.ndarray) -> float:
        if not self.aasist_session:
            raise RuntimeError(f"AASIST model not ready: {self.aasist_error}")

        # AASIST requires exactly 64,600 samples @ 16kHz
        # Fit by tiling or cropping (matches production AASIST pad() and fitToLength)
        n = len(samples)
        if n == AASIST_REQUIRED_INPUT_LENGTH:
            fitted = samples.astype(np.float32)
        elif n > AASIST_REQUIRED_INPUT_LENGTH:
            fitted = samples[:AASIST_REQUIRED_INPUT_LENGTH].astype(np.float32)
        else:
            repeats = int(np.ceil(AASIST_REQUIRED_INPUT_LENGTH / max(1, n)))
            fitted = np.tile(samples, repeats)[:AASIST_REQUIRED_INPUT_LENGTH].astype(np.float32)

        tensor_in = fitted.reshape(1, -1)
        outputs = self.aasist_session.run(
            [self.aasist_output_name],
            {self.aasist_input_name: tensor_in},
        )
        raw_out = outputs[0].reshape(-1)

        # Handle scalar probability or 2-class logits
        if len(raw_out) == 1:
            spoof_prob = float(raw_out[0])
        elif len(raw_out) == 2:
            # [live_logit, spoof_logit] -> softmax
            live_logit, spoof_logit = float(raw_out[0]), float(raw_out[1])
            max_logit = max(live_logit, spoof_logit)
            exp_live = np.exp(live_logit - max_logit)
            exp_spoof = np.exp(spoof_logit - max_logit)
            spoof_prob = float(exp_spoof / (exp_live + exp_spoof))
        else:
            spoof_prob = float(raw_out[0])

        return float(np.clip(spoof_prob, 0.0, 1.0))


engine = ModelEngine()


# ==============================================================================
# Lifespan
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly load models once at service startup
    engine.load_models()
    yield


# ==============================================================================
# FastAPI Application
# ==============================================================================
app = FastAPI(
    title="VIRA ML Inference Service",
    description="Dedicated server-to-server ML inference for ECAPA-TDNN and AASIST",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ==============================================================================
# Authentication Dependency
# ==============================================================================
def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
) -> None:
    # If VIRA_ML_API_KEY is configured in env, strictly require matching token
    secret = os.getenv("VIRA_ML_API_KEY", "").strip()
    if not secret:
        return  # No secret set; open for internal networking / development

    # Check X-API-Key
    if x_api_key and x_api_key == secret:
        return

    # Check Bearer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
        if token == secret:
            return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Missing or invalid API key",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ==============================================================================
# Schemas
# ==============================================================================
class AnalyzeRequest(BaseModel):
    sample_rate: int = Field(..., description="Audio sample rate (must be 16000)")
    samples: Optional[List[float]] = Field(
        None, description="Array of PCM float samples normalized in [-1.0, 1.0]"
    )
    pcm_base64: Optional[str] = Field(
        None, description="Base64-encoded binary PCM data (Float32LE or Int16LE)"
    )
    pcm_format: Optional[str] = Field(
        "f32le", description="PCM format when using pcm_base64: 'f32le' (default) or 's16le'"
    )


class AnalyzeResponse(BaseModel):
    status: str
    embedding: List[float]
    embedding_dimension: int
    spoof_score: float
    sample_rate: int
    sample_count: int
    duration_seconds: float
    inference_latency_ms: float


class HealthResponse(BaseModel):
    status: str
    service: str
    ecapa: bool
    aasist: bool


# ==============================================================================
# Routes
# ==============================================================================
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check reflecting actual loaded model states."""
    ecapa_ok = engine.is_ecapa_ready
    aasist_ok = engine.is_aasist_ready

    status_str = "ok" if (ecapa_ok and aasist_ok) else "degraded"
    return HealthResponse(
        status=status_str,
        service="vira-ml",
        ecapa=ecapa_ok,
        aasist=aasist_ok,
    )


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(verify_api_key)])
async def analyze_speech(payload: AnalyzeRequest):
    """
    Accepts speech-only 16kHz audio chunk (approx 3.0s, 48000 samples).
    Runs:
      - ECAPA-TDNN -> 192-dim normalized speaker embedding
      - AASIST     -> real calibrated spoof probability score
    """
    start_time = time.perf_counter()

    # 1. Validate sample rate
    if payload.sample_rate != REQUIRED_SAMPLE_RATE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sample_rate: expected {REQUIRED_SAMPLE_RATE} Hz, got {payload.sample_rate} Hz",
        )

    # 2. Extract numpy audio buffer
    audio_samples: Optional[np.ndarray] = None

    if payload.samples is not None:
        if len(payload.samples) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio buffer: 'samples' list contains 0 items",
            )
        audio_samples = np.array(payload.samples, dtype=np.float32)

    elif payload.pcm_base64 is not None:
        try:
            raw_bytes = base64.b64decode(payload.pcm_base64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 payload in 'pcm_base64'",
            )

        if len(raw_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio buffer: decoded 'pcm_base64' contains 0 bytes",
            )

        fmt = (payload.pcm_format or "f32le").lower()
        if fmt in ("s16le", "int16"):
            int_data = np.frombuffer(raw_bytes, dtype=np.int16)
            audio_samples = int_data.astype(np.float32) / 32768.0
        else:
            audio_samples = np.frombuffer(raw_bytes, dtype=np.float32).copy()

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing audio data: provide either 'samples' (list of floats) or 'pcm_base64'",
        )

    # 3. Sanity checks on audio
    if len(audio_samples) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio buffer is empty after decoding",
        )

    if not np.all(np.isfinite(audio_samples)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio buffer contains invalid values (NaN or Inf)",
        )

    # 4. Check model readiness
    if not engine.is_ecapa_ready or not engine.is_aasist_ready:
        missing = []
        if not engine.is_ecapa_ready:
            missing.append(f"ECAPA ({engine.ecapa_error})")
        if not engine.is_aasist_ready:
            missing.append(f"AASIST ({engine.aasist_error})")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Models not ready: {', '.join(missing)}",
        )

    # 5. Run Inferences
    try:
        embedding = engine.run_ecapa(audio_samples)
        spoof_score = engine.run_aasist(audio_samples)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(e)}",
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0
    sample_count = len(audio_samples)
    duration_sec = sample_count / float(REQUIRED_SAMPLE_RATE)

    return AnalyzeResponse(
        status="success",
        embedding=embedding,
        embedding_dimension=len(embedding),
        spoof_score=spoof_score,
        sample_rate=REQUIRED_SAMPLE_RATE,
        sample_count=sample_count,
        duration_seconds=round(duration_sec, 4),
        inference_latency_ms=round(elapsed_ms, 2),
    )


# ==============================================================================
# Standalone Runner
# ==============================================================================
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")
