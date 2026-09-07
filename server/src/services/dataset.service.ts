import { supabaseAdmin } from "./supabaseAdmin";
import { logger } from "../utils/logger";
import { XGBoostFeatures } from "./xgboostIntegrity.service";

export interface DatasetSampleRecord {
  id: string;
  call_id: string;
  session_id?: string;
  speaker_id?: string | null;
  speaker_direction: "local" | "remote";
  feature_vector: {
    ecapa_similarity: number | null;
    aasist_spoof_score: number;
    wav2vec2_anti_spoof_score: number | null;
    vad_speech_ratio: number;
    speech_duration_sec: number;
    transcript_risk_score: number;
    signal_money_request: number;
    signal_urgency: number;
    signal_credential_request: number;
    speaker_mismatch: number;
    audio_quality_snr: number;
    model_confidence: number;
  };
  feature_schema_version: string;
  ground_truth_status: string;
  ground_truth_label?: string | null;
  label_confidence?: string | null;
  reviewer_count: number;
  review_status: string; // 'PENDING_REVIEW' | 'UNDER_REVIEW' | 'INCLUDED' | 'EXCLUDED'
  consensus_status: string;
  dataset_split: string;
  exclusion_reason?: string | null;
  model_versions: Record<string, string>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatasetReviewRecord {
  id: string;
  sample_id: string;
  reviewer_id?: string;
  reviewer_identifier: string;
  identity_status: string;
  voice_authenticity: string;
  conversation_risk: string;
  money_request: string;
  urgency_pressure: string;
  credential_request: string;
  impersonation: string;
  overall_label: string;
  reviewer_confidence: string;
  notes?: string;
  created_at: string;
}

export interface DatasetStatistics {
  totalCandidates: number;
  pendingReview: number;
  underReview: number;
  labeled: number;
  qualityChecked: number;
  included: number;
  excluded: number;
  labelDistribution: Record<string, number>;
  voiceDistribution: Record<string, number>;
  threatDistribution: {
    moneyRequest: number;
    urgencyPressure: number;
    credentialRequest: number;
    impersonation: number;
  };
  reviewerAgreement: {
    agreementCount: number;
    disagreementCount: number;
    needsAdjudicationCount: number;
    adjudicatedCount: number;
    agreementRate: number;
  };
}

export class DatasetService {
  // In-memory cache of samples and reviews for resilience & instant retrieval
  private inMemorySamples = new Map<string, DatasetSampleRecord>();
  private inMemoryReviews = new Map<string, DatasetReviewRecord[]>();

