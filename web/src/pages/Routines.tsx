import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fetchPacks, Schedule } from "../api";
import { setClientDraftPacks, type PackManifest } from "../packs";
import { friendlySchedule, toolTitle } from "../tools";

export default function Routines() {
  const [routines, setRoutines] = useState<Schedule[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api<{ schedules: Schedule[] }>("/v1/schedules");
      setRoutines(data.schedules);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { packs } = await fetchPacks();
        setClientDraftPacks(
          packs
            .filter((p) => p.source === "draft")
            .map((p) => p as unknown as PackManifest)
        );
      } catch {
        /* titles fall back */
      }
      load();
    })();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function pause(id: string) {
    await api(`/v1/schedules/${id}/pause`, { method: "POST" });
    load();
  }
  async function resume(id: string) {
    await api(`/v1/schedules/${id}/resume`, { method: "POST" });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this Routine?")) return;
    await api(`/v1/schedules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <h1>Routines</h1>
      <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Scheduled runs. Create and edit schedules in{" "}
        <Link to="/advanced/schedules">Advanced → Schedules</Link> or via{" "}
        <code>POST /v1/schedules</code>.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Schedule</th>
              <th>Tool</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routines.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No Routines yet — create one in{" "}
                  <Link to="/advanced/schedules">Advanced → Schedules</Link>.
                </td>
              </tr>
            )}
            {routines.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{friendlySchedule(s.cron)}</td>
                <td>{toolTitle(s.job_type)}</td>
                <td>
                  {s.enabled ? (
                    <span className="badge running">active</span>
                  ) : (
                    <span className="badge cancelled">paused</span>
                  )}
                </td>
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
