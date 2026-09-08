# ==============================================================================
# VIRA ML Service — Dockerfile for Railway
# ==============================================================================
FROM python:3.11-slim

# Python configuration
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# System dependencies for runtime and health probing
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Copy ONNX models
COPY models/ ./models/

# Document default port
EXPOSE 8000

# Listen on dynamic $PORT provided by Railway (defaulting to 8000)
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info
