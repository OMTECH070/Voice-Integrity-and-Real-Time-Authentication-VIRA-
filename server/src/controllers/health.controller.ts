import { Request, Response } from "express";
import { voiceLivenessService } from "../services/voiceLiveness.service";
import { voiceAuthService } from "../services/voiceAuth.service";

export function healthCheck(_req: Request, res: Response): void {
  const aasistReady = voiceLivenessService.isReady();
  const ecapaReady = voiceAuthService.isReady();
  res.status(200).json({
    status: "ok",
    service: "vira-server",
    uptimeSeconds: Math.floor(process.uptime()),
    models: {
      aasist: {
        ready: aasistReady,
        version: "AASIST-v1",
      },
      ecapa: {
        ready: ecapaReady,
        version: "ECAPA-TDNN-v1",
      },
    },
  });
}

