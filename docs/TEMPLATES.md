# Job templates — removed from Runpin

Runpin used to ship a shelf of **8 job templates** (Finder → Delivery). That shelf is **gone**. Runpin is the engine — queue, worker, Routines, Activity, API — and the only installable tools are the ones you build in `/tools/new`.

## What still works

Legacy job types resolve so old jobs, routines, and rows stay readable and runnable:

| Legacy job type | Old card title | Handler today |
|---|---|---|
| `template.finder` | Finder | stub (`{ stub: true, you_get, received }`) |
| `template.watcher` | Watcher | stub |
| `template.collector` | Collector | stub |
| `template.repeater` | Repeater | stub |
| `template.brief` | Daily Brief | stub |
| `template.compare` | Compare | stub |
| `template.filter` | Filter | stub |
| `template.delivery` | Delivery | stub |
| `hunt.jobs` / `hunt.icp` / `hunt.linkedin` | Finder (jobs / customers) | stub (aliases) |
| `notify.webhook` | Delivery | stub (alias) |

They are **not** in `src/shared/toolCatalog.ts` (that list is empty on purpose), so you cannot install them, they never appear on Home, and the Simple UI cannot enqueue them. Advanced → New job still accepts them, and existing Routines keep running to their stubs.

Supported job types today: `echo` (smoke tests) and `http_callback` (real work in another service) — enqueue from Advanced → New job or the API.

## Finder is a separate, later product

The Finder brand, live scrape, and the template shelf move to their own product. Do not add them back to Runpin's catalog.

## Build your own instead

Custom job types are registered over the API — `POST /v1/pack-drafts` to define the pack (result layout, fields, actions), `POST /v1/tools/installed` to install it, `PUT /v1/tools/installed/:toolId/settings` for runner settings. See [PACK-SDK.md](./PACK-SDK.md). There is no builder UI.

## Parked ideas (unrelated to the shelf)

- Cleaner
- Filler
- Archiver
- Reminder

## Catalog vs packs

- **Catalog** (`src/shared/toolCatalog.ts`) — what can be installed. Empty by design; draft packs are the installable tools.
- **Packs** (`src/packs/`) — how a job type's results, settings, and actions render.
