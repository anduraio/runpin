import { config } from "../shared/config.js";
import { getDb } from "../db/schema.js";
import {
  claimJob,
  completeJob,
  countRunningJobs,
  failJob,
  getJob,
  heartbeat,
  isCancelled,
  setProgress,
} from "../db/jobs.js";
import { getToolSettings } from "../db/tools.js";
import { parseRunnerConcurrency } from "../shared/toolSettings.js";
import { tickSchedules } from "../db/schedules.js";
import { getHandler } from "../handlers/index.js";
import { runToolActions } from "../actions/index.js";
import type { Job } from "../shared/types.js";
import { initPackDrafts } from "../db/packDrafts.js";

const workerId = config.workerId();
const leaseSec = config.workerLeaseSec();
const heartbeatSec = config.workerHeartbeatSec();
const pollMs = config.workerPollMs();
const schedulerTickMs = config.schedulerTickMs();
const concurrency = config.workerConcurrency();

getDb();
initPackDrafts();
console.log(`[worker] starting id=${workerId} lease=${leaseSec}s`);
console.log(`[worker] process cap=${concurrency} (per-tool limit is each runner's settings)`);

function runnerConcurrency(job: {
  type: string;
  owner_key_hash: string | null;
}): number {
  let n = 1;
  if (job.owner_key_hash) {
    const row = getToolSettings(job.owner_key_hash, job.type);
    n = parseRunnerConcurrency(row?.settings);
  }
  return Math.min(concurrency, n);
}

let lastScheduler = 0;

async function maybeRunActions(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  if (job.status !== "succeeded" && job.status !== "failed") return;
  try {
    await runToolActions(jobId);
    console.log(`[actions] ran pipeline for job ${jobId} (status=${job.status})`);
  } catch (err) {
    console.error(`[actions] pipeline error for ${jobId}:`, err);
  }
}

async function runJob(job: Job): Promise<void> {
  const handler = getHandler(job.type);
  if (!handler) {
    failJob(job.id, workerId, `unknown job type: ${job.type}`, false, 0);
    await maybeRunActions(job.id);
    return;
  }

  const controller = new AbortController();
  const timeoutMs = job.max_duration_sec * 1000;
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  // Poll for cancel often (cheap read) so an aborted run frees its slot fast.
  // Heartbeat stays on its own, slower cadence.
  const CANCEL_POLL_SEC = 2;
  const cancelPollMs = Math.min(heartbeatSec, CANCEL_POLL_SEC) * 1000;
  let lastBeat = Date.now();
  const hb = setInterval(() => {
    if (isCancelled(job.id)) {
      controller.abort("cancelled");
      return;
    }
    if (Date.now() - lastBeat >= heartbeatSec * 1000) {
      lastBeat = Date.now();
      const ok = heartbeat(job.id, workerId, leaseSec);
      if (!ok) controller.abort("lost_lease");
    }
  }, cancelPollMs);

  try {
    const result = await handler({
      job,
      signal: controller.signal,
      setProgress: (p) => setProgress(job.id, workerId, p),
    });
    if (isCancelled(job.id)) {
      console.log(`[worker] job ${job.id} cancelled during run`);
      return;
    }
    completeJob(job.id, workerId, result);
    console.log(`[worker] job ${job.id} succeeded (type=${job.type})`);
    await maybeRunActions(job.id);
  } catch (err) {
    if (isCancelled(job.id)) {
      console.log(`[worker] job ${job.id} cancelled`);
      return;
    }
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : String(err);
    const reason = controller.signal.aborted
      ? controller.signal.reason
      : undefined;
    const isTimeout = reason === "timeout";
    const error = isTimeout
      ? `timeout after ${job.max_duration_sec}s`
      : reason === "lost_lease"
        ? "lease lost — the job was reclaimed by another worker"
        : msg;
    const attempt = job.attempt;
    const backoff = Math.min(300, Math.pow(2, attempt) * 2);
    const willRetry = attempt < job.max_attempts;
    failJob(job.id, workerId, error, willRetry, backoff);
    console.log(
      `[worker] job ${job.id} failed${
        willRetry ? `, retrying in ${backoff}s` : ""
      }: ${error} (attempt ${attempt}/${job.max_attempts})`
    );
    // Only run actions on terminal failure (not re-queued retry)
    await maybeRunActions(job.id);
  } finally {
    clearTimeout(timeout);
    clearInterval(hb);
  }
}

async function loop(): Promise<void> {
  /** In-flight job promises — size is the concurrency counter. */
  const inFlight = new Set<Promise<void>>();

  while (true) {
    try {
      const now = Date.now();
      if (now - lastScheduler >= schedulerTickMs) {
        const n = tickSchedules();
        if (n > 0) console.log(`[scheduler] enqueued ${n} job(s)`);
        lastScheduler = now;
      }

      // Fill free slots one claim at a time (SQLite claimJob locking is safe).
      // Each tool/runner has its own concurrency in settings; process cap is the ceiling.
      while (inFlight.size < concurrency) {
        const job = claimJob(workerId, leaseSec, (row) => {
          const limit = runnerConcurrency(row);
          const running = countRunningJobs({
            type: row.type,
            ownerKeyHash: row.owner_key_hash,
          });
          return running >= limit;
        });
        if (!job) break;
        console.log(
          `[worker] claimed ${job.id} type=${job.type} attempt=${job.attempt} in_flight=${inFlight.size + 1}/${concurrency}`
        );
        const p = runJob(job).finally(() => {
          inFlight.delete(p);
        });
        inFlight.add(p);
      }

      // N=1 (or any time we are full): wait for one to finish before looping.
      // When serial (concurrency=1), this preserves await-one-at-a-time behavior.
      if (inFlight.size >= concurrency) {
        await Promise.race(inFlight);
        continue;
      }
    } catch (err) {
      console.error("[worker] loop error:", err);
    }
    await sleep(pollMs);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

loop().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
