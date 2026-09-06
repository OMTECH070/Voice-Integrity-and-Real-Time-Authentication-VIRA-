import { voiceAuthService } from "./voiceAuth.service";
import { voiceLivenessService } from "./voiceLiveness.service";
import { wav2vec2AntiSpoof } from "../audio/voiceLiveness/wav2vec2AntiSpoof";
import { xgboostIntegrityService } from "./xgboostIntegrity.service";
import { transcriptionService } from "./transcription.service";

export interface ModelDescriptor {
  name: string;
  version: string;
  type: "VAD" | "SPEAKER_EMBEDDING" | "ANTI_SPOOF" | "RISK_INTEGRITY" | "TRANSCRIPTION";
  path: string | null;
  enabled: boolean;
  status: "READY" | "NOT_READY" | "REQUIRES_CHECKPOINT" | "REQUIRES_API_KEY";
  details: string;
}

export class ModelManagerService {
  public getAllModelStatuses(): ModelDescriptor[] {
    const ecapaStatus = voiceAuthService.getModelStatus();
    const livenessStatus = voiceLivenessService.getModelStatus();
    const w2vStatus = wav2vec2AntiSpoof.getStatus();
    const xgbStatus = xgboostIntegrityService.getModelStatus();
    const transStatus = transcriptionService.getProviderStatus();

    return [
      {
        name: "Silero VAD",
        version: "v4-adaptive",
        type: "VAD",
        path: "client/src/audio/vad/adaptiveVad.ts",
        enabled: true,
        status: "READY",
        details: "Adaptive speech vs silence detection with 5s wait resilience and pre/post padding",
      },
      {
        name: "ECAPA-TDNN",
        version: ecapaStatus.modelVersion,
        type: "SPEAKER_EMBEDDING",
        path: "server/models/ecapa.onnx",
        enabled: true,
        status: ecapaStatus.available ? "READY" : "NOT_READY",
        details: "192-dimensional speaker embedding extraction and cosine similarity verification",
      },
      {
        name: "AASIST",
        version: livenessStatus.modelVersion,
        type: "ANTI_SPOOF",
        path: livenessStatus.modelPath,
        enabled: true,
        status: livenessStatus.available ? "READY" : "NOT_READY",
        details: "AASIST Graph Neural Network anti-spoofing for synthetic speech & replay attacks",
      },
      {
        name: "Wav2Vec2 Anti-Spoof Classifier",
        version: "Wav2Vec2-AntiSpoof-Head-v1",
        type: "ANTI_SPOOF",
        path: w2vStatus.modelPath,
        enabled: true,
        status: w2vStatus.ready ? "READY" : "REQUIRES_CHECKPOINT",
        details: w2vStatus.reason,
      },
      {
        name: "XGBoost Integrity & Risk Model",
        version: xgbStatus.modelVersion,
        type: "RISK_INTEGRITY",
        path: xgbStatus.modelPath,
        enabled: true,
        status: xgbStatus.isModelTrained ? "READY" : "REQUIRES_CHECKPOINT",
        details: xgbStatus.isModelTrained
          ? "Trained XGBoost model artifact loaded"
          : "Trained artifact missing; operating with calibrated deterministic multi-signal fusion",
      },
      {
        name: `Transcription (${transStatus.provider})`,
        version: transStatus.model,
        type: "TRANSCRIPTION",
        path: null,
        enabled: true,
        status: transStatus.ready ? "READY" : "REQUIRES_API_KEY",
        details: transStatus.ready
          ? `Active provider: ${transStatus.provider}`
          : `Requires TRANSCRIPTION_API_KEY in server/.env`,
      },
    ];
  }
}

export const modelManagerService = new ModelManagerService();
