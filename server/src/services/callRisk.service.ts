import type { TranscriptSegment } from "./transcription.service";

export type RiskSignalType =
  | "MONEY_REQUEST"
  | "URGENCY"
  | "PAYMENT_REQUEST"
  | "CREDENTIAL_REQUEST"
  | "IMPERSONATION_SIGNAL"
  | "PRESSURE_TACTIC";

export type RiskLevel = "LOW RISK" | "MEDIUM RISK" | "HIGH RISK";

export interface RiskEvidenceSnippet {
  signal: RiskSignalType;
  snippet: string;
  matchedPattern: string;
  startTimeMs: number;
  endTimeMs: number;
  speakerDirection?: "local" | "remote";
}

export interface CallRiskAssessment {
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  primaryAssessment: string;
  detectedSignals: RiskSignalType[];
  evidence: RiskEvidenceSnippet[];
  signalCounts: Record<RiskSignalType, number>;
  callId: string;
  evaluatedAt: string;
  disclaimer: string;
}

interface PatternRule {
  signal: RiskSignalType;
  regex: RegExp;
  weight: number;
}

const RISK_PATTERNS: PatternRule[] = [
  // MONEY_REQUEST
  { signal: "MONEY_REQUEST", regex: /\b(wire\s*(money|transfer|funds)|transfer\s*money|send\s*(crypto|bitcoin|eth|funds|cash)|gift\s*cards?|western\s*union|moneygram|cash\s*app|zelle|venmo)\b/i, weight: 25 },
  { signal: "MONEY_REQUEST", regex: /\b(move\s*your\s*money|safe\s*account|temporary\s*holding\s*account)\b/i, weight: 35 },

  // URGENCY
  { signal: "URGENCY", regex: /\b(immediately|right\s*now|within\s*\d+\s*(minutes?|hours?)|urgent|emergency|act\s*fast|time\s*is\s*running\s*out|hurry|before\s*it's\s*too\s*late)\b/i, weight: 15 },
  { signal: "URGENCY", regex: /\b(cannot\s*wait|critical\s*deadline|final\s*notice)\b/i, weight: 20 },

  // PAYMENT_REQUEST
  { signal: "PAYMENT_REQUEST", regex: /\b(pay\s*(a\s*)?fee|settlement\s*fee|release\s*fee|clearing\s*fee|processing\s*fee|penalty\s*payment|outstanding\s*balance|overdue\s*fine)\b/i, weight: 25 },
  { signal: "PAYMENT_REQUEST", regex: /\b(unfreeze\s*(your\s*)?account\s*by\s*paying|pay\s*to\s*avoid)\b/i, weight: 30 },

  // CREDENTIAL_REQUEST
  { signal: "CREDENTIAL_REQUEST", regex: /\b(one[- ]time\s*(password|passcode)|otp|verification\s*code|security\s*code|pin\s*number|login\s*password|master\s*password)\b/i, weight: 35 },
  { signal: "CREDENTIAL_REQUEST", regex: /\b(read\s*(me\s*)?the\s*code|share\s*the\s*code|cvv|card\s*security\s*code|social\s*security\s*number|ssn)\b/i, weight: 40 },

  // IMPERSONATION_SIGNAL
  { signal: "IMPERSONATION_SIGNAL", regex: /\b(fraud\s*department|security\s*division|irs|internal\s*revenue|police\s*department|federal\s*agent|fbi|treasury\s*department|bank\s*investigator|microsoft\s*support|apple\s*security)\b/i, weight: 20 },
  { signal: "IMPERSONATION_SIGNAL", regex: /\b(calling\s*from\s*your\s*bank|official\s*representative|law\s*enforcement\s*officer)\b/i, weight: 20 },

  // PRESSURE_TACTIC
  { signal: "PRESSURE_TACTIC", regex: /\b(arrest\s*warrant|legal\s*action|police\s*will\s*arrive|freeze\s*all\s*(your\s*)?assets|account\s*suspended|face\s*consequences|prosecution)\b/i, weight: 30 },
  { signal: "PRESSURE_TACTIC", regex: /\b(do\s*not\s*hang\s*up|stay\s*on\s*the\s*line|do\s*not\s*tell\s*(anyone|your\s*family))\b/i, weight: 35 },
];

/**
 * Multi-Signal Social-Engineering, Urgency, & Financial Manipulation Analyzer.
 * Avoids simplistic single-keyword searching and provides explainable evidence snippets.
 */
export class CallRiskService {
  /**
   * Analyze an array of transcript segments for conversational manipulation signals.
   */
  public analyzeTranscript(callId: string, segments: TranscriptSegment[]): CallRiskAssessment {
    const evidence: RiskEvidenceSnippet[] = [];
    const detectedSet = new Set<RiskSignalType>();
    const signalCounts: Record<RiskSignalType, number> = {
      MONEY_REQUEST: 0,
      URGENCY: 0,
      PAYMENT_REQUEST: 0,
      CREDENTIAL_REQUEST: 0,
      IMPERSONATION_SIGNAL: 0,
      PRESSURE_TACTIC: 0,
    };

    let totalScore = 0;

    for (const segment of segments) {
      const text = segment.text;
      if (!text) continue;

      for (const rule of RISK_PATTERNS) {
        const match = rule.regex.exec(text);
        if (match) {
          detectedSet.add(rule.signal);
          signalCounts[rule.signal]++;
          totalScore += rule.weight;

          evidence.push({
            signal: rule.signal,
            snippet: segment.text,
            matchedPattern: match[0],
            startTimeMs: segment.startTimeMs,
            endTimeMs: segment.endTimeMs,
            speakerDirection: segment.speakerDirection,
          });
        }
      }
    }

    // Compound signal multipliers (e.g. Impersonation + Urgency + Credential is characteristic of high-pressure social engineering)
    if (signalCounts.CREDENTIAL_REQUEST > 0 && signalCounts.URGENCY > 0) {
      totalScore += 20;
    }
    if (signalCounts.IMPERSONATION_SIGNAL > 0 && signalCounts.MONEY_REQUEST > 0) {
      totalScore += 25;
    }
    if (signalCounts.PRESSURE_TACTIC > 0 && signalCounts.PAYMENT_REQUEST > 0) {
      totalScore += 25;
    }

    const clampedScore = Math.min(100, Math.max(0, totalScore));

    let riskLevel: RiskLevel = "LOW RISK";
    let primaryAssessment = "LOW RISK";

    if (clampedScore >= 60) {
      riskLevel = "HIGH RISK";
      if (signalCounts.CREDENTIAL_REQUEST > 0) {
        primaryAssessment = "POTENTIAL CREDENTIAL HARVESTING ATTEMPT";
      } else if (signalCounts.MONEY_REQUEST > 0 || signalCounts.PAYMENT_REQUEST > 0) {
        primaryAssessment = "POTENTIAL FINANCIAL MANIPULATION";
      } else {
        primaryAssessment = "HIGH RISK - POTENTIAL SOCIAL ENGINEERING";
      }
    } else if (clampedScore >= 30) {
      riskLevel = "MEDIUM RISK";
      if (signalCounts.URGENCY > 0 || signalCounts.PRESSURE_TACTIC > 0) {
        primaryAssessment = "POTENTIAL URGENCY/PRESSURE SIGNAL";
      } else {
        primaryAssessment = "MEDIUM RISK - SUSPICIOUS CONVERSATIONAL PATTERNS";
      }
    } else {
      riskLevel = "LOW RISK";
      primaryAssessment = "LOW RISK - NORMAL CONVERSATIONAL FLOW";
    }

    return {
      riskScore: clampedScore,
      riskLevel,
      primaryAssessment,
      detectedSignals: Array.from(detectedSet),
      evidence,
      signalCounts,
      callId,
      evaluatedAt: new Date().toISOString(),
      disclaimer: "Risk assistance advisory; not a legal, judicial, or criminal determination.",
    };
  }
}

export const callRiskService = new CallRiskService();
