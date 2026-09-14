import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Job } from "../api";

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = await api<{ jobs: Job[] }>(`/v1/jobs${q}`);
      setJobs(data.jobs);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [status]);

  return (
    <>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, flex: 1 }}>Jobs</h1>
        <select
          style={{ width: "auto", margin: 0 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="succeeded">succeeded</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <Link className="btn" to="/advanced/jobs/new">
          New job
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Attempt</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No jobs yet
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <Link to={`/jobs/${j.id}`}>{j.id}</Link>
                </td>
                <td>{j.type}</td>
                <td>
                  <span className={`badge ${j.status}`}>{j.status}</span>
                </td>
                <td>
                  {j.attempt}/{j.max_attempts}
                </td>
                <td className="muted">{fmt(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
