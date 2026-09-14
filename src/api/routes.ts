import { readFileSync, existsSync } from "node:fs";
import { Hono } from "hono";
import {
  CreateJobSchema,
  CreateScheduleSchema,
  ProgressReportSchema,
  jobActionToJson,
  jobToJson,
  scheduleToJson,
} from "../shared/types.js";
import {
  createJob,
  getJob,
  listJobs,
  cancelJob,
  jobStats,
  reportProgress,
} from "../db/jobs.js";
import { listJobActions } from "../db/jobActions.js";
import {
  createSchedule,
  listSchedules,
  getSchedule,
  pauseSchedule,
  resumeSchedule,
  deleteSchedule,
  nextCronUtc,
} from "../db/schedules.js";
import {
  addInstalledTool,
  getToolSettings,
  listCatalogWithInstalled,
  listInstalledTools,
  putToolSettings,
  removeInstalledTool,
} from "../db/tools.js";
import { isAllowedJobType, listHandlerTypes } from "../handlers/index.js";
import {
  exportFileExists,
  exportPathsForJob,
} from "../actions/index.js";
import {
  clonePackToDraft,
  createPackDraft,
  deletePackDraft,
  initPackDrafts,
  listPackDraftRows,
  updatePackDraft,
} from "../db/packDrafts.js";
import {
  getPack,
  listPacks,
  packToJson,
  type PackManifest,
} from "../packs/index.js";
import {
  appliedListingIds,
  applyToListing,
} from "../actions/applyListing.js";
import { requireApiKey, type AuthVars } from "./auth.js";

export const v1 = new Hono<{ Variables: AuthVars }>();

initPackDrafts();

v1.use("*", requireApiKey);

v1.get("/health", (c) =>
  c.json({ ok: true, handlers: listHandlerTypes() })
);

v1.get("/tools/catalog", (c) => {
  const hash = c.get("apiKeyHash");
  return c.json({ tools: listCatalogWithInstalled(hash) });
});

v1.get("/tools/installed", (c) => {
  const hash = c.get("apiKeyHash");
  return c.json({ tools: listInstalledTools(hash) });
});

v1.post("/tools/installed", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const toolId =
    body &&
    typeof body === "object" &&
    "tool_id" in body &&
    typeof (body as { tool_id: unknown }).tool_id === "string"
      ? (body as { tool_id: string }).tool_id.trim()
      : "";
  if (!toolId) {
    return c.json({ error: "validation_error", message: "tool_id required" }, 400);
  }
  const hash = c.get("apiKeyHash");
  const result = addInstalledTool(hash, toolId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }
  return c.json(
    { tool_id: result.tool_id, added_at: result.added_at },
    201
  );
});

v1.delete("/tools/installed/:toolId", (c) => {
  const toolId = c.req.param("toolId");
  const hash = c.get("apiKeyHash");
  const ok = removeInstalledTool(hash, toolId);
  if (!ok) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

v1.get("/tools/installed/:toolId/settings", (c) => {
  const toolId = c.req.param("toolId");
  const hash = c.get("apiKeyHash");
  const row = getToolSettings(hash, toolId);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

v1.put("/tools/installed/:toolId/settings", async (c) => {
  const toolId = c.req.param("toolId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const settings =
    body &&
    typeof body === "object" &&
    "settings" in body
      ? (body as { settings: unknown }).settings
      : undefined;
  if (settings === undefined) {
    return c.json(
      { error: "validation_error", message: "settings object required" },
      400
    );
  }
  const hash = c.get("apiKeyHash");
  const result = putToolSettings(hash, toolId, settings);
  if (!result.ok) {
    if (result.error === "not_found") {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json(
      { error: "validation_error", message: result.message ?? "invalid settings" },
      400
    );
  }
  return c.json({ tool_id: result.tool_id, settings: result.settings });
});

v1.post("/jobs", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }
  if (!isAllowedJobType(parsed.data.type)) {
    return c.json(
      {
        error: "validation_error",
        message: `Unknown tool: ${parsed.data.type}`,
      },
      400
    );
  }
  const job = createJob({
    ...parsed.data,
    owner_key_hash: c.get("apiKeyHash"),
  });
  return c.json({ id: job.id }, 202);
});

v1.get("/jobs", (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const limit = c.req.query("limit")
    ? Number(c.req.query("limit"))
    : undefined;
  const jobs = listJobs({ status, type, limit });
  return c.json({ jobs: jobs.map(jobToJson) });
});

v1.get("/jobs/stats", (c) => {
  return c.json(jobStats());
});

v1.get("/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not_found" }, 404);
  const actions = listJobActions(job.id).map(jobActionToJson);
  return c.json({ ...jobToJson(job), actions });
});

v1.get("/jobs/:id/actions", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not_found" }, 404);
  return c.json({ actions: listJobActions(job.id).map(jobActionToJson) });
});

