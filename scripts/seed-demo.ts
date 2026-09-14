/**
 * Demo seed for Runpin — wipes jobs, job_actions, schedules, pack_drafts, and
 * account_tools, then inserts a small honest dataset so Activity, Home, and job
 * detail look real (one builder-made tool, jobs in every state, routines).
 *
 * Usage: npm run seed:demo
 * Uses DATABASE_PATH (default ./data/runpin.db) and RUNPIN_API_KEY from env/.env
 * (fallback: dev-api-key). Same hash as src/api/auth.ts.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { nanoid } from "nanoid";
import { hashApiKey } from "../src/api/auth.js";
import { getDb } from "../src/db/schema.js";
import { createPackDraft } from "../src/db/packDrafts.js";
import { nextCronUtc } from "../src/db/schedules.js";
import { config } from "../src/shared/config.js";

/** Minimal .env loader (no dotenv dependency). Does not override existing env. */
function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function isoMinutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function isoMinutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

/** The one builder-made tool this demo ships. */
const CUSTOM_TOOL = {
  id: "custom.apartment-hunt",
  title: "Apartment hunt",
  description: "Listings near the office, as cards.",
  view: "cards" as const,
  listField: "listings",
  actions: ["save_drive", "notify"] as Array<
    "apply" | "save_drive" | "notify" | "webhook"
  >,
  itemFields: [
    { key: "title", label: "Title", kind: "string" as const, table: true },
    { key: "area", label: "Area", kind: "string" as const, table: true },
    { key: "price", label: "Price", kind: "string" as const, table: true },
    { key: "url", label: "Link", kind: "url" as const, table: true },
  ],
};

const CUSTOM_RESULT = {
  listings: [
    {
      id: "apt_kemang_1",
      title: "2BR near MRT",
      area: "Kemang",
      price: "Rp 9.5jt/mo",
      url: "https://example.com/apt/1",
    },
    {
      id: "apt_senopati_2",
      title: "1BR + balcony",
      area: "Senopati",
      price: "Rp 7.8jt/mo",
      url: "https://example.com/apt/2",
    },
    {
      id: "apt_tebet_3",
      title: "3BR, quiet street",
      area: "Tebet",
      price: "Rp 12jt/mo",
      url: "https://example.com/apt/3",
    },
    {
      id: "apt_menteng_4",
      title: "Studio, newly built",
      area: "Menteng",
      price: "Rp 6.2jt/mo",
      url: "https://example.com/apt/4",
    },
  ],
};

type JobSeed = {
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  progress?: unknown;
  attempt?: number;
  max_attempts?: number;
  created_mins_ago: number;
  started_mins_ago?: number;
  finished_mins_ago?: number;
  lease_owner?: string | null;
  lease_until_mins?: number | null;
};

