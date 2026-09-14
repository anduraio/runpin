# Runpin

Self-hosted durable job runner for AI agents and workflows. Escape Vercel `maxDuration` for long AI jobs, run cron schedules (UTC), and keep an honest Activity board. Enqueue over HTTP, get **202** back, and walk away.

Runpin is **engine-only**: there is no shelf of ready-made tools and no tool builder. `echo` is for smoke tests and `http_callback` hands real work to a service you already run; custom job types are registered over the API.

## Features

- **HTTP API** (Bearer `RUNPIN_API_KEY`): enqueue, list, get, cancel jobs
- **Worker** with lease/lock, heartbeat, stale reclaim, timeout → fail + retry/backoff
- **Handlers**: `echo`, `http_callback`; legacy `template.*` / `hunt.*` / `notify.webhook` stubs stay runnable for old jobs
- **Cron schedules** (UTC)
- **Public landing** at `/` (no API key) and a guide at `/guide`
- **Operator web UI**:
  - **Simple**: Home (queue shortcuts) + Routines (friendly schedules) + **Activity** board
  - **Advanced**: Jobs table, JSON create job, cron schedules
- **Custom job types** as packs — registered over the API; see [docs/PACK-SDK.md](docs/PACK-SDK.md)
- **Concurrency**: per-tool setting plus a `WORKER_CONCURRENCY` process cap

## Web UI: Simple vs Advanced

Public marketing lives at **`/`**. After login you land on **Home** (`/app`) — quick links to the queue, nothing to install.

- **Activity** (`/activity`; `/live` redirects here) — shared board of what’s running, waiting, and finished (plain-language counts; silent poll). See [docs/TOOL-RESULTS.md](docs/TOOL-RESULTS.md).
- **Routines** (`/routines`) — pause/resume/delete cron schedules with plain-English labels.
- **Advanced** — Jobs (`/advanced/jobs`), New job JSON (`/advanced/jobs/new`), Schedules cron (`/advanced/schedules`). Job detail stays at `/jobs/:id`.

There is no catalog, no tool builder, and no “my tools” shelf: job types come from the code (`echo`, `http_callback`, legacy stubs) and from custom packs registered over the API — `POST /v1/pack-drafts`, then `POST /v1/tools/installed` and `PUT /v1/tools/installed/:toolId/settings` for runner settings.

## Quickstart (Docker)

```bash
cp .env.example .env
# edit RUNPIN_API_KEY
docker compose up --build
```

- Landing: http://localhost:3000/  
- Operator (after login): http://localhost:3000/app  
- Login with your `RUNPIN_API_KEY`

### Echo job end-to-end

```bash
export RUNPIN_API_KEY=dev-api-key   # or your .env value
curl -s -X POST http://localhost:3000/v1/jobs \
  -H "Authorization: Bearer $RUNPIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"echo","payload":{"hello":"runpin"}}'
# → {"id":"..."}  (HTTP 202)

# poll until succeeded
curl -s http://localhost:3000/v1/jobs/<id> \
  -H "Authorization: Bearer $RUNPIN_API_KEY"
```

Or use `scripts/echo-e2e.sh` — it runs the echo job **and** an `http_callback` job against a local stub URL.

## Demo seed

Populate SQLite with a small, honest demo set (one custom job type, jobs in every state, routines). **Wipes** all jobs, schedules, `account_tools`, and `pack_drafts`.

```bash
npm run seed:demo
```

Then open `/app`, `/activity`, `/routines`, `/advanced/jobs`, and any job detail (`/jobs/:id`). Login with your `RUNPIN_API_KEY` (from `.env` or `dev-api-key`).

## Local (without Docker)

```bash
npm install
cp .env.example .env
npm run build
# terminal 1
npm run start:api
# terminal 2
npm run start:worker
```

Dev (API hot reload): `npm run dev:api` + `npm run dev:worker` + optionally `npm run dev:web` (Vite on :5173).

## Enqueue from an agent or workflow (Vercel → Runpin)

From a serverless function or an agent runner, fire-and-forget a long job instead of running it inside the request:

```ts
export async function enqueueLongJob(payload: unknown) {
  const res = await fetch(`${process.env.RUNPIN_URL}/v1/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RUNPIN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "http_callback",
      payload: {
        callback_url: `${process.env.RUNNER_URL}/hooks/runpin`,
        ...payload,
      },
      max_duration_sec: 3600,
      max_attempts: 20,
      idempotency_key: `agent-run-${/* your stable key */}`,
    }),
  });
  if (res.status !== 202) {
    throw new Error(`runpin enqueue failed: ${res.status} ${await res.text()}`);
  }
  const { id } = await res.json();
  return id; // return immediately — the worker POSTs your callback_url
}
```

- **202** means queued, not done. Poll `GET /v1/jobs/:id` for `status: "succeeded" | "failed"`, or let the callback POST land in your app as the completion signal.
- `idempotency_key` makes the enqueue safe to retry — the same key returns the existing job instead of a duplicate.
- Runpin calls `callback_url` with the rest of the payload minus `callback_url` / `callback_bearer`. Contract: [docs/CUSTOM-RUNNERS.md](docs/CUSTOM-RUNNERS.md).

## Worker concurrency

Each installed tool has **How many at once** on its Settings page (default `1`). The worker will not run more of that tool in parallel than that number.

`WORKER_CONCURRENCY` on the worker process is a **ceiling** for all tools combined (see `.env.example`, default `1`). A tool cannot exceed the process cap. Startup logs `[worker] process cap=N`.

Public guide: **`/guide`**. Custom runner contract (`http_callback`): [docs/CUSTOM-RUNNERS.md](docs/CUSTOM-RUNNERS.md).

Packs (result UI + settings + actions): [docs/PACK-SDK.md](docs/PACK-SDK.md).

## Cron / timezone

All cron expressions are **UTC**. Example: `0 2 * * *` runs every day at 02:00 UTC.

## Job statuses

`queued` → `running` → `succeeded` | `failed` | `cancelled`

A run that errors or exceeds `max_duration_sec` is retried with exponential backoff until `max_attempts`, then fails with the last error; **cancel** is immediate and terminal. Stale leases (worker died mid-run) are reclaimed by the next claim.

## API overview

| Method | Path | Notes |
|--------|------|--------|
| GET | `/v1/tools/catalog` | Custom tools only (the shelf is empty) |
| GET | `/v1/tools/installed` | Installed tools |
| POST | `/v1/tools/installed` | Body `{ tool_id }` → add |
| DELETE | `/v1/tools/installed/:toolId` | Remove |
| POST | `/v1/jobs` | 202 `{ id }` |
| GET | `/v1/jobs/:id` | |
| GET | `/v1/jobs?status=&type=` | |
| POST | `/v1/jobs/:id/cancel` | |
| POST | `/v1/jobs/:id/progress` | `{ stage, message, percent? }` from the running service |
| POST/GET | `/v1/schedules` | |
| POST | `/v1/schedules/:id/pause` \| `resume` | |
| DELETE | `/v1/schedules/:id` | |
| GET | `/v1/packs` | Pack manifests (builtins + drafts) |
| POST | `/v1/jobs/:id/actions/apply` | `{ listing_id }` simulated apply |

## Non-goals (MVP)

- Multi-tenant auth / RBAC beyond a single shared API key
- Distributed queue (Postgres/Redis) — SQLite is intentional for MVP
- A shelf of ready-made tools (Finder and the job templates are a separate, later product)
- Exactly-once delivery guarantees across processes
- Horizontal multi-worker correctness beyond lease reclaim

## License

MIT
