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
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Incoming call</h2>
        <p>{caller.username} is calling you...</p>
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
