/**
 * Manual / per-listing apply — simulated pipeline shared with auto_apply.
 * Creates or updates a job_action of type "apply" and records the listing as applied.
 */
import { getJob } from "../db/jobs.js";
import {
  createJobAction,
  listJobActions,
  updateJobAction,
} from "../db/jobActions.js";
import type { JobAction } from "../shared/types.js";

function parseJson<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function listItemsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const o = result as Record<string, unknown>;
    if (Array.isArray(o.listings)) return o.listings;
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

export type ApplyListingResult =
  | { ok: true; action: JobAction; listing: Record<string, unknown> }
  | { ok: false; error: string; status: 400 | 404 | 409 };

/**
 * Apply to a single listing on a hunt.jobs (or compatible) job result.
 * Body: { listing_id }
 */
export function applyToListing(
  jobId: string,
  listingId: string
): ApplyListingResult {
  const job = getJob(jobId);
  if (!job) return { ok: false, error: "not_found", status: 404 };

  const id = listingId.trim();
  if (!id) {
    return { ok: false, error: "listing_id required", status: 400 };
  }

  const result = parseJson<unknown>(job.result);
  const listings = listItemsFromResult(result);
  const found = listings.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const o = item as Record<string, unknown>;
    return o.id != null && String(o.id) === id;
  }) as Record<string, unknown> | undefined;

  if (!found) {
    return {
      ok: false,
      error: `listing_id not found in job result: ${id}`,
      status: 404,
    };
  }

  // Idempotent: if we already have an apply action for this listing, return it
  const existing = listJobActions(jobId).find((a) => {
    if (a.action_type !== "apply") return false;
    const detail = parseJson<{ listing_id?: string }>(a.detail);
    return detail?.listing_id === id;
  });

  const entry = {
    listing_id: id,
    title: found.title != null ? String(found.title) : "Untitled",
    company: found.company != null ? String(found.company) : "",
    url: found.url != null ? String(found.url) : null,
    status: "simulated_applied" as const,
  };

  if (existing) {
    const updated = updateJobAction(existing.id, {
      status: "succeeded",
      message: `Applied (simulated) — ${entry.title}`,
      detail: { listing: entry, listing_id: id },
    });
    return { ok: true, action: updated!, listing: entry };
  }

  const action = createJobAction({
    job_id: jobId,
    tool_id: job.type,
    action_type: "apply",
    status: "succeeded",
    message: `Applied (simulated) — ${entry.title}`,
    detail: { listing: entry, listing_id: id },
  });

  return { ok: true, action, listing: entry };
}

/** Collect listing_ids already marked applied on this job. */
export function appliedListingIds(jobId: string): string[] {
  const ids: string[] = [];
  for (const a of listJobActions(jobId)) {
    if (a.action_type !== "apply" && a.action_type !== "auto_apply") continue;
    const detail = parseJson<Record<string, unknown>>(a.detail);
    if (!detail) continue;
    if (typeof detail.listing_id === "string") {
      ids.push(detail.listing_id);
      continue;
    }
    const apps = detail.applications;
    if (Array.isArray(apps)) {
      for (const app of apps) {
        if (app && typeof app === "object" && "listing_id" in app) {
          const lid = (app as { listing_id?: unknown }).listing_id;
          if (typeof lid === "string") ids.push(lid);
        }
      }
    }
  }
  return [...new Set(ids)];
}
