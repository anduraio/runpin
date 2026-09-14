const KEY = "runpin_api_key";

export function getApiKey(): string | null {
  return localStorage.getItem(KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(KEY);
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const key = getApiKey();
  if (!key) throw new Error("Not logged in");
  const headers = new Headers(opts.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (opts.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string; message?: string }).message ||
        (data as { error?: string }).error ||
        `HTTP ${res.status}`
    );
  }
  return data as T;
}

export type JobAction = {
  id: string;
  job_id: string;
  tool_id: string;
  action_type: string;
  status: string;
  message: string | null;
  detail: unknown;
  created_at: string;
  finished_at: string | null;
};

export type Job = {
  id: string;
  type: string;
  payload: unknown;
  result: unknown;
  error: string | null;
  status: string;
  attempt: number;
  max_attempts: number;
  max_duration_sec: number;
  progress: unknown;
  idempotency_key: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  actions?: JobAction[];
};

export type Schedule = {
  id: string;
  name: string;
  cron: string;
  job_type: string;
  payload: unknown;
  max_attempts: number;
  max_duration_sec: number;
  enabled: boolean;
  last_enqueued_at: string | null;
  next_run_at: string | null;
  created_at: string;
};

export async function fetchJobActions(jobId: string) {
  return api<{ actions: JobAction[] }>(
    `/v1/jobs/${encodeURIComponent(jobId)}/actions`
  );
}

/** Download export with auth header (fetch blob). */
export async function downloadJobExport(
  jobId: string,
  format: "json" | "csv" = "json"
): Promise<void> {
  const key = getApiKey();
  if (!key) throw new Error("Not logged in");
  const res = await fetch(
    `/v1/jobs/${encodeURIComponent(jobId)}/export?format=${format}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string; error?: string }).message ||
        (data as { error?: string }).error ||
        `HTTP ${res.status}`
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${jobId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export type PackManifestDto = {
  id: string;
  title: string;
  description: string;
  jobType: string;
  resultSchema: {
    listField?: string;
    itemFields: Array<{
      key: string;
      label: string;
      kind?: string;
      truncate?: boolean;
      table?: boolean;
    }>;
  };
  settings: Array<{
    key: string;
    kind: string;
    label: string;
    help?: string;
    placeholder?: string;
  }>;
  view: "cards" | "table" | "json";
  actions: Array<{
    id: string;
    kind: string;
    label: string;
    description?: string;
  }>;
  source: "builtin" | "draft";
  destinations?: string[];
};

export async function fetchPacks() {
  return api<{ packs: PackManifestDto[] }>("/v1/packs");
}

export async function fetchPack(id: string) {
  return api<PackManifestDto>(`/v1/packs/${encodeURIComponent(id)}`);
}

export async function applyToListing(jobId: string, listingId: string) {
  return api<{
    action: JobAction;
    listing: Record<string, unknown>;
    applied_ids: string[];
  }>(`/v1/jobs/${encodeURIComponent(jobId)}/actions/apply`, {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId }),
  });
}

export async function fetchAppliedIds(jobId: string) {
  return api<{ applied_ids: string[] }>(
    `/v1/jobs/${encodeURIComponent(jobId)}/applied`
  );
}
