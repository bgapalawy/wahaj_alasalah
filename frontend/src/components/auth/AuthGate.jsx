import { useEffect, useState } from "react";
import { getStoredToken, getStoredUsername, setStoredAuth } from "../../api/client.js";
import { projectConfig } from "../../config/projectConfig.js";

/**
 * Wraps the whole app. Nothing inside renders until there's a valid
 * token — the API itself also enforces this server-side (see
 * backend/src/middleware/auth.js), this is just so the UI doesn't show
 * a broken, half-loaded app full of failed requests before that.
 *
 * Real per-user accounts now (username + password against the `users`
 * table, bcrypt-hashed), not a single shared password — see
 * backend/src/services/authService.js and scripts/create-user.js.
 *
 * Listens for the "auth:expired" event apiClient.js fires on any 401 —
 * that's what brings the login screen back if a token expires or gets
 * rejected mid-session, not just on first load.
 */
export function AuthGate({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | working | error
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    function handleExpired() {
      setToken(null);
    }
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("working");
    setErrorMessage(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Login failed.");
      setStoredAuth(body.token, body.username);
      setToken(body.token);
      setPassword("");
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  }

  if (token) return children;

  return (
    <div className="auth-gate">
      <form className="auth-gate-card" onSubmit={handleSubmit}>
        <h1>{projectConfig.displayName}</h1>
        <p>Sign in to continue.</p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          disabled={status === "working"}
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={status === "working"}
          autoComplete="current-password"
        />
        <button type="submit" disabled={status === "working" || !username || !password}>
          {status === "working" ? "Signing in…" : "Log in"}
        </button>
        {errorMessage && <p className="auth-gate-error">{errorMessage}</p>}

        <div className="auth-gate-contact">
          <p>Need an account?</p>
          <div className="auth-gate-contact-links">
            <a href="https://wa.me/966581854860" target="_blank" rel="noopener noreferrer">
              WhatsApp: +966 58 185 4860
            </a>
            <a href="mailto:bgapalawy@gmail.com">Email: bgapalawy@gmail.com</a>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Used by App.jsx to show "Logged in as X" and offer a logout button. */
export function useLoggedInUser() {
  return getStoredUsername();
}

export function logout() {
  setStoredAuth(null);
  window.location.reload();
}
