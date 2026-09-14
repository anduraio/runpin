# Results & Activity

Runpin is **one app** for every job: a shared Activity board for everything in flight, plus a result view on job detail (driven by packs).

## Activity board

**Activity** (`/activity`, formerly `/live`) is the shared board:

- **Running now** — jobs currently executing
- **Waiting** — jobs queued to run
- **Finished** — recent successes and failures (with a short error snippet on failures)

Anything enqueued over the API shows up here. Counts use plain language (“3 running”, “5 waiting”). The page polls quietly; no worker/lease/concurrency jargon.

## Job detail results

Job detail (`/jobs/:id`) shows status in plain words and renders `job.result` from the pack registry:

| Type | Renderer |
|------|----------|
| **Custom tool** (draft pack) | View from the draft manifest — `cards`, `table`, or `json` |
| **Unknown / no pack** | JSON fallback |
| Legacy `template.*` / `hunt.*` rows | Their old packs still resolve, so old jobs render as before |
| `echo` / `http_callback` | JSON (`http_callback` stores `{ status, body }` from the callback) |

Renderers come from the **Pack SDK** (`definePack` / `getPack`) — see [PACK-SDK.md](./PACK-SDK.md). Keep the Activity board type-agnostic.

## Runner + action settings (API only)

Settings live on `account_tools.settings` (keyed by API key hash + job type). There is no settings screen — use the API (Bearer auth, same key as everything else):

- `GET /v1/tools/installed/:toolId/settings` → `{ tool_id, settings }`
- `PUT /v1/tools/installed/:toolId/settings` with `{ settings: object }` — replace after light validation

Common fields on every installed type:

- **How many at once** (`concurrency`, default `1`, max `20`) — the worker will not run more of this type in parallel than this. `WORKER_CONCURRENCY` is the process-wide ceiling.
- **Notify on finish** (`notify_on_complete`) and **Webhook URL** (`webhook_url`)

Legacy shelf settings (`mode`, `auto_apply`, Drive, CRM) still validate for old tool ids.

**These run automatically when a job finishes.** The worker calls `runToolActions` after `completeJob` / terminal `failJob`. Jobs store `owner_key_hash` at create time so the worker can load the right settings.

## Actions that execute today

After a terminal job status, configured actions are recorded in `job_actions` and shown on Job Detail → **Actions**:

| Action | Behavior |
|--------|----------|
| **notify** | In-app notification row when `notify_on_complete` is true (success or failure) |
| **webhook** | POST `{ job_id, type, status, result, error }` to `webhook_url` when set |
| **save_to_google_drive** | Writes `data/exports/{job_id}.json` (and `.csv` when the result has a list). If `GOOGLE_DRIVE_FOLDER_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` are set, attempts a real Drive upload; otherwise succeeds locally with “Saved export locally (connect Google to upload)”. Download via `GET /v1/jobs/:id/export` |
| **auto_apply** / **save_to_crm** / **enrich_contacts** | Legacy: only for `template.finder` / `hunt.*` jobs. Simulated records — real integrations later |

API:

- `GET /v1/jobs/:id/actions` → `{ actions: [...] }`
- `GET /v1/jobs/:id` includes `actions` on the job payload
- `GET /v1/jobs/:id/export?format=json|csv` — download local export when present

## Design rule

> One shared queue + Activity board. Per-type **result renderers** and **actions**, not a separate app per tool.
