import { nanoid } from "nanoid";
import type { CreateJobInput, Job, JobStatus } from "../shared/types.js";
import { getDb } from "./schema.js";

export function createJob(input: CreateJobInput): Job {
  const db = getDb();
  if (input.idempotency_key) {
    const existing = db
      .prepare("SELECT * FROM jobs WHERE idempotency_key = ?")
      .get(input.idempotency_key) as Job | undefined;
    if (existing) return existing;
  }

  const id = nanoid(16);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO jobs (
      id, type, payload, status, attempt, max_attempts, max_duration_sec,
      idempotency_key, next_run_at, created_at, owner_key_hash
    ) VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.type,
    JSON.stringify(input.payload ?? {}),
    input.max_attempts ?? 3,
    input.max_duration_sec ?? 3600,
    input.idempotency_key ?? null,
    now,
    now,
    input.owner_key_hash ?? null
  );
  return getJob(id)!;
}

export function getJob(id: string): Job | undefined {
  return getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | Job
    | undefined;
}

export function listJobs(opts: {
  status?: string;
  type?: string;
  limit?: number;
}): Job[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  if (opts.type) {
    clauses.push("type = ?");
    params.push(opts.type);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 200);
  return getDb()
    .prepare(
      `SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...params, limit) as Job[];
}

export function cancelJob(id: string): Job | null {
  const db = getDb();
  const job = getJob(id);
  if (!job) return null;
  if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
    return job;
  }
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE jobs SET status = 'cancelled', finished_at = ?, lease_owner = NULL, lease_until = NULL
     WHERE id = ? AND status IN ('queued', 'running')`
  ).run(now, id);
  return getJob(id)!;
}

export function countRunningJobs(opts: {
  type: string;
  ownerKeyHash: string | null;
}): number {
  const db = getDb();
  if (opts.ownerKeyHash) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM jobs
         WHERE status = 'running' AND type = ? AND owner_key_hash = ?`
      )
      .get(opts.type, opts.ownerKeyHash) as { n: number };
    return row.n;
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM jobs
       WHERE status = 'running' AND type = ? AND owner_key_hash IS NULL`
    )
    .get(opts.type) as { n: number };
  return row.n;
}

export function claimJob(
  workerId: string,
  leaseSec: number,
  skip?: (row: {
    id: string;
    type: string;
    owner_key_hash: string | null;
  }) => boolean
): Job | undefined {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + leaseSec * 1000).toISOString();

  const tx = db.transaction(() => {
    // Reclaim stale leases
    db.prepare(
      `UPDATE jobs SET status = 'queued', lease_owner = NULL, lease_until = NULL
       WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?`
    ).run(nowIso);

    const candidates = db
      .prepare(
        `SELECT id, type, owner_key_hash FROM jobs
         WHERE status = 'queued'
           AND (next_run_at IS NULL OR next_run_at <= ?)
         ORDER BY created_at ASC
         LIMIT 50`
      )
      .all(nowIso) as {
      id: string;
      type: string;
      owner_key_hash: string | null;
    }[];

    for (const row of candidates) {
      if (skip?.(row)) continue;
      const info = db
        .prepare(
          `UPDATE jobs SET
             status = 'running',
             attempt = attempt + 1,
             lease_owner = ?,
             lease_until = ?,
             started_at = COALESCE(started_at, ?),
             error = NULL
           WHERE id = ? AND status = 'queued'`
        )
        .run(workerId, leaseUntil, nowIso, row.id);

      if (info.changes === 0) continue;
      return getJob(row.id);
    }
    return undefined;
  });

  return tx();
}

export function heartbeat(jobId: string, workerId: string, leaseSec: number): boolean {
  const leaseUntil = new Date(Date.now() + leaseSec * 1000).toISOString();
  const info = getDb()
    .prepare(
      `UPDATE jobs SET lease_until = ?
       WHERE id = ? AND lease_owner = ? AND status = 'running'`
    )
    .run(leaseUntil, jobId, workerId);
  return info.changes > 0;
}

export function completeJob(
  jobId: string,
  workerId: string,
  result: unknown
): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE jobs SET
         status = 'succeeded',
         result = ?,
         finished_at = ?,
         lease_owner = NULL,
         lease_until = NULL,
         progress = NULL
       WHERE id = ? AND lease_owner = ? AND status = 'running'`
    )
    .run(JSON.stringify(result ?? null), now, jobId, workerId);
}

export function failJob(
  jobId: string,
  workerId: string,
  error: string,
  retry: boolean,
  backoffSec: number
): void {
  const db = getDb();
  const job = getJob(jobId);
  if (!job) return;

  const now = new Date();
  const nowIso = now.toISOString();

  if (retry && job.attempt < job.max_attempts) {
    const next = new Date(now.getTime() + backoffSec * 1000).toISOString();
    db.prepare(
      `UPDATE jobs SET
         status = 'queued',
         error = ?,
         lease_owner = NULL,
         lease_until = NULL,
         next_run_at = ?,
         started_at = NULL
       WHERE id = ? AND lease_owner = ?`
    ).run(error, next, jobId, workerId);
  } else {
    db.prepare(
      `UPDATE jobs SET
         status = 'failed',
         error = ?,
         finished_at = ?,
         lease_owner = NULL,
         lease_until = NULL
       WHERE id = ? AND lease_owner = ?`
    ).run(error, nowIso, jobId, workerId);
  }
}

/** Progress blobs get a server-side timestamp so the UI can show "when". */
function stampProgress(progress: unknown): string {
  const base =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : { value: progress };
  return JSON.stringify({ ...base, at: new Date().toISOString() });
}

export function setProgress(
  jobId: string,
  workerId: string,
  progress: unknown
): void {
  getDb()
    .prepare(
      `UPDATE jobs SET progress = ?
       WHERE id = ? AND lease_owner = ? AND status = 'running'`
    )
    .run(stampProgress(progress), jobId, workerId);
}

/**
 * Progress reported out-of-band (e.g. a callback service mid-run).
 * Only running jobs accept progress; returns false when the job moved on.
 */
export function reportProgress(jobId: string, progress: unknown): boolean {
  const info = getDb()
    .prepare(
      `UPDATE jobs SET progress = ? WHERE id = ? AND status = 'running'`
    )
    .run(stampProgress(progress), jobId);
  return info.changes > 0;
}

export function isCancelled(jobId: string): boolean {
  const job = getJob(jobId);
  return job?.status === "cancelled";
}

export function jobStats(): {
  queued: number;
  running: number;
  succeeded_recent: number;
  failed_recent: number;
} {
  const db = getDb();
  const countStatus = (status: string) =>
    (db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = ?").get(status) as { n: number }).n;
  return {
    queued: countStatus("queued"),
    running: countStatus("running"),
    succeeded_recent: countStatus("succeeded"),
    failed_recent: countStatus("failed"),
  };
}