  /**
   * Ingests a new candidate dataset sample from live call telemetry.
   */
  public async ingestSample(params: {
    callId: string;
    speakerId?: string | null;
    speakerDirection?: "local" | "remote";
    features: XGBoostFeatures;
    rawEcapaSimilarity?: number | null;
    hasEnrolledProfile?: boolean;
    audioQualitySnr?: number;
    modelConfidence?: number;
    modelVersions?: Record<string, string>;
    metadata?: Record<string, any>;
  }): Promise<DatasetSampleRecord> {
    const id = `sample-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const ecapaVal =
      params.hasEnrolledProfile && params.rawEcapaSimilarity !== undefined
        ? params.rawEcapaSimilarity
        : null;

    const sample: DatasetSampleRecord = {
      id,
      call_id: params.callId,
      speaker_id: params.speakerId ?? null,
      speaker_direction: params.speakerDirection ?? "remote",
      feature_vector: {
        ecapa_similarity: ecapaVal,
        aasist_spoof_score: params.features.aasistSpoofScore,
        wav2vec2_anti_spoof_score: params.features.wav2vec2SpoofScore,
        vad_speech_ratio: params.features.vadSpeechRatio,
        speech_duration_sec: params.features.speechDurationSec,
        transcript_risk_score: params.features.transcriptRiskScore,
        signal_money_request: params.features.hasMoneyRequest ? 1 : 0,
        signal_urgency: params.features.hasUrgencySignal ? 1 : 0,
        signal_credential_request: params.features.hasCredentialRequest ? 1 : 0,
        speaker_mismatch: params.features.isSpeakerMismatch ? 1 : 0,
        audio_quality_snr: params.audioQualitySnr ?? 25.0,
        model_confidence: params.modelConfidence ?? params.features.acousticConfidence,
      },
      feature_schema_version: "VIRA-12F-v1.0",
      ground_truth_status: "UNLABELED",
      ground_truth_label: null,
      label_confidence: null,
      reviewer_count: 0,
      review_status: "PENDING_REVIEW",
      consensus_status: "NO_REVIEWS",
      dataset_split: "TRAIN",
      exclusion_reason: null,
      model_versions: params.modelVersions ?? {
        aasist: "AASIST-v1",
        ecapa: "ECAPA-TDNN-v1",
        silero: "Silero-VAD-v5",
      },
      metadata: params.metadata ?? {},
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Store in-memory
    this.inMemorySamples.set(id, sample);

    // Persist to Supabase if configured
    try {
      if (supabaseAdmin) {
        await (supabaseAdmin as any)
          .from("dataset_samples")
          .insert({
            id: sample.id,
            call_id: sample.call_id,
            speaker_id: sample.speaker_id,
            speaker_direction: sample.speaker_direction,
            feature_vector: sample.feature_vector,
            feature_schema_version: sample.feature_schema_version,
            ground_truth_status: sample.ground_truth_status,
            reviewer_count: sample.reviewer_count,
            review_status: sample.review_status,
            consensus_status: sample.consensus_status,
            dataset_split: sample.dataset_split,
            model_versions: sample.model_versions,
            metadata: sample.metadata,
            created_at: sample.created_at,
            updated_at: sample.updated_at,
          });
      }
    } catch (err) {
      logger.warn(`DatasetService: Supabase insert fallback to in-memory: ${err}`);
    }

    logger.info(`DatasetService: Ingested candidate sample ${id} for call ${params.callId}`);
    return sample;
  }

  /**
   * Retrieves dataset statistics for admin dashboard metrics.
   */
  public async getStatistics(): Promise<DatasetStatistics> {
    const allSamples = Array.from(this.inMemorySamples.values());

    let pendingReview = 0;
    let underReview = 0;
    let labeled = 0;
    let included = 0;
    let excluded = 0;

    const labelDist: Record<string, number> = {
      LEGITIMATE: 0,
      SUSPICIOUS: 0,
      MALICIOUS: 0,
      INCONCLUSIVE: 0,
    };

    const voiceDist: Record<string, number> = {
      HUMAN: 0,
      SYNTHETIC: 0,
      VOICE_CONVERSION: 0,
      REPLAY: 0,
      UNKNOWN: 0,
    };

    const threatDist = {
      moneyRequest: 0,
      urgencyPressure: 0,
      credentialRequest: 0,
      impersonation: 0,
    };

    let agreementCount = 0;
    let disagreementCount = 0;
    let needsAdjudicationCount = 0;
    let adjudicatedCount = 0;

    for (const sample of allSamples) {
      if (sample.review_status === "PENDING_REVIEW") pendingReview++;
      else if (sample.review_status === "UNDER_REVIEW") underReview++;
      else if (sample.review_status === "INCLUDED") included++;
      else if (sample.review_status === "EXCLUDED") excluded++;

      if (sample.ground_truth_status === "LABELED" || sample.ground_truth_status === "ADJUDICATED") {
        labeled++;
        if (sample.ground_truth_label && labelDist[sample.ground_truth_label] !== undefined) {
          labelDist[sample.ground_truth_label]++;
        }
      }

      if (sample.consensus_status === "CONSENSUS") agreementCount++;
      else if (sample.consensus_status === "DISAGREEMENT") disagreementCount++;
      else if (sample.consensus_status === "ADJUDICATED") adjudicatedCount++;

      // Count observed threat signals in features
      if (sample.feature_vector.signal_money_request) threatDist.moneyRequest++;
      if (sample.feature_vector.signal_urgency) threatDist.urgencyPressure++;
      if (sample.feature_vector.signal_credential_request) threatDist.credentialRequest++;
    }

    const totalEvaluated = agreementCount + disagreementCount;
    const agreementRate = totalEvaluated > 0 ? agreementCount / totalEvaluated : 1.0;

    return {
      totalCandidates: allSamples.length,
      pendingReview,
      underReview,
      labeled,
      qualityChecked: included,
      included,
      excluded,
      labelDistribution: labelDist,
      voiceDistribution: voiceDist,
      threatDistribution: threatDist,
      reviewerAgreement: {
        agreementCount,
        disagreementCount,
        needsAdjudicationCount,
        adjudicatedCount,
        agreementRate,
      },
    };
  }

  /**
   * Retrieves samples matching an optional status filter.
   */
  public async getSamples(statusFilter?: string): Promise<DatasetSampleRecord[]> {
    const all = Array.from(this.inMemorySamples.values());
    if (!statusFilter || statusFilter === "ALL") {
      return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return all
      .filter((s) => s.review_status === statusFilter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Retrieves a single sample by ID along with its associated reviews.
   */
  public async getSampleById(sampleId: string): Promise<{
    sample: DatasetSampleRecord | null;
    reviews: DatasetReviewRecord[];
  }> {
    const sample = this.inMemorySamples.get(sampleId) ?? null;
    const reviews = this.inMemoryReviews.get(sampleId) ?? [];
    return { sample, reviews };
  }

  /**
   * Submits a human review for a sample.
   */
  public async submitReview(
    sampleId: string,
    reviewData: {
      reviewerId: string;
      identityStatus: string;
      voiceAuthenticity: string;
      conversationRisk: string;
      moneyRequest: string;
      urgencyPressure: string;
      credentialRequest: string;
      impersonation: string;
      overallLabel: string;
      reviewerConfidence: string;
      notes?: string;
    }
  ): Promise<DatasetReviewRecord> {
    const sample = this.inMemorySamples.get(sampleId);
    if (!sample) {
      throw new Error(`Sample with id ${sampleId} not found`);
    }

    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const review: DatasetReviewRecord = {
      id: reviewId,
      sample_id: sampleId,
      reviewer_identifier: reviewData.reviewerId,
      identity_status: reviewData.identityStatus,
      voice_authenticity: reviewData.voiceAuthenticity,
      conversation_risk: reviewData.conversationRisk,
      money_request: reviewData.moneyRequest,
      urgency_pressure: reviewData.urgencyPressure,
      credential_request: reviewData.credentialRequest,
      impersonation: reviewData.impersonation,
      overall_label: reviewData.overallLabel,
      reviewer_confidence: reviewData.reviewerConfidence,
      notes: reviewData.notes,
      created_at: nowIso,
    };

    let list = this.inMemoryReviews.get(sampleId);
    if (!list) {
      list = [];
      this.inMemoryReviews.set(sampleId, list);
    }
    list.push(review);

    // Update sample aggregation
    sample.reviewer_count = list.length;
    sample.ground_truth_label = reviewData.overallLabel;
    sample.ground_truth_status = "LABELED";
    sample.label_confidence = reviewData.reviewerConfidence;
    sample.review_status = "UNDER_REVIEW";
    sample.consensus_status = list.length === 1 ? "SINGLE_REVIEW" : "CONSENSUS";
    sample.updated_at = nowIso;

    logger.info(`DatasetService: Submitted review ${reviewId} for sample ${sampleId}`);
    return review;
  }

  /**
   * Promotes a verified sample to INCLUDED in the training set.
   */
  public async qualityCheckSample(sampleId: string): Promise<DatasetSampleRecord> {
    const sample = this.inMemorySamples.get(sampleId);
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }
    sample.review_status = "INCLUDED";
    sample.updated_at = new Date().toISOString();
    return sample;
  }

  /**
   * Excludes a sample from dataset with a specific reason.
   */
  public async excludeSample(sampleId: string, reason: string): Promise<DatasetSampleRecord> {
    const sample = this.inMemorySamples.get(sampleId);
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }
    sample.review_status = "EXCLUDED";
    sample.exclusion_reason = reason;
    sample.updated_at = new Date().toISOString();
    return sample;
  }

  /**
   * Exports dataset in JSONL format for reproducible ML training.
   */
  public exportJSONL(onlyIncluded = false): string {
    let samples = Array.from(this.inMemorySamples.values());
    if (onlyIncluded) {
      samples = samples.filter((s) => s.review_status === "INCLUDED");
    }
    return samples.map((s) => JSON.stringify(s)).join("\n");
  }

  /**
   * Exports dataset in CSV format.
   */
  public exportCSV(onlyIncluded = false): string {
    let samples = Array.from(this.inMemorySamples.values());
    if (onlyIncluded) {
      samples = samples.filter((s) => s.review_status === "INCLUDED");
    }

    const headers = [
      "sample_id",
      "call_id",
      "created_at",
      "review_status",
      "ground_truth_label",
      "label_confidence",
      "ecapa_similarity",
      "aasist_spoof_score",
      "wav2vec2_anti_spoof_score",
      "vad_speech_ratio",
      "speech_duration_sec",
      "transcript_risk_score",
      "signal_money_request",
      "signal_urgency",
      "signal_credential_request",
      "speaker_mismatch",
      "audio_quality_snr",
      "model_confidence",
    ];

    const rows = samples.map((s) => [
      s.id,
      s.call_id,
      s.created_at,
      s.review_status,
      s.ground_truth_label ?? "",
      s.label_confidence ?? "",
      s.feature_vector.ecapa_similarity !== null ? s.feature_vector.ecapa_similarity : "",
      s.feature_vector.aasist_spoof_score,
      s.feature_vector.wav2vec2_anti_spoof_score !== null ? s.feature_vector.wav2vec2_anti_spoof_score : "",
      s.feature_vector.vad_speech_ratio,
      s.feature_vector.speech_duration_sec,
      s.feature_vector.transcript_risk_score,
      s.feature_vector.signal_money_request,
      s.feature_vector.signal_urgency,
      s.feature_vector.signal_credential_request,
      s.feature_vector.speaker_mismatch,
      s.feature_vector.audio_quality_snr,
      s.feature_vector.model_confidence,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}

export const datasetService = new DatasetService();
