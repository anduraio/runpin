# Custom runners (http_callback)

Use job type `http_callback` when another service should do the real work and Runpin only orchestrates durable enqueue + retries — the usual shape for an AI agent or workflow runner that lives outside your request path.

## Contract

1. **Enqueue** — Client `POST /v1/jobs` with `type: "http_callback"` and a payload that includes `callback_url`. Runpin responds **202** `{ id }`.
2. **Worker callback** — When claimed, the worker `POST`s `callback_url` with JSON body = payload **minus** `callback_url` and `callback_bearer`. Set `callback_bearer: true` to send `Authorization: Bearer` using this instance's API key.
3. **Success** — The callback endpoint returns **2xx** with a JSON body (or text). That body is stored as the job `result` as `{ status, body }`.
4. **Failure** — A non-2xx response fails the attempt with `callback <status> from <url>: <body>`, then the job is retried with exponential backoff until `max_attempts` and marked `failed` with that error.
5. **Timeout** — The worker aborts the request at `max_duration_sec` (default 3600). The attempt fails with `timeout after <n>s` and follows the same retry policy.
6. **Cancel** — `POST /v1/jobs/:id/cancel` aborts the in-flight callback immediately; the job ends `cancelled`.

No environment variable is needed: the callback URL travels with each job.

### Example payload

```json
{
  "type": "http_callback",
  "payload": {
    "callback_url": "https://example.com/hooks/runpin",
    "worksheet_id": "abc",
    "action": "compute"
  },
  "max_attempts": 3,
  "max_duration_sec": 3600,
  "idempotency_key": "job-abc-1"
}
```

The other service receives `POST` with `{ "worksheet_id": "abc", "action": "compute" }` and returns `200` + JSON.

### Result shape

```json
{
  "status": 200,
  "body": { "ok": true }
}
```

## Reachability

The callback host must be reachable **from the worker**, not from the browser. On the VPS compose stack the worker has `host.docker.internal:host-gateway`, so a service on the host (e.g. port 8787) is reachable at `http://host.docker.internal:8787/...`. UFW allows `8787/tcp` from Docker networks only.

## Progress from the callback service

While a job is running, the callback service can report stages so the operator sees progress in the UI instead of reading logs:

```bash
curl -X POST "$RUNPIN_URL/v1/jobs/<id>/progress" \
  -H "Authorization: Bearer $RUNPIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"stage":"generate","message":"Writing questions 12/40","percent":45}'
```

- Fields: `stage` (≤120), `message` (≤500), `percent` (0–100). Extra keys are stored as-is.
- Runpin stamps `at` (server time) on every write, so job detail can show “Updated 14:32:07”.
- Only **running** jobs accept progress: `200 { "ok": true }`, or `409 { "error": "not_running", "status": … }` once the job finished/cancelled. A 409 is not retryable — stop reporting.
- Job detail (`/jobs/:id`) renders stage + message + percent bar and refreshes every 2s while the job runs; the raw blob stays behind a “Raw” fold.

See also [PACKPIN.md](./PACKPIN.md) for packaging notes.
