import { nanoid } from "nanoid";
import parser from "cron-parser";
import type { CreateScheduleInput, Schedule } from "../shared/types.js";
import { getDb } from "./schema.js";
import { createJob } from "./jobs.js";
import { hashApiKey } from "../api/auth.js";
import { config } from "../shared/config.js";

export function nextCronUtc(cron: string, from = new Date()): string {
  const interval = parser.parseExpression(cron, {
    currentDate: from,
    tz: "UTC",
  });
  return interval.next().toISOString();
}

export function createSchedule(input: CreateScheduleInput): Schedule {
  const id = nanoid(16);
  const now = new Date().toISOString();
  let nextRun: string | null = null;
  if (input.enabled !== false) {
    nextRun = nextCronUtc(input.cron);
  }
  getDb()
    .prepare(
      `INSERT INTO schedules (
        id, name, cron, job_type, payload, max_attempts, max_duration_sec,
        enabled, next_run_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.cron,
      input.job_type,
      JSON.stringify(input.payload ?? {}),
      input.max_attempts ?? 3,
      input.max_duration_sec ?? 3600,
      input.enabled === false ? 0 : 1,
      nextRun,
      now
    );
  return getSchedule(id)!;
}

export function getSchedule(id: string): Schedule | undefined {
  return getDb().prepare("SELECT * FROM schedules WHERE id = ?").get(id) as
    | Schedule
    | undefined;
}

export function listSchedules(): Schedule[] {
  return getDb()
    .prepare("SELECT * FROM schedules ORDER BY created_at DESC")
    .all() as Schedule[];
}

export function pauseSchedule(id: string): Schedule | null {
  const s = getSchedule(id);
  if (!s) return null;
  getDb()
    .prepare(
      `UPDATE schedules SET enabled = 0, next_run_at = NULL WHERE id = ?`
    )
    .run(id);
  return getSchedule(id)!;
}

export function resumeSchedule(id: string): Schedule | null {
  const s = getSchedule(id);
  if (!s) return null;
  const next = nextCronUtc(s.cron);
  getDb()
    .prepare(
      `UPDATE schedules SET enabled = 1, next_run_at = ? WHERE id = ?`
    )
    .run(next, id);
  return getSchedule(id)!;
}

export function deleteSchedule(id: string): boolean {
  const info = getDb().prepare("DELETE FROM schedules WHERE id = ?").run(id);
  return info.changes > 0;
}

export function tickSchedules(): number {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const due = db
    .prepare(
      `SELECT * FROM schedules
       WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?`
    )
    .all(nowIso) as Schedule[];

  let count = 0;
  for (const s of due) {
    try {
      createJob({
        type: s.job_type as CreateScheduleInput["job_type"],
        payload: JSON.parse(s.payload),
        max_attempts: s.max_attempts,
        max_duration_sec: s.max_duration_sec,
        // Single-tenant MVP: scheduled jobs belong to the configured API key
        owner_key_hash: hashApiKey(config.apiKey()),
      });
      const next = nextCronUtc(s.cron, now);
      db.prepare(
        `UPDATE schedules SET last_enqueued_at = ?, next_run_at = ? WHERE id = ?`
      ).run(nowIso, next, s.id);
      count++;
    } catch (err) {
      console.error(`[scheduler] failed to enqueue schedule ${s.id}:`, err);
    }
  }
  return count;
}
