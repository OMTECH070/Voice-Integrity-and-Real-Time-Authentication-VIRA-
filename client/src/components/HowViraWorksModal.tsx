interface HowViraWorksModalProps {
  onClose: () => void;
}

export function HowViraWorksModal({ onClose }: HowViraWorksModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="how-vira-works-title">
      <div className="modal" style={{ maxWidth: "480px" }}>
        <div className="info-modal-header">
          <div className="info-modal-title-group">
            <h2 id="how-vira-works-title">How VIRA Works</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <p style={{ margin: "0 0 16px 0", fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Real-time speaker authentication and neural voice integrity verification.
        </p>

        <div>
          <div className="step-row-editorial">
            <div className="step-number-mono">1</div>
            <div className="step-body-editorial">
              <h4>Enroll your voice</h4>
              <p>Record a one-time 8-second passphrase to generate a 192-dimensional acoustic signature.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">2</div>
            <div className="step-body-editorial">
              <h4>Start a secure call</h4>
              <p>Connect peer-to-peer over encrypted WebRTC audio with client-side Voice Activity Detection.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">3</div>
            <div className="step-body-editorial">
              <h4>VIRA analyzes the voice</h4>
              <p>Speech is buffered into rolling 3.0s windows and evaluated by the AASIST anti-spoof model for synthesis artifacts.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">4</div>
            <div className="step-body-editorial">
              <h4>Speaker identity is verified</h4>
              <p>ECAPA-TDNN computes cosine similarity against the enrolled baseline to confirm identity.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">5</div>
            <div className="step-body-editorial">
              <h4>Suspicious voices can be detected</h4>
              <p>Immediate alerts if synthetic speech or an unknown speaker is detected during the conversation.</p>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-black" onClick={onClose} style={{ padding: "8px 20px" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