function buildJobs(): JobSeed[] {
  return [
    // —— Running (worker holds the lease) ——
    {
      type: CUSTOM_TOOL.id,
      status: "running",
      payload: { notes: "near MRT", sample: true },
      progress: { message: "Scanning listings… 40%", pct: 40 },
      attempt: 1,
      created_mins_ago: 6,
      started_mins_ago: 4,
      lease_owner: "worker-demo",
      lease_until_mins: 30,
    },
    {
      type: "http_callback",
      status: "running",
      payload: { callback_url: "https://example.com/hooks/runpin", action: "compute" },
      progress: { stage: "Calling callback URL", url: "https://example.com/hooks/runpin" },
      attempt: 1,
      created_mins_ago: 12,
      started_mins_ago: 9,
      lease_owner: "worker-demo",
      lease_until_mins: 30,
    },
    {
      type: "echo",
      status: "running",
      payload: { hello: "long-run" },
      progress: { message: "Still working…", pct: 55 },
      attempt: 1,
      created_mins_ago: 18,
      started_mins_ago: 14,
      lease_owner: "worker-demo",
      lease_until_mins: 30,
    },

    // —— Waiting ——
    {
      type: "echo",
      status: "queued",
      payload: { hello: "queued-ping", n: 1 },
      created_mins_ago: 3,
    },
    {
      type: "http_callback",
      status: "queued",
      payload: {
        callback_url: "https://example.com/hooks/runpin",
        action: "nightly-export",
      },
      created_mins_ago: 2,
    },
    {
      type: CUSTOM_TOOL.id,
      status: "queued",
      payload: { notes: "after the callback finishes", sample: true },
      created_mins_ago: 1,
    },

    // —— Finished well ——
    {
      type: CUSTOM_TOOL.id,
      status: "succeeded",
      payload: { notes: "near MRT", sample: true },
      result: CUSTOM_RESULT,
      attempt: 1,
      created_mins_ago: 120,
      started_mins_ago: 118,
      finished_mins_ago: 100,
    },
    {
      type: "http_callback",
      status: "succeeded",
      payload: { callback_url: "https://example.com/hooks/runpin", action: "compute" },
      result: { status: 200, body: { ok: true, rows: 42 } },
      attempt: 1,
      created_mins_ago: 200,
      started_mins_ago: 199,
      finished_mins_ago: 190,
    },
    {
      type: "echo",
      status: "succeeded",
      payload: { hello: "runpin", demo: true },
      result: { hello: "runpin", demo: true },
      attempt: 1,
      created_mins_ago: 90,
      started_mins_ago: 89,
      finished_mins_ago: 89,
    },
    {
      type: "echo",
      status: "succeeded",
      payload: { hello: "batch-a" },
      result: { hello: "batch-a" },
      attempt: 1,
      created_mins_ago: 420,
      started_mins_ago: 419,
      finished_mins_ago: 419,
    },
    {
      type: "echo",
      status: "succeeded",
      payload: { hello: "batch-b" },
      result: { hello: "batch-b" },
      attempt: 1,
      created_mins_ago: 430,
      started_mins_ago: 429,
      finished_mins_ago: 429,
    },

    // —— Failed, with the real error text the worker writes ——
    {
      type: "http_callback",
      status: "failed",
      payload: { callback_url: "https://example.com/hooks/down" },
      error:
        "callback 502 from https://example.com/hooks/down: upstream unavailable",
      attempt: 3,
      max_attempts: 3,
      created_mins_ago: 75,
      started_mins_ago: 70,
      finished_mins_ago: 68,
    },
    {
      type: CUSTOM_TOOL.id,
      status: "failed",
      payload: { notes: "slow source", sample: true },
      error: "timeout after 600s",
      attempt: 3,
      max_attempts: 3,
      created_mins_ago: 400,
      started_mins_ago: 398,
      finished_mins_ago: 395,
    },

    // —— Cancelled ——
    {
      type: "echo",
      status: "cancelled",
      payload: { hello: "cancelled-mid-run" },
      attempt: 1,
      created_mins_ago: 50,
      started_mins_ago: 48,
      finished_mins_ago: 45,
    },
    {
      type: "http_callback",
      status: "cancelled",
      payload: { callback_url: "https://example.com/hooks/never-called" },
      attempt: 0,
      created_mins_ago: 40,
      finished_mins_ago: 39,
    },
  ];
}

type ScheduleSeed = {
  name: string;
  cron: string;
  job_type: string;
  payload: unknown;
  enabled: boolean;
  created_mins_ago: number;
  last_enqueued_mins_ago?: number | null;
};

const SCHEDULES: ScheduleSeed[] = [
  {
    name: "Morning apartment sweep",
    cron: "0 2 * * *", // 02:00 UTC
    job_type: CUSTOM_TOOL.id,
    payload: { notes: "near MRT", sample: true },
    enabled: true,
    created_mins_ago: 10_000,
    last_enqueued_mins_ago: 120,
  },
  {
    name: "Hourly callback ping",
    cron: "0 * * * *",
    job_type: "http_callback",
    payload: {
      callback_url: "https://example.com/hooks/runpin",
      action: "ping",
    },
    enabled: true,
    created_mins_ago: 5000,
    last_enqueued_mins_ago: 60,
  },
  {
    name: "Health echo (paused)",
    cron: "0 */6 * * *",
    job_type: "echo",
    payload: { hello: "health-check" },
    enabled: false,
    created_mins_ago: 3000,
    last_enqueued_mins_ago: null,
  },
];

