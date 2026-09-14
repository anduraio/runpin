import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  applyToListing,
  downloadJobExport,
  fetchAppliedIds,
  fetchPacks,
  Job,
  JobAction,
} from "../api";
import PackResultView from "../components/PackResultView";
import { getPack, setClientDraftPacks, type PackManifest } from "../packs";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null);
  const [pack, setPack] = useState<PackManifest | undefined>(undefined);

  async function load() {
    if (!id) return;
    try {
      const data = await api<Job>(`/v1/jobs/${id}`);
      setJob(data);
      setError("");
      setPack(getPack(data.type));
      try {
        const applied = await fetchAppliedIds(id);
        setAppliedIds(applied.applied_ids ?? []);
      } catch {
        /* optional */
      }
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
        /* builtins still work offline */
      }
      load();
    })();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [id]);

  async function cancel() {
    if (!id) return;
    await api(`/v1/jobs/${id}/cancel`, { method: "POST" });
    load();
  }

  async function onDownload(format: "json" | "csv") {
    if (!id) return;
    setExportBusy(true);
    try {
      await downloadJobExport(id, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export download failed");
    } finally {
      setExportBusy(false);
    }
  }

  async function onApply(listingId: string) {
    if (!id) return;
    setApplyBusyId(listingId);
    setError("");
    try {
      const res = await applyToListing(id, listingId);
      setAppliedIds(res.applied_ids ?? []);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplyBusyId(null);
    }
  }

  if (error && !job) return <p className="error">{error}</p>;
  if (!job) return <p className="muted">Loading…</p>;

  const canCancel = job.status === "queued" || job.status === "running";
  const actions = job.actions ?? [];
  const hasLocalExport = actions.some(
    (a) =>
      a.action_type === "save_to_google_drive" &&
      a.status === "succeeded" &&
      a.detail &&
      typeof a.detail === "object" &&
      ("local_json" in (a.detail as object) ||
        "export_url" in (a.detail as object))
  );

  const resolvedPack = pack ?? getPack(job.type);

  return (
    <>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, flex: 1 }}>
          {friendlyType(job.type)}{" "}
          <span className="muted" style={{ fontWeight: 500, fontSize: "0.9rem" }}>
            {job.id}
          </span>
        </h1>
        <Link to="/activity">← Activity</Link>
        <Link to="/advanced/jobs">Jobs</Link>
        {canCancel && (
          <button className="danger" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <div className="grid2">
          <div>
            <h2>Status</h2>
            <p>
              <span className={`badge ${job.status}`}>
                {plainStatus(job.status)}
              </span>
            </p>
            <p className="muted">
              Tool: {friendlyType(job.type)}
              <br />
              Pack: {resolvedPack ? `${resolvedPack.title} (${resolvedPack.view})` : "JSON fallback"}
              <br />
              Try: {job.attempt} of {job.max_attempts}
              <br />
              Created: {fmt(job.created_at)}
              <br />
              Started: {fmt(job.started_at)}
              <br />
              Finished: {fmt(job.finished_at)}
            </p>
          </div>
          <div>
            <h2>Error</h2>
            {job.error ? (
              <div className="mono" style={{ color: "var(--danger)" }}>
                {job.error}
              </div>
            ) : (
              <p className="muted">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Results</h2>
        {job.result == null ? (
          job.status === "running" || job.status === "queued" ? (
            <p className="muted">Still working — results will appear here.</p>
          ) : (
            <p className="muted">No results yet.</p>
          )
        ) : (
          <PackResultView
            pack={resolvedPack}
            result={job.result}
            jobId={job.id}
            jobType={job.type}
            appliedIds={appliedIds}
            onApply={onApply}
            applyBusyId={applyBusyId}
            hasExport={hasLocalExport}
            onDownloadExport={onDownload}
            exportBusy={exportBusy}
          />
        )}
      </div>

      <div className="card">
        <header style={{ marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>Actions</h2>
        </header>
        {actions.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            {job.status === "succeeded" || job.status === "failed"
              ? "No actions ran for this job. Configure them per job type via PUT /v1/tools/installed/:toolId/settings."
              : "Actions run automatically when this job finishes."}
          </p>
        ) : (
          <ul className="action-list">
            {actions.map((a) => (
              <li key={a.id} className="action-item">
                <div className="action-item-main">
                  <span className={`badge ${actionBadgeClass(a.status)}`}>
                    {plainActionStatus(a.status)}
                  </span>
                  <strong>{friendlyAction(a)}</strong>
                </div>
                {a.message && (
                  <p className="muted action-message">{a.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {hasLocalExport && (
          <div className="row" style={{ marginTop: "0.75rem", gap: "0.5rem" }}>
            <button
              type="button"
              className="secondary"
              disabled={exportBusy}
              onClick={() => onDownload("json")}
            >
              Download export (JSON)
            </button>
            <button
              type="button"
              className="secondary"
              disabled={exportBusy}
              onClick={() => onDownload("csv")}
            >
              Download CSV
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Input</h2>
        <pre className="mono">{JSON.stringify(job.payload, null, 2)}</pre>
      </div>

      {job.progress != null && <ProgressCard progress={job.progress} />}
    </>
  );
}

type ProgressShape = {
  stage?: string;
  message?: string;
  percent?: number;
  at?: string;
};

function readProgress(progress: unknown): ProgressShape | null {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    return null;
  }
  const o = progress as Record<string, unknown>;
  const stage = typeof o.stage === "string" ? o.stage : undefined;
  const message = typeof o.message === "string" ? o.message : undefined;
  const percent = typeof o.percent === "number" ? o.percent : undefined;
  const at = typeof o.at === "string" ? o.at : undefined;
  return { stage, message, percent, at };
}

function ProgressCard({ progress }: { progress: unknown }) {
  const p = readProgress(progress);
  if (!p || (!p.stage && !p.message && p.percent === undefined && !p.at)) {
    return (
      <div className="card">
        <h2>Progress</h2>
        <pre className="mono">{JSON.stringify(progress, null, 2)}</pre>
      </div>
    );
  }
  const pct =
    p.percent === undefined ? null : Math.max(0, Math.min(100, p.percent));
  return (
    <div className="card">
      <h2>Progress</h2>
      {p.stage && <p className="progress-stage">{p.stage}</p>}
      {p.message && <p className="muted">{p.message}</p>}
      {pct !== null && (
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {p.at && (
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.8rem" }}>
          Updated {formatWhen(p.at)}
        </p>
      )}
      <details className="progress-raw">
        <summary>Raw</summary>
        <pre className="mono">{JSON.stringify(progress, null, 2)}</pre>
      </details>
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function friendlyAction(a: JobAction): string {
  switch (a.action_type) {
    case "save_to_google_drive":
      return "Saved to Files";
    case "webhook":
      return "Webhook sent";
    case "notify":
      return "Notify";
    case "apply":
      return "Apply";
    case "auto_apply": {
      const detail = a.detail as { applications?: unknown[] } | null;
      const n = Array.isArray(detail?.applications)
        ? detail!.applications!.length
        : null;
      return n != null ? `Auto-apply (${n})` : "Auto-apply";
    }
    case "save_to_crm":
      return "Save to CRM";
    case "enrich_contacts":
      return "Enrich contacts";
    default:
      return a.action_type;
  }
}

function actionBadgeClass(status: string): string {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "running":
      return "running";
    case "skipped":
      return "cancelled";
    default:
      return "queued";
  }
}

function plainActionStatus(status: string): string {
  switch (status) {
    case "succeeded":
      return "Done";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "skipped":
      return "Skipped";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function plainStatus(status: string): string {
  switch (status) {
    case "queued":
      return "Waiting";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
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

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
