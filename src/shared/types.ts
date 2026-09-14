import { z } from "zod";

export const JobStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatus>;

/** Creatable job types: shelf templates + Advanced + legacy aliases + internal. */
export const JOB_TYPES = [
  "template.finder",
  "template.watcher",
  "template.collector",
  "template.repeater",
  "template.brief",
  "template.compare",
  "template.filter",
  "template.delivery",
  "echo",
  "http_callback",
  // Legacy aliases (still enqueueable for demos / migration)
  "hunt.jobs",
  "hunt.icp",
  "hunt.linkedin",
  "notify.webhook",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

/** Builtin job types plus custom tools (`custom.*` draft packs). */
export const JobTypeId = z
  .string()
  .min(2)
  .max(64)
  .regex(
    /^[a-z0-9][a-z0-9._-]{1,63}$/,
    "Use lowercase letters, numbers, dots, dashes"
  );

export const CreateJobSchema = z.object({
  type: JobTypeId,
  payload: z.record(z.unknown()).default({}),
  max_attempts: z.number().int().min(1).max(20).optional().default(3),
  max_duration_sec: z.number().int().min(1).max(86400).optional().default(3600),
  idempotency_key: z.string().min(1).max(256).optional(),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema> & {
  /** Set by API/auth — not accepted from client body. */
  owner_key_hash?: string | null;
};

/** Progress a running job can report out-of-band (callback services). */
export const ProgressReportSchema = z
  .object({
    stage: z.string().min(1).max(120).optional(),
    message: z.string().min(1).max(500).optional(),
    percent: z.number().min(0).max(100).optional(),
  })
  .passthrough();
export type ProgressReport = z.infer<typeof ProgressReportSchema>;

export const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  cron: z.string().min(1).max(100),
  job_type: JobTypeId,
  payload: z.record(z.unknown()).default({}),
  max_attempts: z.number().int().min(1).max(20).optional().default(3),
  max_duration_sec: z.number().int().min(1).max(86400).optional().default(3600),
  enabled: z.boolean().optional().default(true),
});
export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;

export type JobActionStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export interface JobAction {
  id: string;
  job_id: string;
  tool_id: string;
  action_type: string;
  status: JobActionStatus;
  message: string | null;
  detail: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Job {
  id: string;
  type: string;
  payload: string;
  result: string | null;
  error: string | null;
  status: JobStatus;
  attempt: number;
  max_attempts: number;
  max_duration_sec: number;
  progress: string | null;
  idempotency_key: string | null;
  lease_owner: string | null;
  lease_until: string | null;
  next_run_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  owner_key_hash: string | null;
}

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  job_type: string;
  payload: string;
  max_attempts: number;
  max_duration_sec: number;
  enabled: number;
  last_enqueued_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export function jobToJson(job: Job) {
  return {
    id: job.id,
    type: job.type,
    payload: safeParse(job.payload),
    result: job.result ? safeParse(job.result) : null,
    error: job.error,
    status: job.status,
    attempt: job.attempt,
    max_attempts: job.max_attempts,
    max_duration_sec: job.max_duration_sec,
    progress: job.progress ? safeParse(job.progress) : null,
    idempotency_key: job.idempotency_key,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
  };
}

export function jobActionToJson(a: JobAction) {
  return {
    id: a.id,
    job_id: a.job_id,
    tool_id: a.tool_id,
    action_type: a.action_type,
    status: a.status,
    message: a.message,
    detail: a.detail ? safeParse(a.detail) : null,
    created_at: a.created_at,
    finished_at: a.finished_at,
  };
}

export function scheduleToJson(s: Schedule) {
  return {
    id: s.id,
    name: s.name,
    cron: s.cron,
    job_type: s.job_type,
    payload: safeParse(s.payload),
    max_attempts: s.max_attempts,
    max_duration_sec: s.max_duration_sec,
    enabled: !!s.enabled,
    last_enqueued_at: s.last_enqueued_at,
    next_run_at: s.next_run_at,
    created_at: s.created_at,
  };
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
