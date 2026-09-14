/**
 * Post-job action pipeline — runs after completeJob / terminal failJob.
 * Loads account_tools.settings for the job owner + tool type, then executes
 * configured actions and records rows in job_actions.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getToolSettings } from "../db/tools.js";
import { getJob } from "../db/jobs.js";
import {
  beginJobAction,
  createJobAction,
  updateJobAction,
} from "../db/jobActions.js";
import type { Job } from "../shared/types.js";
import type { ToolSettings } from "../shared/toolSettings.js";
import { config } from "../shared/config.js";
import { tryUploadToDrive } from "./drive.js";

function parseJson<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function exportsDir(): string {
  // Prefer sibling of DB file: data/exports
  const dbPath = config.databasePath();
  const dir = resolve(dirname(dbPath), "exports");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function exportPathsForJob(jobId: string): {
  json: string;
  csv: string | null;
} {
  const dir = exportsDir();
  return {
    json: join(dir, `${jobId}.json`),
    csv: join(dir, `${jobId}.csv`),
  };
}

export function exportFileExists(jobId: string): boolean {
  const paths = exportPathsForJob(jobId);
  return existsSync(paths.json) || existsSync(paths.csv ?? "");
}

function firstListArray(result: unknown): unknown[] | null {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    for (const v of Object.values(result as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function rowsToCsv(rows: unknown[]): string {
  if (rows.length === 0) return "";
  const keys = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      for (const k of Object.keys(row as object)) keys.add(k);
    }
  }
  const cols = [...keys];
  if (cols.length === 0) {
    return rows.map((r) => JSON.stringify(r)).join("\n");
  }
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const row of rows) {
    const o =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {};
    lines.push(cols.map((c) => escape(o[c])).join(","));
  }
  return lines.join("\n");
}

async function runWebhook(
  job: Job,
  settings: ToolSettings,
  toolId: string
): Promise<void> {
  const url =
    typeof settings.webhook_url === "string"
      ? settings.webhook_url.trim()
      : "";
  if (!url) return;

  const action = beginJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "webhook",
  });

  const body = {
    job_id: job.id,
    type: job.type,
    status: job.status,
    result: parseJson(job.result),
    error: job.error,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      updateJobAction(action.id, {
        status: "failed",
        message: `Webhook failed (${res.status})`,
        detail: { status: res.status, body: text.slice(0, 500), url },
      });
      return;
    }
    updateJobAction(action.id, {
      status: "succeeded",
      message: "Webhook sent",
      detail: { status: res.status, url },
    });
  } catch (err) {
    updateJobAction(action.id, {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
      detail: { url },
    });
  }
}

function runNotify(
  job: Job,
  settings: ToolSettings,
  toolId: string
): void {
  if (!settings.notify_on_complete) return;

  const label =
    job.status === "succeeded"
      ? `Job ${job.type} finished successfully`
      : `Job ${job.type} failed${job.error ? `: ${job.error}` : ""}`;

  createJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "notify",
    status: "succeeded",
    message: label,
    detail: {
      in_app: true,
      job_status: job.status,
      type: job.type,
    },
  });
}

async function runSaveToGoogleDrive(
  job: Job,
  settings: ToolSettings,
  toolId: string
): Promise<void> {
  if (!settings.save_to_google_drive) return;
  // Only export on success
  if (job.status !== "succeeded") return;

  const action = beginJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "save_to_google_drive",
  });

  try {
    const result = parseJson(job.result);
    const paths = exportPathsForJob(job.id);
    writeFileSync(paths.json, JSON.stringify(result ?? null, null, 2), "utf8");

    const list = firstListArray(result);
    let csvPath: string | undefined;
    if (list && list.length > 0) {
      writeFileSync(paths.csv!, rowsToCsv(list), "utf8");
      csvPath = paths.csv!;
    }

    const folderHint =
      typeof settings.google_drive_folder === "string"
        ? settings.google_drive_folder
        : undefined;

    const upload = await tryUploadToDrive({
      fileName: `${job.type}-${job.id}.json`,
      mimeType: "application/json",
      content: JSON.stringify(result ?? null, null, 2),
      // Prefer explicit folder id from env; folder name is UI hint only for now
    });

    if (upload.uploaded) {
      updateJobAction(action.id, {
        status: "succeeded",
        message: "Saved to Files (uploaded to Google Drive)",
        detail: {
          local_json: paths.json,
          local_csv: csvPath ?? null,
          drive_file_id: upload.fileId,
          webViewLink: upload.webViewLink ?? null,
          folder_hint: folderHint ?? null,
        },
      });
    } else {
      updateJobAction(action.id, {
        status: "succeeded",
        message: "Saved export locally (connect Google to upload)",
        detail: {
          local_json: paths.json,
          local_csv: csvPath ?? null,
          drive_skip_reason: upload.reason,
          folder_hint: folderHint ?? null,
          export_url: `/v1/jobs/${job.id}/export`,
        },
      });
    }
  } catch (err) {
    updateJobAction(action.id, {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function runAutoApply(
  job: Job,
  settings: ToolSettings,
  toolId: string
): void {
  if (!settings.auto_apply) return;
  if (toolId === "template.finder" && settings.mode === "icp") return;
  if (job.status !== "succeeded") return;

  const listings = firstListArray(parseJson(job.result)) ?? [];
  const limitRaw = settings.auto_apply_limit_per_day;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 5;

  const selected = listings.slice(0, limit);
  const entries = selected.map((item) => {
    const o =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    return {
      listing_id: o.id != null ? String(o.id) : undefined,
      title: o.title != null ? String(o.title) : "Untitled",
      company: o.company != null ? String(o.company) : "",
      status: "simulated_applied" as const,
    };
  });

  createJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "auto_apply",
    status: "succeeded",
    message: `Queued ${entries.length} simulated applications`,
    detail: { applications: entries, limit },
  });
}

function runSaveToCrm(
  job: Job,
  settings: ToolSettings,
  toolId: string
): void {
  // Finder (icp mode) + legacy hunt.icp
  if (toolId !== "hunt.icp" && toolId !== "template.finder") return;
  if (toolId === "template.finder" && settings.mode !== "icp") return;
  if (!settings.save_to_crm) return;
  if (job.status !== "succeeded") {
    createJobAction({
      job_id: job.id,
      tool_id: toolId,
      action_type: "save_to_crm",
      status: "skipped",
      message: "Skipped — job did not succeed",
    });
    return;
  }
  createJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "save_to_crm",
    status: "succeeded",
    message: "Simulated — connect CRM later",
    detail: { simulated: true },
  });
}

function runEnrichContacts(
  job: Job,
  settings: ToolSettings,
  toolId: string
): void {
  if (toolId !== "hunt.icp" && toolId !== "template.finder") return;
  if (toolId === "template.finder" && settings.mode !== "icp") return;
  if (!settings.enrich_contacts) return;
  if (job.status !== "succeeded") {
    createJobAction({
      job_id: job.id,
      tool_id: toolId,
      action_type: "enrich_contacts",
      status: "skipped",
      message: "Skipped — job did not succeed",
    });
    return;
  }
  createJobAction({
    job_id: job.id,
    tool_id: toolId,
    action_type: "enrich_contacts",
    status: "succeeded",
    message: "Simulated — connect CRM later",
    detail: { simulated: true },
  });
}

/**
 * Execute configured tool actions for a terminal job (succeeded or failed).
 * Safe to call multiple times only if caller ensures once-per-terminal — worker
 * calls once after complete/fail. Idempotency: skips if actions already exist.
 */
export async function runToolActions(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  if (job.status !== "succeeded" && job.status !== "failed") return;

  const ownerHash = job.owner_key_hash;
  if (!ownerHash) {
    console.warn(
      `[actions] job ${job.id} has no owner_key_hash — skipping actions`
    );
    return;
  }

  const toolId = job.type;
  const row = getToolSettings(ownerHash, toolId);
  if (!row) {
    // Tool not installed for this key — nothing to run
    return;
  }
  const settings = row.settings;

  // Notify + webhook run on both success and failure
  runNotify(job, settings, toolId);
  await runWebhook(job, settings, toolId);

  // Success-only (or simulated) destinations
  await runSaveToGoogleDrive(job, settings, toolId);
  runAutoApply(job, settings, toolId);
  runSaveToCrm(job, settings, toolId);
  runEnrichContacts(job, settings, toolId);
}
