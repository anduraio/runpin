import { resolve } from "node:path";

function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${key}`);
  return v;
}

export const config = {
  apiKey: () => env("RUNPIN_API_KEY", "dev-api-key"),
  databasePath: () =>
    resolve(process.env.DATABASE_PATH ?? "./data/runpin.db"),
  port: () => Number(process.env.PORT ?? 3000),
  workerPollMs: () => Number(process.env.WORKER_POLL_MS ?? 1000),
  workerLeaseSec: () => Number(process.env.WORKER_LEASE_SEC ?? 60),
  workerHeartbeatSec: () => Number(process.env.WORKER_HEARTBEAT_SEC ?? 20),
  workerConcurrency: () => {
    const n = Number(process.env.WORKER_CONCURRENCY ?? 1);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  },
  workerId: () =>
    process.env.WORKER_ID ?? `worker-${process.pid}-${Date.now()}`,
  schedulerTickMs: () => Number(process.env.SCHEDULER_TICK_MS ?? 15000),
};