function main() {
  loadDotEnv();

  const apiKey = config.apiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const dbPath = config.databasePath();
  const db = getDb();

  console.log(`[seed:demo] database: ${dbPath}`);
  console.log(`[seed:demo] api key hash (sha256): ${apiKeyHash.slice(0, 12)}…`);
  console.log(
    `[seed:demo] WIPING jobs, job_actions, schedules, pack_drafts, and account_tools — then inserting fresh demo data`
  );

  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM job_actions").run();
    db.prepare("DELETE FROM jobs").run();
    db.prepare("DELETE FROM schedules").run();
    db.prepare("DELETE FROM account_tools").run();
    try {
      db.prepare("DELETE FROM pack_drafts").run();
    } catch {
      /* table may not exist yet */
    }
  });
  wipe();

  // One builder-made tool, installed under the demo key.
  createPackDraft({
    id: CUSTOM_TOOL.id,
    title: CUSTOM_TOOL.title,
    description: CUSTOM_TOOL.description,
    view: CUSTOM_TOOL.view,
    listField: CUSTOM_TOOL.listField,
    actions: CUSTOM_TOOL.actions,
    itemFields: CUSTOM_TOOL.itemFields,
  });
  db.prepare(
    `INSERT INTO account_tools (id, api_key_hash, tool_id, added_at, settings) VALUES (?, ?, ?, ?, ?)`
  ).run(
    nanoid(16),
    apiKeyHash,
    CUSTOM_TOOL.id,
    isoMinutesAgo(300),
    JSON.stringify({
      concurrency: 2,
      notify_on_complete: true,
      webhook_url: "https://hooks.example.com/runpin",
    })
  );

  const insertJob = db.prepare(
    `INSERT INTO jobs (
      id, type, payload, result, error, status, attempt, max_attempts,
      max_duration_sec, progress, idempotency_key, lease_owner, lease_until,
      next_run_at, created_at, started_at, finished_at, owner_key_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  /** Track the finished custom-tool job so we can attach demo actions. */
  let demoToolJobId: string | null = null;

  const jobTx = db.transaction(() => {
    for (const j of buildJobs()) {
      const created = isoMinutesAgo(j.created_mins_ago);
      const started =
        j.started_mins_ago != null ? isoMinutesAgo(j.started_mins_ago) : null;
      const finished =
        j.finished_mins_ago != null ? isoMinutesAgo(j.finished_mins_ago) : null;
      const leaseUntil =
        j.lease_until_mins != null ? isoMinutesFromNow(j.lease_until_mins) : null;
      const id = nanoid(16);
      if (
        j.status === "succeeded" &&
        j.type === CUSTOM_TOOL.id &&
        j.result === CUSTOM_RESULT &&
        !demoToolJobId
      ) {
        demoToolJobId = id;
      }
      insertJob.run(
        id,
        j.type,
        JSON.stringify(j.payload ?? {}),
        j.result !== undefined ? JSON.stringify(j.result) : null,
        j.error ?? null,
        j.status,
        j.attempt ?? (j.status === "queued" ? 0 : 1),
        j.max_attempts ?? 3,
        j.type === CUSTOM_TOOL.id ? 600 : 3600,
        j.progress !== undefined ? JSON.stringify(j.progress) : null,
        null,
        j.lease_owner ?? null,
        leaseUntil,
        j.status === "queued" ? created : null,
        created,
        started,
        finished,
        apiKeyHash
      );
    }
  });
  jobTx();

  // Sample job_actions so Job Detail → Actions shows without a live worker run.
  const insertAction = db.prepare(
    `INSERT INTO job_actions (
      id, job_id, tool_id, action_type, status, message, detail, created_at, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const exportsDir = resolve(dirname(dbPath), "exports");
  mkdirSync(exportsDir, { recursive: true });

  const actionTx = db.transaction(() => {
    if (!demoToolJobId) return;
    const jobId = demoToolJobId;
    const created = isoMinutesAgo(101);
    const finished = isoMinutesAgo(100);

    const jsonPath = join(exportsDir, `${jobId}.json`);
    const csvPath = join(exportsDir, `${jobId}.csv`);
    writeFileSync(jsonPath, JSON.stringify(CUSTOM_RESULT, null, 2), "utf8");
    const csvLines = [
      "id,title,area,price,url",
      ...CUSTOM_RESULT.listings.map(
        (l) => `"${l.id}","${l.title}","${l.area}","${l.price}","${l.url}"`
      ),
    ];
    writeFileSync(csvPath, csvLines.join("\n"), "utf8");

    insertAction.run(
      nanoid(16),
      jobId,
      CUSTOM_TOOL.id,
      "notify",
      "succeeded",
      `Job ${CUSTOM_TOOL.id} finished successfully`,
      JSON.stringify({ in_app: true, job_status: "succeeded", type: CUSTOM_TOOL.id }),
      created,
      finished
    );
    insertAction.run(
      nanoid(16),
      jobId,
      CUSTOM_TOOL.id,
      "webhook",
      "succeeded",
      "Webhook sent",
      JSON.stringify({ status: 200, url: "https://hooks.example.com/runpin" }),
      created,
      finished
    );
    insertAction.run(
      nanoid(16),
      jobId,
      CUSTOM_TOOL.id,
      "save_to_google_drive",
      "succeeded",
      "Saved export locally (connect Google to upload)",
      JSON.stringify({
        local_json: jsonPath,
        local_csv: csvPath,
        export_url: `/v1/jobs/${jobId}/export`,
        folder_hint: null,
      }),
      created,
      finished
    );
  });
  actionTx();

  const insertSchedule = db.prepare(
    `INSERT INTO schedules (
      id, name, cron, job_type, payload, max_attempts, max_duration_sec,
      enabled, last_enqueued_at, next_run_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const schedTx = db.transaction(() => {
    for (const s of SCHEDULES) {
      const created = isoMinutesAgo(s.created_mins_ago);
      const lastEnq =
        s.last_enqueued_mins_ago != null
          ? isoMinutesAgo(s.last_enqueued_mins_ago)
          : null;
      const nextRun = s.enabled ? nextCronUtc(s.cron) : null;
      insertSchedule.run(
        nanoid(16),
        s.name,
        s.cron,
        s.job_type,
        JSON.stringify(s.payload),
        3,
        3600,
        s.enabled ? 1 : 0,
        lastEnq,
        nextRun,
        created
      );
    }
  });
  schedTx();

  const counts = {
    tools: (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM account_tools WHERE api_key_hash = ?`
        )
        .get(apiKeyHash) as { n: number }
    ).n,
    jobs: (db.prepare(`SELECT COUNT(*) AS n FROM jobs`).get() as { n: number }).n,
    byStatus: Object.fromEntries(
      (
        db
          .prepare(
            `SELECT status, COUNT(*) AS n FROM jobs GROUP BY status ORDER BY status`
          )
          .all() as { status: string; n: number }[]
      ).map((r) => [r.status, r.n])
    ),
    schedules: (
      db.prepare(`SELECT COUNT(*) AS n FROM schedules`).get() as { n: number }
    ).n,
    schedulesEnabled: (
      db
        .prepare(`SELECT COUNT(*) AS n FROM schedules WHERE enabled = 1`)
        .get() as { n: number }
    ).n,
  };

  const actionCount = (
    db.prepare(`SELECT COUNT(*) AS n FROM job_actions`).get() as { n: number }
  ).n;

  console.log(`[seed:demo] installed tools: ${counts.tools}`);
  console.log(`[seed:demo] jobs: ${counts.jobs}`, counts.byStatus);
  console.log(`[seed:demo] job_actions: ${actionCount}`);
  console.log(
    `[seed:demo] schedules: ${counts.schedules} (${counts.schedulesEnabled} enabled, ${counts.schedules - counts.schedulesEnabled} paused)`
  );
  if (demoToolJobId) {
    console.log(`[seed:demo] demo tool job with actions: /jobs/${demoToolJobId}`);
  }
  console.log(
    `[seed:demo] done. Open /app, /activity, /routines, /advanced/jobs, and any /jobs/:id`
  );
}

main();
