import { Link } from "react-router-dom";

const LINKS = [
  {
    to: "/activity",
    title: "Activity",
    desc: "What's running, waiting, and finished.",
  },
  {
    to: "/routines",
    title: "Routines",
    desc: "Repeating runs, in plain words.",
  },
  {
    to: "/advanced/jobs",
    title: "Jobs",
    desc: "Every job, filterable by status.",
  },
  {
    to: "/advanced/jobs/new",
    title: "New job (JSON)",
    desc: "Enqueue by hand.",
  },
];

export default function Home() {
  return (
    <>
      <h1>Runpin</h1>
      <p className="muted" style={{ marginBottom: "1.25rem" }}>
        Durable jobs for AI agents and workflows. Your app enqueues over HTTP;
        this UI watches and steers the queue.
      </p>

      <div className="card-grid">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card-tile">
            <h2 className="card-title">{l.title}</h2>
            <p className="card-desc">{l.desc}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2>Enqueue from your app</h2>
        <pre className="mono">{`curl -X POST "$RUNPIN_URL/v1/jobs" \\
  -H "Authorization: Bearer $RUNPIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"http_callback","payload":{"callback_url":"https://your-app/hooks/runpin"}}'
# → 202 { "id": "…" }`}</pre>
        <p className="muted" style={{ marginBottom: 0 }}>
          <code>echo</code> is for smoke tests; <code>http_callback</code> POSTs
          the payload to your URL. Contract: <Link to="/guide">guide</Link>.
        </p>
      </div>
    </>
  );
}
