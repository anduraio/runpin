import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setApiKey } from "../api";

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/v1/health", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error("Invalid API key");
      setApiKey(key);
      nav("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Runpin</h1>
        <p className="muted">Sign in with your RUNPIN_API_KEY</p>
        <label>API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Bearer token"
          autoFocus
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
