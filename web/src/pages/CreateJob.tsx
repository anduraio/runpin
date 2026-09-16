import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fetchHandlers } from "../api";
import { BUILTIN_TYPES, mergeHandlerTypes, setHandlerTitles } from "../tools";

export default function CreateJob() {
  const [type, setType] = useState("echo");
  const [types, setTypes] = useState(BUILTIN_TYPES);
  const [payload, setPayload] = useState('{\n  "hello": "world"\n}');
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { handlers } = await fetchHandlers();
        setHandlerTitles(handlers);
        setTypes(mergeHandlerTypes(handlers));
      } catch {
        /* vendor handlers are optional — keep the builtins */
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError("Payload must be valid JSON");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ id: string }>("/v1/jobs", {
        method: "POST",
        body: JSON.stringify({ type, payload: parsed }),
      });
      nav(`/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Create job (JSON)</h1>
      <form className="card" onSubmit={onSubmit}>
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label>Payload (JSON)</label>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          spellCheck={false}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Starting…" : "Start run"}
        </button>
      </form>
    </>
  );
}