v1.get("/jobs/:id/export", (c) => {
  const id = c.req.param("id");
  const job = getJob(id);
  if (!job) return c.json({ error: "not_found" }, 404);
  if (!exportFileExists(id)) {
    return c.json({ error: "not_found", message: "No export file for this job" }, 404);
  }
  const paths = exportPathsForJob(id);
  const format = (c.req.query("format") ?? "json").toLowerCase();
  if (format === "csv" && paths.csv && existsSync(paths.csv)) {
    const body = readFileSync(paths.csv, "utf8");
    return c.body(body, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}.csv"`,
    });
  }
  if (!existsSync(paths.json)) {
    return c.json({ error: "not_found", message: "No JSON export" }, 404);
  }
  const body = readFileSync(paths.json, "utf8");
  return c.body(body, 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="${id}.json"`,
  });
});

v1.post("/jobs/:id/cancel", (c) => {
  const job = cancelJob(c.req.param("id"));
  if (!job) return c.json({ error: "not_found" }, 404);
  return c.json(jobToJson(job));
});

/**
 * Out-of-band progress for a running job (callback services reporting stages).
 * Accepts the same bearer key; jobs that already finished answer 409.
 */
v1.post("/jobs/:id/progress", async (c) => {
  const id = c.req.param("id");
  const job = getJob(id);
  if (!job) return c.json({ error: "not_found" }, 404);
  if (job.status !== "running") {
    return c.json({ error: "not_running", status: job.status }, 409);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = ProgressReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.flatten() },
      400
    );
  }
  if (!reportProgress(id, parsed.data)) {
    return c.json({ error: "not_running", status: getJob(id)?.status }, 409);
  }
  return c.json({ ok: true });
});

v1.post("/schedules", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = CreateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }
  if (!isAllowedJobType(parsed.data.job_type)) {
    return c.json(
      {
        error: "validation_error",
        message: `Unknown tool: ${parsed.data.job_type}`,
      },
      400
    );
  }
  try {
    // validate cron expression
    nextCronUtc(parsed.data.cron);
  } catch (err) {
    return c.json(
      {
        error: "invalid_cron",
        message: err instanceof Error ? err.message : String(err),
        hint: "Cron expressions are interpreted as UTC.",
      },
      400
    );
  }
  const schedule = createSchedule(parsed.data);
  return c.json(scheduleToJson(schedule), 201);
});

v1.get("/schedules", (c) => {
  return c.json({ schedules: listSchedules().map(scheduleToJson) });
});

v1.get("/schedules/:id", (c) => {
  const s = getSchedule(c.req.param("id"));
  if (!s) return c.json({ error: "not_found" }, 404);
  return c.json(scheduleToJson(s));
});

v1.post("/schedules/:id/pause", (c) => {
  const s = pauseSchedule(c.req.param("id"));
  if (!s) return c.json({ error: "not_found" }, 404);
  return c.json(scheduleToJson(s));
});

v1.post("/schedules/:id/resume", (c) => {
  const s = resumeSchedule(c.req.param("id"));
  if (!s) return c.json({ error: "not_found" }, 404);
  return c.json(scheduleToJson(s));
});

v1.delete("/schedules/:id", (c) => {
  const ok = deleteSchedule(c.req.param("id"));
  if (!ok) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

type DraftFormBody = {
  view: "cards" | "table" | "json";
  listField?: string;
  actions: Array<"apply" | "save_drive" | "notify" | "webhook">;
  itemFields?: PackManifest["resultSchema"]["itemFields"];
};

function parseDraftFormBody(b: Record<string, unknown>): DraftFormBody {
  const actions = Array.isArray(b.actions)
    ? (b.actions as unknown[]).filter(
        (a): a is "apply" | "save_drive" | "notify" | "webhook" =>
          typeof a === "string" &&
          ["apply", "save_drive", "notify", "webhook"].includes(a)
      )
    : [];
  const view =
    b.view === "cards" || b.view === "table" || b.view === "json"
      ? b.view
      : "cards";
  const itemFields = parseItemFields(b.itemFields);
  return {
    view,
    listField: typeof b.listField === "string" ? b.listField : undefined,
    actions,
    itemFields,
  };
}

function parseItemFields(
  raw: unknown
): PackManifest["resultSchema"]["itemFields"] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const fields: PackManifest["resultSchema"]["itemFields"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!key || !label) continue;
    const kind =
      o.kind === "string" ||
      o.kind === "number" ||
      o.kind === "boolean" ||
      o.kind === "url" ||
      o.kind === "text"
        ? o.kind
        : undefined;
    fields.push({
      key,
      label,
      kind,
      truncate: o.truncate === true,
      table: o.table !== false,
    });
  }
  return fields.length ? fields : undefined;
}

/* —— Pack SDK —— */
v1.get("/packs", (c) => {
  initPackDrafts();
  return c.json({ packs: listPacks().map(packToJson) });
});

v1.get("/packs/:id", (c) => {
  initPackDrafts();
  const pack = getPack(c.req.param("id"));
  if (!pack) return c.json({ error: "not_found" }, 404);
  return c.json(packToJson(pack));
});

v1.get("/pack-drafts", (c) => {
  const rows = listPackDraftRows();
  return c.json({
    drafts: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      manifest: JSON.parse(r.manifest_json),
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  });
});

v1.post("/pack-drafts", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "validation_error", message: "object required" }, 400);
  }
  const b = body as Record<string, unknown>;
  const from = typeof b.from === "string" ? b.from.trim() : "";
  if (from) {
    try {
      const row = clonePackToDraft(from);
      return c.json(
        {
          id: row.id,
          title: row.title,
          description: row.description,
          manifest: JSON.parse(row.manifest_json),
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        201
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message === "Unknown tool" ? 404 : 400;
      return c.json(
        {
          error: status === 404 ? "not_found" : "validation_error",
          message,
        },
        status
      );
    }
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) {
    return c.json({ error: "validation_error", message: "title required" }, 400);
  }
  const form = parseDraftFormBody(b);
  try {
    const row = createPackDraft({
      id: typeof b.id === "string" ? b.id : undefined,
      title,
      description: typeof b.description === "string" ? b.description : undefined,
      view: form.view,
      listField: form.listField,
      actions: form.actions,
      itemFields: form.itemFields,
    });
    return c.json(
      {
        id: row.id,
        title: row.title,
        description: row.description,
        manifest: JSON.parse(row.manifest_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      201
    );
  } catch (err) {
    return c.json(
      {
        error: "validation_error",
        message: err instanceof Error ? err.message : String(err),
      },
      400
    );
  }
});

v1.put("/pack-drafts/:id", async (c) => {
  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "validation_error", message: "object required" }, 400);
  }
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) {
    return c.json({ error: "validation_error", message: "title required" }, 400);
  }
  const form = parseDraftFormBody(b);
  try {
    const row = updatePackDraft(id, {
      title,
      description: typeof b.description === "string" ? b.description : undefined,
      view: form.view,
      listField: form.listField,
      actions: form.actions,
      itemFields: form.itemFields,
    });
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json({
      id: row.id,
      title: row.title,
      description: row.description,
      manifest: JSON.parse(row.manifest_json),
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (err) {
    return c.json(
      {
        error: "validation_error",
        message: err instanceof Error ? err.message : String(err),
      },
      400
    );
  }
});

v1.delete("/pack-drafts/:id", (c) => {
  const ok = deletePackDraft(c.req.param("id"));
  if (!ok) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

v1.post("/jobs/:id/actions/apply", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const listingId =
    body &&
    typeof body === "object" &&
    "listing_id" in body &&
    typeof (body as { listing_id: unknown }).listing_id === "string"
      ? (body as { listing_id: string }).listing_id
      : "";
  const result = applyToListing(c.req.param("id"), listingId);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(
    {
      action: jobActionToJson(result.action),
      listing: result.listing,
      applied_ids: appliedListingIds(c.req.param("id")),
    },
    201
  );
});

v1.get("/jobs/:id/applied", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not_found" }, 404);
  return c.json({ applied_ids: appliedListingIds(job.id) });
});
