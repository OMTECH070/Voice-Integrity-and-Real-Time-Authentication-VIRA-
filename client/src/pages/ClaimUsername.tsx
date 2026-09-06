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
    <div className="page-container" style={{ maxWidth: "380px", textAlign: "left", marginTop: "80px" }}>
      <h1 className="brand-logo-text" style={{ fontSize: "22px", marginBottom: "6px" }}>Choose Username</h1>
      <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", margin: "0 0 20px 0", lineHeight: 1.4 }}>
        This is your unique handle in VIRA used by contacts to verify your identity.
      </p>

      {auth.error && (
        <div className="error-banner" role="alert">
          <span>{auth.error}</span>
          <button onClick={auth.dismissError} aria-label="Dismiss error">&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label htmlFor="claim-username">Username</label>
          <input
            id="claim-username"
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoFocus
            required
            pattern="^[a-zA-Z0-9_.-]+$"
          />
        </div>
        <button
          type="submit"
          className="btn-black"
          disabled={submitting || !username.trim()}
          style={{ width: "100%", padding: "10px" }}
        >
          {submitting ? "Claiming..." : "Claim Username"}
        </button>
      </form>
    </div>
  );
}
