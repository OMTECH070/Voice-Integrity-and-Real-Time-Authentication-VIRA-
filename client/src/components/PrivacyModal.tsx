interface PrivacyModalProps {
  onClose: () => void;
}

export function PrivacyModal({ onClose }: PrivacyModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
      <div className="modal" style={{ maxWidth: "480px" }}>
        <div className="info-modal-header">
          <div className="info-modal-title-group">
            <h2 id="privacy-modal-title">Privacy &amp; Data Protections</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <p style={{ margin: "0 0 16px 0", fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          VIRA is designed with strict data privacy principles to protect your voice and biometric information.
        </p>

        <div>
          <div className="step-row-editorial">
            <div className="step-number-mono">1</div>
            <div className="step-body-editorial">
              <h4>Zero Audio Retention</h4>
              <p>Raw call audio is processed in transient memory for live analysis and is never stored on disk.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">2</div>
            <div className="step-body-editorial">
              <h4>One-Way Biometric Embeddings</h4>
              <p>Voice enrollment produces irreversible 192-dimensional numerical vectors that cannot reconstruct original speech.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">3</div>
            <div className="step-body-editorial">
              <h4>Row-Level Security</h4>
              <p>Stored voice profiles are protected by Supabase RLS, accessible exclusively by the account owner.</p>
            </div>
          </div>

          <div className="step-row-editorial">
            <div className="step-number-mono">4</div>
            <div className="step-body-editorial">
              <h4>Automatic Buffer Teardown</h4>
              <p>All transient speech buffers and analysis state are cleared from memory the moment a call ends.</p>
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
