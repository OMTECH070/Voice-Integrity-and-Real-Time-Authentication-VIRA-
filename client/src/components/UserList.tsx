import { UserDTO } from "../types/user";

interface UserListProps {
  users: UserDTO[];
  selfId: string | undefined;
  onCall: (userId: string) => void;
  disabled: boolean;
}

export function UserList({ users, selfId, onCall, disabled }: UserListProps) {
  const others = users.filter((u) => u.id !== selfId);

  if (others.length === 0) {
    return <p className="empty-list-notice">No other users online yet.</p>;
  }

  return (
    <ul className="people-list-minimal">
      {others.map((user) => (
        <li key={user.id} className="person-row-minimal">
          <div className="person-left-meta">
            <div className="person-avatar-minimal">
              <span>{(user.username || "U").charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="person-name-text">{user.username}</div>
              <div className="person-handle-text">@{user.username}</div>
            </div>
          </div>
          <div className="person-right-action">
            <div className="person-status-dot-label">
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: user.status === "available" ? "var(--color-success)" : "var(--text-dim)",
                  display: "inline-block",
                }}
              />
              <span>{user.status === "available" ? "online" : "in-call"}</span>
            </div>
            <button
              className="btn-call-minimal"
              onClick={() => onCall(user.id)}
              disabled={disabled || user.status === "in-call"}
              aria-label={`Call ${user.username}`}
            >
              Call
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
