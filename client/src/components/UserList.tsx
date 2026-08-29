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
    return <p className="empty-state">No other users online yet.</p>;
  }

  return (
    <ul className="user-list">
      {others.map((user) => (
        <li key={user.id} className="user-list-item">
          <span className={`status-dot status-${user.status}`} />
          <span className="user-name">{user.username}</span>
          <span className="user-status">{user.status}</span>
          <button
            onClick={() => onCall(user.id)}
            disabled={disabled || user.status === "in-call"}
          >
            Call
          </button>
        </li>
      ))}
    </ul>
  );
}
