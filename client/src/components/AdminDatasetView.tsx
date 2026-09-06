import React, { useState, useEffect, useCallback } from "react";
import { UseAuthResult } from "../hooks/useAuth";

interface AdminDatasetViewProps {
  auth: UseAuthResult;
  onBack: () => void;
}

interface DatasetSample {
  id: string;
  call_id: string;
  session_id?: string;
  created_at: string;
  feature_vector: {
    ecapa_similarity: number;
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
  review_status: string;
  consensus_status: string;
  dataset_split: string;
  exclusion_reason?: string | null;
  model_versions: Record<string, string>;
  metadata: Record<string, any>;
}

interface DatasetReview {
  id: string;
  reviewer_id: string;
  created_at: string;
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
}

interface DatasetStats {
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

export const AdminDatasetView: React.FC<AdminDatasetViewProps> = ({ auth, onBack }) => {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [selectedSample, setSelectedSample] = useState<DatasetSample | null>(null);
  const [sampleReviews, setSampleReviews] = useState<DatasetReview[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Labeling form state
  const [identityStatus, setIdentityStatus] = useState<string>("MATCH");
  const [voiceAuthenticity, setVoiceAuthenticity] = useState<string>("HUMAN");
  const [conversationRisk, setConversationRisk] = useState<string>("BENIGN");
  const [moneyRequest, setMoneyRequest] = useState<string>("NONE");
  const [urgencyPressure, setUrgencyPressure] = useState<string>("NONE");
  const [credentialRequest, setCredentialRequest] = useState<string>("NONE");
  const [impersonation, setImpersonation] = useState<string>("NONE");
  const [overallLabel, setOverallLabel] = useState<string>("LEGITIMATE");
  const [reviewerConfidence, setReviewerConfidence] = useState<string>("HIGH");
  const [reviewerNotes, setReviewerNotes] = useState<string>("");

  const reviewerHeaders: HeadersInit = {
    "Content-Type": "application/json",
    "x-vira-reviewer-key": "vira-reviewer-key-dev",
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dataset/statistics", { headers: reviewerHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const fetchSamples = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/dataset/samples${query}`, { headers: reviewerHeaders });
      if (res.ok) {
        const data = await res.json();
        setSamples(data.samples || []);
        if (data.samples && data.samples.length > 0 && !selectedSample) {
          setSelectedSample(data.samples[0]);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedSample]);

  const fetchSampleDetails = useCallback(async (sampleId: string) => {
    try {
      const res = await fetch(`/api/dataset/samples/${sampleId}`, { headers: reviewerHeaders });
      if (res.ok) {
        const data = await res.json();
        setSelectedSample(data.sample);
        setSampleReviews(data.reviews || []);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchSamples();
  }, [fetchStats, fetchSamples]);

  useEffect(() => {
    if (selectedSample) {
      fetchSampleDetails(selectedSample.id);
    }
  }, [selectedSample?.id, fetchSampleDetails]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) return;

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/dataset/samples/${selectedSample.id}/review`, {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({
          reviewerId: auth.user?.id || "reviewer-admin-01",
          identityStatus,
          voiceAuthenticity,
          conversationRisk,
          moneyRequest,
          urgencyPressure,
          credentialRequest,
          impersonation,
          overallLabel,
          reviewerConfidence,
          notes: reviewerNotes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to submit review");
      }

      setFeedbackMessage({ type: "success", text: "Ground-truth review saved successfully." });
      setReviewerNotes("");
      fetchStats();
      fetchSampleDetails(selectedSample.id);
      fetchSamples();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to submit review" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQualityCheck = async () => {
    if (!selectedSample) return;
    try {
      const res = await fetch(`/api/dataset/samples/${selectedSample.id}/quality-check`, {
        method: "POST",
        headers: reviewerHeaders,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMessage({ type: "success", text: "Sample verified & promoted to INCLUDED." });
        fetchStats();
        fetchSampleDetails(selectedSample.id);
        fetchSamples();
      } else {
        setFeedbackMessage({ type: "error", text: data.message || "Quality check failed." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleExclude = async (reason: string) => {
    if (!selectedSample) return;
    try {
      const res = await fetch(`/api/dataset/samples/${selectedSample.id}/exclude`, {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({ reason, notes: "Excluded via reviewer dashboard" }),
      });
      if (res.ok) {
        setFeedbackMessage({ type: "success", text: `Sample excluded (${reason}).` });
        fetchStats();
        fetchSampleDetails(selectedSample.id);
        fetchSamples();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message });
    }
  };

  const handleExport = (format: "jsonl" | "csv") => {
    window.open(`/api/dataset/export?format=${format}`, "_blank");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-app)", color: "var(--text-primary)", fontFamily: "inherit" }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--bg-canvas)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={onBack}
            style={{
              padding: "6px 12px",
              background: "none",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            ← Back to App
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 600, letterSpacing: "-0.01em" }}>
              VIRA Forensic Dataset & Ground-Truth Labeling
            </h1>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Authenticated Reviewer: {auth.user?.displayName || auth.user?.username || "Authorized Analyst"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--text-secondary)",
            }}
          >
            XGBOOST: NOT READY — REAL LABELED DATASET REQUIRED
          </div>
          <button
            onClick={() => handleExport("jsonl")}
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--color-black)",
              color: "var(--color-white)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Export JSONL
          </button>
          <button
            onClick={() => handleExport("csv")}
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ padding: "20px 24px" }}>
        {/* Statistics Metric Cards */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Candidates</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px" }}>{stats.totalCandidates}</div>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Pending Review</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px" }}>{stats.pendingReview}</div>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Under Review</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px" }}>{stats.underReview}</div>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Included (Eligible)</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px", color: "var(--color-success-text)" }}>{stats.included}</div>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Excluded</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px", color: "var(--color-danger-text)" }}>{stats.excluded}</div>
            </div>
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-canvas)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Agreement Rate</div>
              <div style={{ fontSize: "20px", fontWeight: 600, marginTop: "4px" }}>
                {(stats.reviewerAgreement.agreementRate * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {/* Feedback alert */}
        {feedbackMessage && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "16px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              backgroundColor: feedbackMessage.type === "success" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
              border: `1px solid ${feedbackMessage.type === "success" ? "var(--color-success-border)" : "var(--color-danger-border)"}`,
              color: feedbackMessage.type === "success" ? "var(--color-success-text)" : "var(--color-danger-text)",
            }}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Two-Column Review Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px" }}>
          {/* Left Column: Sample List */}
          <div
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-canvas)",
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 220px)",
            }}
          >
            {/* Filter Pills */}
            <div
              style={{
                padding: "10px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                gap: "6px",
                overflowX: "auto",
              }}
            >
              {["ALL", "PENDING_REVIEW", "UNDER_REVIEW", "INCLUDED", "EXCLUDED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: statusFilter === st ? "var(--color-black)" : "var(--bg-subtle)",
                    color: statusFilter === st ? "var(--color-white)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {st === "ALL" ? "All" : st.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* List items */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {isLoading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  Loading candidate samples...
                </div>
              ) : samples.length === 0 ? (
                <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>REAL DATASET SAMPLES: 0</div>
                  <div>No completed calls have generated candidate records yet.</div>
                  <div style={{ fontSize: "11px", marginTop: "8px" }}>
                    Candidate records are automatically ingested when calls end.
                  </div>
                </div>
              ) : (
                samples.map((s) => {
                  const isSelected = selectedSample?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSample(s)}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "var(--bg-subtle)" : "transparent",
                        borderLeft: isSelected ? "3px solid var(--color-black)" : "3px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>
                          {s.call_id.substring(0, 16)}...
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-xs)",
                            backgroundColor:
                              s.review_status === "INCLUDED"
                                ? "var(--color-success-bg)"
                                : s.review_status === "EXCLUDED"
                                ? "var(--color-danger-bg)"
                                : "var(--bg-muted)",
                            color:
                              s.review_status === "INCLUDED"
                                ? "var(--color-success-text)"
                                : s.review_status === "EXCLUDED"
                                ? "var(--color-danger-text)"
                                : "var(--text-secondary)",
                            fontWeight: 600,
                          }}
                        >
                          {s.review_status}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Collected: {new Date(s.created_at).toLocaleTimeString()} • Reviews: {s.reviewer_count}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detail & Labeling Workstation */}
          <div
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-canvas)",
              padding: "20px",
              height: "calc(100vh - 220px)",
              overflowY: "auto",
            }}
          >
            {selectedSample ? (
              <div>
                {/* Header info */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    borderBottom: "1px solid var(--border-subtle)",
                    paddingBottom: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>
                      Sample #{selectedSample.id.substring(0, 8)}
                    </h2>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      Call ID: {selectedSample.call_id} • Schema: {selectedSample.feature_schema_version}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleQualityCheck}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "var(--color-success-bg)",
                        color: "var(--color-success-text)",
                        border: "1px solid var(--color-success-border)",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      ✓ Quality Check & Include
                    </button>
                    <button
                      onClick={() => handleExclude("insufficient_audio")}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "var(--color-danger-bg)",
                        color: "var(--color-danger-text)",
                        border: "1px solid var(--color-danger-border)",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      ✕ Exclude Sample
                    </button>
                  </div>
                </div>

                {/* Exact 12-Feature Pipeline Grid */}
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", marginBottom: "10px" }}>
                    Exact 12-Feature Vector (Model Telemetry & Signals)
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "8px",
                      backgroundColor: "var(--bg-subtle)",
                      padding: "12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>1. ECAPA Similarity</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.ecapa_similarity?.toFixed(3) ?? "N/A"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>2. AASIST Spoof Score</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.aasist_spoof_score?.toFixed(3) ?? "N/A"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>3. Wav2Vec2 Anti-Spoof</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.wav2vec2_anti_spoof_score !== null
                          ? selectedSample.feature_vector.wav2vec2_anti_spoof_score?.toFixed(3)
                          : "null (unconfigured)"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>4. VAD Speech Ratio</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.vad_speech_ratio?.toFixed(3) ?? "N/A"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>5. Speech Duration (s)</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.speech_duration_sec?.toFixed(1) ?? "N/A"}s
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>6. Transcript Risk Score</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.transcript_risk_score ?? "0"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>7. Signal Money Req</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.signal_money_request ? "PRESENT" : "NONE"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>8. Signal Urgency</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.signal_urgency ? "PRESENT" : "NONE"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>9. Signal Credential Req</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.signal_credential_request ? "PRESENT" : "NONE"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>10. Speaker Mismatch</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.speaker_mismatch ? "YES" : "NO"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>11. Audio Quality SNR</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.audio_quality_snr?.toFixed(1) ?? "N/A"} dB
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>12. Model Confidence</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace" }}>
                        {selectedSample.feature_vector.model_confidence?.toFixed(2) ?? "N/A"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Independent Reviews List */}
                {sampleReviews.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      Existing Human Reviews ({sampleReviews.length})
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {sampleReviews.map((rev) => (
                        <div
                          key={rev.id}
                          style={{
                            padding: "10px 12px",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "12px",
                            backgroundColor: "var(--bg-canvas)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Reviewer: {rev.reviewer_id}</span>
                            <span style={{ fontWeight: 600, color: rev.overall_label === "LEGITIMATE" ? "var(--color-success-text)" : "var(--color-danger-text)" }}>
                              {rev.overall_label} (Confidence: {rev.reviewer_confidence})
                            </span>
                          </div>
                          <div style={{ color: "var(--text-secondary)" }}>
                            Identity: {rev.identity_status} • Voice: {rev.voice_authenticity} • Conversation: {rev.conversation_risk}
                          </div>
                          {rev.notes && <div style={{ marginTop: "4px", fontStyle: "italic", color: "var(--text-muted)" }}>"{rev.notes}"</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Human Labeling Workstation Form */}
                <form onSubmit={handleSubmitReview} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>
                    Independent Ground-Truth Assessment
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                    {/* Identity Status */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                        Caller Identity Ground Truth
                      </label>
                      <select
                        value={identityStatus}
                        onChange={(e) => setIdentityStatus(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)" }}
                      >
                        <option value="MATCH">MATCH (Verified caller identity)</option>
                        <option value="MISMATCH">MISMATCH (Impostor detected)</option>
                        <option value="UNCERTAIN">UNCERTAIN (Inconclusive biometric)</option>
                        <option value="NOT_ASSESSABLE">NOT_ASSESSABLE</option>
                      </select>
                    </div>

                    {/* Voice Authenticity */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                        Voice Authenticity Ground Truth
                      </label>
                      <select
                        value={voiceAuthenticity}
                        onChange={(e) => setVoiceAuthenticity(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)" }}
                      >
                        <option value="HUMAN">HUMAN (Genuine organic voice)</option>
                        <option value="SYNTHETIC">SYNTHETIC (AI TTS / cloned voice)</option>
                        <option value="VOICE_CONVERSION">VOICE_CONVERSION (Real-time morphed)</option>
                        <option value="REPLAY">REPLAY (Physical acoustic playback)</option>
                        <option value="UNKNOWN">UNKNOWN</option>
                        <option value="NOT_ASSESSABLE">NOT_ASSESSABLE</option>
                      </select>
                    </div>

                    {/* Conversation Risk */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                        Conversational Safety Ground Truth
                      </label>
                      <select
                        value={conversationRisk}
                        onChange={(e) => setConversationRisk(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)" }}
                      >
                        <option value="BENIGN">BENIGN (Legitimate dialogue)</option>
                        <option value="SUSPICIOUS">SUSPICIOUS (Anomalous social pressure)</option>
                        <option value="MALICIOUS">MALICIOUS (Active financial scam / fraud)</option>
                        <option value="UNKNOWN">UNKNOWN</option>
                      </select>
                    </div>

                    {/* Overall Call Label */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        Overall Call Ground Truth
                      </label>
                      <select
                        value={overallLabel}
                        onChange={(e) => setOverallLabel(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-dark)", fontWeight: 600 }}
                      >
                        <option value="LEGITIMATE">LEGITIMATE (Genuine human call)</option>
                        <option value="SUSPICIOUS">SUSPICIOUS (Questionable signals)</option>
                        <option value="MALICIOUS">MALICIOUS (Confirmed threat / attack)</option>
                        <option value="INCONCLUSIVE">INCONCLUSIVE (Insufficient evidence)</option>
                      </select>
                    </div>
                  </div>

                  {/* Threat Signal Checkboxes */}
                  <div style={{ marginBottom: "14px" }}>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                      Observed Social Engineering Threat Dimensions
                    </span>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={moneyRequest === "PRESENT"}
                          onChange={(e) => setMoneyRequest(e.target.checked ? "PRESENT" : "NONE")}
                        />
                        Money / Transfer Request
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={urgencyPressure === "PRESENT"}
                          onChange={(e) => setUrgencyPressure(e.target.checked ? "PRESENT" : "NONE")}
                        />
                        Urgency / Coercion
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={credentialRequest === "PRESENT"}
                          onChange={(e) => setCredentialRequest(e.target.checked ? "PRESENT" : "NONE")}
                        />
                        Credential / OTP Theft
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={impersonation === "PRESENT"}
                          onChange={(e) => setImpersonation(e.target.checked ? "PRESENT" : "NONE")}
                        />
                        Executive / Family Impersonation
                      </label>
                    </div>
                  </div>

                  {/* Reviewer Confidence */}
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                      Reviewer Assessment Confidence
                    </label>
                    <select
                      value={reviewerConfidence}
                      onChange={(e) => setReviewerConfidence(e.target.value)}
                      style={{ width: "240px", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)" }}
                    >
                      <option value="HIGH">HIGH (Certain with clear acoustic/linguistic evidence)</option>
                      <option value="MEDIUM">MEDIUM (Likely assessment)</option>
                      <option value="LOW">LOW (Borderline evidence)</option>
                      <option value="NOT_SURE">NOT_SURE (Cannot determine from evidence)</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
                      Forensic Reviewer Notes & Justification
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      rows={2}
                      placeholder="Document acoustic artifacts, pitch tracking anomalies, social engineering cues..."
                      style={{ width: "100%", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)", fontFamily: "inherit", fontSize: "12px" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "var(--color-black)",
                      color: "var(--color-white)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {isSubmitting ? "Submitting Review..." : "Save Ground-Truth Review"}
                  </button>
                </form>
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Select a candidate sample on the left to inspect features and record ground-truth labels.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
