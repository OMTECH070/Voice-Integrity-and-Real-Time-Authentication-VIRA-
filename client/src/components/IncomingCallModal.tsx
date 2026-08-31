import { UserDTO } from "../types/user";
import { CallerRelationship } from "../types/contacts";

interface IncomingCallModalProps {
  caller: UserDTO;
  relationship?: CallerRelationship;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  caller,
  relationship,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const isUnknown = relationship === "unknown";

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Incoming call</h2>

        {isUnknown ? (
          <div className="unknown-caller-badge">
            ⚠️ Unknown Caller
          </div>
        ) : (
          <div className="known-caller-badge">✓ Known Contact</div>
        )}

        <p>{caller.username} is calling you...</p>

        {isUnknown && (
          <p className="unknown-caller-note">
            This account is not in your contacts. Be cautious if they ask
            for money, passwords, or verification codes.
          </p>
        )}

        <div className="modal-actions">
          <button className="btn-accept" onClick={onAccept}>
            Accept
          </button>
          <button className="btn-reject" onClick={onReject}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
