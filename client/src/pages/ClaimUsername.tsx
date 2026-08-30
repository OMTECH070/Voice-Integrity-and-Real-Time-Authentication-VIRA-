import { FormEvent, useState } from "react";
import { UseAuthResult } from "../hooks/useAuth";

interface ClaimUsernameProps {
  auth: UseAuthResult;
}

export function ClaimUsername({ auth }: ClaimUsernameProps) {
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await auth.claimUsername(username);
    setSubmitting(false);
  }

  return (
    <div className="page-container">
      <h1>Choose a username</h1>
      <p className="tagline">
        This is your permanent, unique identity in VIRA — it's how people
        recognize your account for certain (unlike your display name or
        photo, this can't be duplicated by someone else).
      </p>

      {auth.error && (
        <div className="error-banner">
          <span>{auth.error}</span>
          <button onClick={auth.dismissError}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="text"
          placeholder="username (lowercase, no spaces)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Checking..." : "Claim Username"}
        </button>
      </form>
    </div>
  );
}
