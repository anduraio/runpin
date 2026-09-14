import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fetchPacks, Job } from "../api";
import { getPack, setClientDraftPacks, type PackManifest } from "../packs";

type Stats = {
  queued: number;
  running: number;
  succeeded_recent: number;
  failed_recent: number;
};

const POLL_MS = 1500;

export default function Activity() {
  const [running, setRunning] = useState<Job[]>([]);
  const [waiting, setWaiting] = useState<Job[]>([]);
  const [finished, setFinished] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsData, runningData, queuedData, allRecent] = await Promise.all([
        api<Stats>("/v1/jobs/stats"),
        api<{ jobs: Job[] }>("/v1/jobs?status=running&limit=100"),
        api<{ jobs: Job[] }>("/v1/jobs?status=queued&limit=100"),
        api<{ jobs: Job[] }>("/v1/jobs?limit=50"),
      ]);
      setStats(statsData);
      setRunning(runningData.jobs);
      setWaiting(queuedData.jobs);
      const done = allRecent.jobs
        .filter(
          (j) =>
            j.status === "succeeded" ||
            j.status === "failed" ||
            j.status === "cancelled"
        )
        .slice(0, 20);
      setFinished(done);
      setError("");
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

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
        /* titles fall back to type id */
      }
    })();
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const runningCount = stats?.running ?? running.length;
  const waitingCount = stats?.queued ?? waiting.length;

  return (
    <>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, flex: 1 }}>What's running</h1>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {updatedAt ? "Updated just now" : "Loading…"}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="live-board">
        <section className="card live-col">
          <h2>
            Running now{" "}
            <span className="muted" style={{ fontWeight: 500 }}>
              · {runningCount === 1 ? "1 running" : `${runningCount} running`}
            </span>
          </h2>
          {running.length === 0 ? (
            <p className="muted">Nothing running right now</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Started</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {running.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link to={`/jobs/${j.id}`}>{friendlyType(j.type)}</Link>
                    </td>
                    <td className="muted">{relativeTime(j.started_at, "Started")}</td>
                    <td className="muted">{progressText(j.progress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card live-col">
          <h2>
            Waiting{" "}
            <span className="muted" style={{ fontWeight: 500 }}>
              · {waitingCount === 1 ? "1 waiting" : `${waitingCount} waiting`}
            </span>
          </h2>
          {waiting.length === 0 ? (
            <p className="muted">No one waiting</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link to={`/jobs/${j.id}`}>{friendlyType(j.type)}</Link>
                    </td>
                    <td className="muted">{relativeTime(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "0.25rem" }}>
        <h2>Finished</h2>
        {finished.length === 0 ? (
          <p className="muted">Nothing finished yet</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Outcome</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {finished.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/jobs/${j.id}`}>{friendlyType(j.type)}</Link>
                  </td>
                  <td>
                    <OutcomeBadge job={j} />
                    {j.status === "failed" && j.error && (
                      <div className="muted" style={{ marginTop: 4, maxWidth: 360 }}>
                        {shortError(j.error)}
                      </div>
                    )}
                  </td>
                  <td className="muted">{relativeTime(j.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function OutcomeBadge({ job }: { job: Job }) {
  if (job.status === "succeeded") {
    return <span className="badge succeeded">Success</span>;
  }
  if (job.status === "failed") {
    return <span className="badge failed">Failed</span>;
  }
  if (job.status === "cancelled") {
    return <span className="badge cancelled">Cancelled</span>;
  }
  return <span className={`badge ${job.status}`}>{job.status}</span>;
}

function friendlyType(type: string): string {
  const pack = getPack(type);
  if (pack) return pack.title;
  const map: Record<string, string> = {
    "template.finder": "Finder",
    "template.watcher": "Watcher",
    "template.collector": "Collector",
    "template.repeater": "Repeater",
    "template.brief": "Daily Brief",
    "template.compare": "Compare",
    "template.filter": "Filter",
    "template.delivery": "Delivery",
    echo: "Echo",
    http_callback: "HTTP callback",
    "hunt.jobs": "Finder (jobs)",
    "hunt.icp": "Finder (customers)",
    "hunt.linkedin": "Finder",
    "notify.webhook": "Delivery",
  };
  return map[type] ?? type;
}

function relativeTime(iso: string | null, prefix?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    let phrase: string;
    if (sec < 45) phrase = "just now";
    else if (sec < 90) phrase = "1 min ago";
    else if (sec < 3600) phrase = `${Math.floor(sec / 60)} min ago`;
    else if (sec < 5400) phrase = "1 hr ago";
    else if (sec < 86400) phrase = `${Math.floor(sec / 3600)} hr ago`;
    else phrase = d.toLocaleString();
    if (prefix && phrase !== "just now" && !phrase.includes("/")) {
      return `${prefix} ${phrase}`;
    }
    if (prefix && phrase === "just now") return `${prefix} just now`;
    return phrase;
  } catch {
    return iso;
  }
}

function shortError(err: string): string {
  const one = err.replace(/\s+/g, " ").trim();
  return one.length > 120 ? one.slice(0, 117) + "…" : one;
}

function progressText(progress: unknown): string {
  if (progress == null) return "—";
  if (typeof progress === "string") return progress;
  if (typeof progress === "object" && progress !== null) {
    const o = progress as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.step === "string") return o.step;
    if (typeof o.pct === "number") return `${o.pct}%`;
  }
  try {
    const s = JSON.stringify(progress);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(progress);
  }
}
