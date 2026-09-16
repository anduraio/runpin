# Vendor handlers (bring your own job type)

Runpin is engine-only: the builtins are `echo` and `http_callback`, and everything else is either a
declarative pack or a **vendor handler** — a job type whose code is a module you install next to the
worker.

Pick a vendor handler over `http_callback` when the work is long, needs Runpin's lease / retry /
cancel / observability, and the code can ship as a package instead of running as a separate service.
The worker runs it in-process, so there is no callback URL, no bearer token to pass around, and no
second thing to keep alive.

This repo never names or depends on your package. `VENDOR_HANDLERS` is the only coupling — which is
also why a vendor handler never appears in `package.json`.

## Config

One env var, set on **both** the `api` and `worker` services (the API needs it to accept the job type;
only the worker imports the module):

```bash
VENDOR_HANDLERS='{"acme.report":{"module":"@acme/report-runner","export":"runReportJob","title":"Report runner","max_duration_sec":1200,"max_attempts":20}}'
```

| Field | Required | Meaning |
| --- | --- | --- |
| *(key)* | yes | Job type clients enqueue: lowercase letters, numbers, dots, dashes (≤64). Cannot shadow a builtin. |
| `module` | yes | Module specifier: a package name (`@acme/report-runner`), a relative path (`./runner/index.js`, resolved from the worker's cwd) or an absolute path. |
| `export` | no | Named export to call. Defaults to `default`. |
| `title` | no | Display name for the UI. Defaults to the type id. |
| `max_attempts` | no | Default when a client omits `max_attempts` (1–20). |
| `max_duration_sec` | no | Default when a client omits `max_duration_sec` (1–86400). |

Only the two `max_*` fields override a client that asked for something explicit — a client that sends
`max_attempts: 3` gets 3.

A malformed `VENDOR_HANDLERS` (bad JSON, bad type name, missing `module`) is logged and skipped: a
config typo never stops the worker from booting. Check what actually registered:

```bash
curl -s "$RUNPIN_URL/v1/handlers" -H "Authorization: Bearer $RUNPIN_API_KEY"
# {"handlers":[{"type":"echo","source":"builtin"},...,{"type":"acme.report","source":"vendor","title":"Report runner"}]}
```

## Contract

The module exports one function. It receives the job and returns the result:

```ts
type VendorJobContext = {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;   // the job payload, parsed
  attempt: number;                    // 1 on the first run
  signal: AbortSignal;                // aborted on cancel, timeout, lost lease
  setProgress: (p: {
    stage?: string;                   // ≤120 chars
    message?: string;                 // ≤500 chars
    percent?: number;                 // 0–100
    [key: string]: unknown;           // extra keys are stored as-is
  }) => void;
};

export async function runReportJob(ctx: VendorJobContext): Promise<unknown>;
```

The return value is stored as the job `result` and shown on the job page. Throw (or reject) to fail
the attempt — Runpin retries with exponential backoff until `max_attempts`, then marks the job
`failed` with your message.

```js
// @acme/report-runner
export async function runReportJob({ payload, signal, setProgress }) {
  setProgress({ stage: 'fetching', message: 'Reading the source rows', percent: 10 });
  const rows = await fetchRows(payload.table, { signal });

  setProgress({ stage: 'writing', message: `Writing ${rows.length} rows`, percent: 60 });
  const report = await writeReport(rows, { signal });

  return { reportId: report.id, rows: rows.length };
}
```

## Shipping the module

Build it to plain JS (the worker imports it at runtime, so it must not need a TypeScript loader), pack
it, and drop the tarball in `vendor/`:

```bash
npm pack --pack-destination /srv/runpin/vendor     # acme-report-runner-1.0.0.tgz
```

`vendor/` is gitignored, so the package ships with your deploy without ever entering the public tree.
The Dockerfile installs `vendor/*.tgz` on top of the normal dependencies when the directory has any,
and prints `no vendor packages` when it doesn't — a fresh clone builds unchanged.

Then rebuild and restart:

```bash
docker compose up -d --build worker api
```

Adding or changing a handler needs a rebuild: modules are resolved once, on first claim. After a
reload, a job that already failed for a bad module can be retried by enqueuing it again — the failure
carries the reason.

## Semantics

- **Dependencies** — the module owns its own. Install them as regular `dependencies` of the packed
  package; the worker's `node_modules` does not need them.
- **Progress** — `setProgress` writes the job's progress blob in-process, and the job page refreshes
  every 2s while it runs. It is a no-op if the job is no longer running.
- **Cancel** — `POST /v1/jobs/:id/cancel` aborts `signal`; a handler that honors it stops promptly and
  the job ends `cancelled`. A handler that ignores `signal` keeps holding its slot.
- **Timeout** — `max_duration_sec` aborts `signal` the same way, and the attempt fails with
  `timeout after <n>s`.
- **Retries** — a thrown error is retried with backoff until `max_attempts`. A handler that *cannot be
  loaded* (missing module, missing export) is a config error and fails immediately instead of replaying
  the same error `max_attempts` times.
- **Concurrency** — a vendor type has no per-tool setting, so it defaults to one at a time; the worker's
  `WORKER_CONCURRENCY` is still the overall ceiling.
- **Crash safety** — if the worker dies mid-run the lease expires and the job is reclaimed, so write
  your handler to be safe to run twice (`payload` carries your own idempotency key).

## Security

`VENDOR_HANDLERS` is trusted configuration: setting it runs code inside the worker container with the
worker's environment. Treat it like the Dockerfile — anyone who can change it already has your
secrets. Prefer a package name over a relative path so the resolved file is the one you installed.
