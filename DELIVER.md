# Runpin MVP — deliverable

Built fresh at `/workspace/runpin` (no git clone). Stack: Node + TypeScript, Hono, Zod, better-sqlite3, Vite/React UI, Docker Compose.

## What was built

- **API** (`src/api`): Bearer auth, jobs CRUD-ish + cancel, schedules CRUD + pause/resume, serves `web/dist` static UI
- **Worker** (`src/worker`): claim with lease, heartbeat, stale reclaim, timeout/fail/retry backoff; also runs scheduler tick
- **Handlers**: `echo`, `http_callback`, stubs `template.*` (+ legacy hunt.* aliases)
- **DB**: SQLite schema for jobs + schedules (WAL)
- **Web UI** (`web/`): login (API key → localStorage), jobs dashboard, create job, job detail, schedules
- **Ship**: Dockerfile, docker-compose.yml, .env.example, README, docs/PACKPIN.md, MIT LICENSE, `scripts/echo-e2e.sh`

## How to run

```bash
cd /workspace/runpin
npm install
cp .env.example .env   # RUNPIN_API_KEY=dev-api-key is fine for local
npm run build
npm run start:api &    # :3000
npm run start:worker &
./scripts/echo-e2e.sh
```

Or: `docker compose up --build` then open http://localhost:3000 and run the e2e script with `RUNPIN_API_KEY` matching compose env.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TS + build web UI |
| `npm run start:api` | Start API (serves UI if built) |
| `npm run start:worker` | Start worker + scheduler |
| `npm run dev` / `dev:api` / `dev:worker` / `dev:web` | Local hot reload |
