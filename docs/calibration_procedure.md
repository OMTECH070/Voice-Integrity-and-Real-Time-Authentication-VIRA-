# VIRA Voice Integrity Calibration & Validation Procedure

## 1. Overview & Objective

VIRA uses a dual-model biometric integrity system:
1. **AASIST (ONNX)**: Evaluates raw waveform spectral artifacts to estimate spoof/AI probability.
2. **ECAPA-TDNN (ONNX)**: Extracts 192-dimensional speaker embeddings to compute cosine similarity between the enrolled speaker and the active remote caller.

Because raw cosine similarity distributions vary significantly based on acoustic environments, microphone responses, and transmission codecs (such as WebRTC Opus compression), decision boundaries must be empirically calibrated rather than guessed.

---

## 2. Dataset Collection Protocol

To calibrate VIRA for a target deployment environment, collect audio test pairs across two primary groups:

### Group A: Genuine Pairs (Same Enrolled Speaker)
* **Intra-speaker variations**:
  * Different sentences and phoneme coverage (e.g., phonetically rich sentences from TIMIT / Harvard sentences).
  * Different vocal effort levels: Normal conversational speech, whispered, excited/elevated pitch.
  * Different physical distances: Close microphone (5–10 cm) vs distant microphone (50–100 cm).
  * Different microphone hardware: Laptop internal array, USB condenser, Bluetooth headset.
  * Different acoustic noise floors: Clean room ($SNR > 30\text{ dB}$), air conditioning/fan hum ($SNR \sim 15\text{ dB}$), cafeteria background ($SNR \sim 10\text{ dB}$).
* **Pair Combinations**: $(A_1, A_2), (A_1, A_3), (A_2, A_3), \dots$

### Group B: Impostor Pairs (Different Speakers)
* **Cross-speaker combinations**:
  * Cross-gender pairs: Male vs Female speakers.
  * Same-gender pairs with similar pitch/formants: Male A vs Male B, Female A vs Female B.
  * Age variations: Adult vs Child voices.
* **Pair Combinations**: $(A_1, B_1), (A_1, C_1), (B_1, C_1), \dots$

---

## 3. Metric Definitions & Tradeoffs

For any chosen threshold $\theta \in [-1.0, 1.0]$:

1. **False Acceptance Rate (FAR)**:
   $$\text{FAR}(\theta) = \frac{\text{Number of impostor pairs with similarity } \ge \theta}{\text{Total number of impostor pairs}}$$
   *Impact*: High FAR means an unauthorized caller or impostor may be incorrectly accepted as the verified enrolled contact.

2. **False Rejection Rate (FRR)**:
   $$\text{FRR}(\theta) = \frac{\text{Number of genuine pairs with similarity } < \theta}{\text{Total number of genuine pairs}}$$
   *Impact*: High FRR means a legitimate user may be flagged as a mismatch due to minor vocal fatigue or background noise.

3. **Equal Error Rate (EER)**:
   The operating point $\theta_{\text{EER}}$ where $\text{FAR}(\theta_{\text{EER}}) = \text{FRR}(\theta_{\text{EER}})$.

---

## 4. Calibrated Operating Thresholds for VIRA

Based on empirical testing with SpeechBrain ECAPA-TDNN embeddings:

| Parameter | Calibrated Default | Config Environment Variable | Description |
|---|---|---|---|
| `ECAPA_MATCH_THRESHOLD` | **0.92** | `VIRA_ECAPA_MATCH_THRESH` | Strict genuine speaker match threshold ($\text{FAR} < 1\%$). |
| `ECAPA_UNCERTAIN_THRESHOLD` | **0.82** | `VIRA_ECAPA_UNCERTAIN_THRESH` | Boundary between uncertain speech and definite mismatch. |
| `ECAPA_MISMATCH_THRESHOLD` | **0.82** | `VIRA_ECAPA_MISMATCH_THRESH` | Scores below 0.82 indicate speaker identity mismatch. |
| `AASIST_SPOOF_THRESHOLD` | **0.70** | `VIRA_AASIST_SPOOF_THRESH` | Probabilistic threshold for possible AI/synthetic voice. |
| `AASIST_LIVE_THRESHOLD` | **0.55** | `VIRA_AASIST_LIVE_THRESH` | Probabilistic threshold for live human speech. |
| `TEMPORAL_WINDOW_DEPTH` | **5** | N/A | Retains 5 recent windows for majority agreement. |
| `TEMPORAL_AGREEMENT_REQUIRED` | **2** | N/A | Consecutive consistent windows required to change status. |

---

## 5. Decision Matrix

| AASIST Spoof Label | ECAPA Speaker Label | Fused Integrity Status | UI Badge | Rationale |
|---|---|---|---|---|
| `live` ($\le 0.55$) | `match` ($\ge 0.92$) | `human-verified` | 🟢 Green | Live human speech matching enrolled contact. |
| `live` ($\le 0.55$) | `likely-match` ($0.82 - 0.92$) | `human-verified` | 🟢 Green | Live human speech with high acoustic similarity. |
| `live` ($\le 0.55$) | `mismatch` ($< 0.82$) | `speaker-mismatch` | 🟠 Orange | Live human speech, but different person than enrolled contact. |
| `live` ($\le 0.55$) | `not-enrolled` | `human-verified` | 🟢 Green | Live human speech (no baseline contact profile registered). |
| `likely-synthetic` ($\ge 0.70$) | `match` / `likely-match` | `possible-ai` | 🔴 Red | High-risk voice clone attack targeting enrolled identity. |
| `likely-synthetic` ($\ge 0.70$) | `mismatch` / `not-enrolled` | `possible-ai` | 🔴 Red | Synthetic/AI-generated or spoofed audio stream detected. |
| `uncertain` ($0.55 - 0.70$) | Any | `uncertain` | 🟡 Yellow | Inconclusive spectral features or high noise floor. |
