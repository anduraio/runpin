import { FormEvent, useEffect, useState } from "react";
import { api, Schedule } from "../api";

const TYPES = [
  "template.finder",
  "template.watcher",
  "template.collector",
  "template.repeater",
  "template.brief",
  "template.compare",
  "template.filter",
  "template.delivery",
  "echo",
  "http_callback",
  "hunt.jobs",
  "hunt.icp",
  "hunt.linkedin",
  "notify.webhook",
];

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 * * * *");
  const [jobType, setJobType] = useState("echo");
  const [payload, setPayload] = useState("{}");

  async function load() {
    try {
      const data = await api<{ schedules: Schedule[] }>("/v1/schedules");
      setSchedules(data.schedules);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError("Payload must be valid JSON");
      return;
    }
    try {
      await api("/v1/schedules", {
        method: "POST",
        body: JSON.stringify({
          name,
          cron,
          job_type: jobType,
          payload: parsed,
        }),
      });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function pause(id: string) {
    await api(`/v1/schedules/${id}/pause`, { method: "POST" });
    load();
  }
  async function resume(id: string) {
    await api(`/v1/schedules/${id}/resume`, { method: "POST" });
    load();
  }
  async function remove(id: string) {
    await api(`/v1/schedules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <h1>Schedules</h1>
      <p className="muted">
        Cron expressions are UTC (e.g. <code>0 2 * * *</code> runs daily at{" "}
        02:00 UTC).
      </p>
      {error && <p className="error">{error}</p>}

      <form className="card" onSubmit={onCreate}>
        <h2>Create schedule</h2>
        <div className="grid2">
          <div>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Cron (UTC)</label>
            <input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              required
            />
          </div>
        </div>
        <label>Job type</label>
        <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
          {TYPES.map((t) => (
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
        <button type="submit">Create</button>
      </form>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cron</th>
              <th>Type</th>
              <th>Next (UTC)</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No schedules
                </td>
              </tr>
            )}
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <code>{s.cron}</code>
                </td>
                <td>{s.job_type}</td>
                <td className="muted">{s.next_run_at ?? "—"}</td>
                <td>{s.enabled ? "yes" : "paused"}</td>
                <td className="row">
                  {s.enabled ? (
                    <button className="secondary" onClick={() => pause(s.id)}>
                      Pause
                    </button>
                  ) : (
                    <button className="secondary" onClick={() => resume(s.id)}>
                      Resume
                    </button>
                  )}
                  <button className="danger" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
