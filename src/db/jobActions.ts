import { nanoid } from "nanoid";
import type { JobAction, JobActionStatus } from "../shared/types.js";
import { getDb } from "./schema.js";

export function listJobActions(jobId: string): JobAction[] {
  return getDb()
    .prepare(
      `SELECT * FROM job_actions WHERE job_id = ? ORDER BY created_at ASC`
    )
    .all(jobId) as JobAction[];
}

export function createJobAction(input: {
  job_id: string;
  tool_id: string;
  action_type: string;
  status?: JobActionStatus;
  message?: string | null;
  detail?: unknown;
}): JobAction {
  const id = nanoid(16);
  const now = new Date().toISOString();
  const status = input.status ?? "pending";
  const finished =
    status === "succeeded" ||
    status === "failed" ||
    status === "skipped"
      ? now
      : null;
  getDb()
    .prepare(
      `INSERT INTO job_actions (
        id, job_id, tool_id, action_type, status, message, detail, created_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.job_id,
      input.tool_id,
      input.action_type,
      status,
      input.message ?? null,
      input.detail !== undefined ? JSON.stringify(input.detail) : null,
      now,
      finished
    );
  return getJobAction(id)!;
}

export function getJobAction(id: string): JobAction | undefined {
  return getDb()
    .prepare("SELECT * FROM job_actions WHERE id = ?")
    .get(id) as JobAction | undefined;
}

export function updateJobAction(
  id: string,
  patch: {
    status: JobActionStatus;
    message?: string | null;
    detail?: unknown;
  }
): JobAction | undefined {
  const now = new Date().toISOString();
  const finished =
    patch.status === "succeeded" ||
    patch.status === "failed" ||
    patch.status === "skipped"
      ? now
      : null;
  getDb()
    .prepare(
      `UPDATE job_actions SET
         status = ?,
         message = COALESCE(?, message),
         detail = COALESCE(?, detail),
         finished_at = COALESCE(?, finished_at)
       WHERE id = ?`
    )
    .run(
      patch.status,
      patch.message !== undefined ? patch.message : null,
      patch.detail !== undefined ? JSON.stringify(patch.detail) : null,
      finished,
      id
    );
  return getJobAction(id);
}

/** Start an action row as running, then finish via updateJobAction. */
export function beginJobAction(input: {
  job_id: string;
  tool_id: string;
  action_type: string;
}): JobAction {
  return createJobAction({
    ...input,
    status: "running",
  });
}
