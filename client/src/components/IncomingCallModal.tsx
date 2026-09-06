import { UserDTO } from "../types/user";

interface IncomingCallModalProps {
  caller: UserDTO;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  caller,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const initial = (caller.username || "U").charAt(0).toUpperCase();

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
    >
      <div className="modal" style={{ maxWidth: "380px", textAlign: "center", padding: "32px 24px" }}>
        <h2
          id="incoming-call-title"
          style={{
            margin: "0 0 20px 0",
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "-0.3px",
            color: "var(--color-black)",
          }}
        >
          Incoming Secure Call
        </h2>

        {/* Minimal Avatar */}
        <div className="incoming-avatar-minimal">
          <span>{initial}</span>
        </div>

        <h3
          style={{
            margin: "0 0 2px 0",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--color-black)",
          }}
        >
          {caller.username}
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-muted)" }}>
          @{caller.username}
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--color-success)",
            fontWeight: 600,
            marginBottom: "28px",
          }}
        >
          <span>●</span>
          <span>Voice verification enabled</span>
        </div>

        <div className="modal-actions" style={{ justifyContent: "center", gap: "12px" }}>
          <button
            className="btn-outline"
            onClick={onReject}
            style={{ padding: "9px 24px" }}
            aria-label="Decline incoming call"
          >
            Decline
          </button>

          <button
            className="btn-black"
            onClick={onAccept}
            style={{ padding: "9px 28px" }}
            aria-label="Accept incoming call"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
