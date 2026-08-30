import { FormEvent, useState } from "react";
import { UseAuthResult } from "../hooks/useAuth";

interface AuthPageProps {
  auth: UseAuthResult;
}

export function AuthPage({ auth }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    await auth.signUpWithEmail(email, password, displayName);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    await auth.signInWithEmail(email, password);
  }

  return (
    <div className="page-container">
      <h1>VIRA</h1>
      <p className="tagline">1-to-1 voice calling</p>

      <button className="google-btn" onClick={auth.signInWithGoogle}>
        Continue with Google
      </button>

      <div className="auth-divider">or</div>

      <div className="auth-tabs">
        <button
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("login")}
        >
          Log In
        </button>
        <button
          className={mode === "register" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      {auth.error && (
        <div className="error-banner">
          <span>{auth.error}</span>
          <button onClick={auth.dismissError}>&times;</button>
        </div>
      )}

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={auth.isLoading}>
            Log In
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="auth-form">
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={auth.isLoading}>
            Create Account
          </button>
        </form>
      )}
    </div>
  );
}
