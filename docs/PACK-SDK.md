# Pack SDK

Runpin is a **tools-agnostic** engine: one shared app, and **packs** that declare how a job type looks and behaves.

- **Catalog** — `src/shared/toolCatalog.ts`; empty by design. The only installable tools are drafts made in the builder. See [TEMPLATES.md](./TEMPLATES.md) for the removed shelf.
- **Pack** — a manifest (not a separate frontend) declaring how a job type’s results look, which settings appear, and which action affordances operators get.

Runtime handlers (`src/handlers`) stay as they are; packs are primarily **UI + settings + result rendering + actions**.

See also [TOOL-RESULTS.md](./TOOL-RESULTS.md) for the shared Activity board and post-job action pipeline.

## Shared primitives

| Primitive | Role |
|-----------|------|
| **Run** | A job (`POST /v1/jobs`) of a given `type` |
| **Result schema** | Declarative list field + item fields (JSON-schema-ish) |
| **Views** | `cards` \| `table` \| `json` (default / unknown → JSON) |
| **Actions** | Affordances: `apply`, `save_drive`, `notify`, `webhook`, or `custom` |
| **Destinations** | Where results can go (Files/Drive, CRM, webhook) — labels + settings |
| **Settings** | Per-installed-tool preferences (`account_tools.settings`) |
| **Routine** | Friendly schedule that enqueues the pack’s job type |

Packs are registered manifests. There is **no separate app per hunter**.

## `definePack()`

```ts
import { definePack, getPack, listPacks } from "../packs/index.js";

definePack({
  id: "hunt.jobs",
  title: "Job hunter",
  description: "…",
  jobType: "hunt.jobs",
  view: "cards",
  resultSchema: {
    listField: "listings",
    itemFields: [
      { key: "title", label: "Title", table: true },
      { key: "url", label: "URL", kind: "url" },
      { key: "description", label: "Description", truncate: true },
    ],
  },
  settings: [/* field metadata → Settings UI */],
  actions: [{ id: "apply", kind: "apply", label: "Apply" }],
});
```

### Registry

- `getPack(type)` — builtin first, then draft packs
- `listPacks()` — builtins + drafts (drafts cannot shadow builtin ids)

Server: `src/packs/`. Web: `web/src/packs/` (builtins mirrored for the UI). Drafts load from SQLite `pack_drafts` into the server registry and are exposed via `GET /v1/packs`.

## Built-in packs (legacy)

The built-in packs exist so **old jobs still render**; none of them are installable any more.

### `template.finder` (former shelf: Finder)

- **View:** cards — listings (jobs) or companies (ICP via settings `mode`)
- **Action:** **Apply** per listing when result has `listings` → `POST /v1/jobs/:id/actions/apply` `{ listing_id }`
- **Settings:** What to find (`jobs` | `icp`), auto-apply, Drive, CRM/enrich, notify, webhook

### Other shelf templates

`template.watcher`, `template.collector`, `template.repeater`, `template.brief`, `template.compare`, `template.filter`, `template.delivery` — minimal packs (json/table) + settings stubs.

### Legacy aliases

`hunt.jobs` / `hunt.icp` packs remain registered for old job detail.

## Custom job types

There is no builder UI. Register a custom job type two ways:

**1. In code** — `definePack()` (see the example above) for anything that ships with your fork.

**2. Over the API** — create a draft pack, install it, and give it runner settings:

```bash
# create the pack (title, view, result fields, actions)
curl -X POST "$RUNPIN_URL/v1/pack-drafts" \
  -H "Authorization: Bearer $RUNPIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"id":"custom.apartment-hunt","title":"Apartment hunt","view":"cards",
       "listField":"listings","actions":["save_drive","notify"],
       "itemFields":[{"key":"title","label":"Title","table":true}]}'

# install it for this API key (enables settings + post-job actions)
curl -X POST "$RUNPIN_URL/v1/tools/installed" \
  -H "Authorization: Bearer $RUNPIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"tool_id":"custom.apartment-hunt"}'

# runner settings: how many at once, notify, webhook
curl -X PUT "$RUNPIN_URL/v1/tools/installed/custom.apartment-hunt/settings" \
  -H "Authorization: Bearer $RUNPIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"settings":{"concurrency":2,"notify_on_complete":true}}'
```

Then `POST /v1/jobs` with `type: "custom.apartment-hunt"`. Jobs of a draft type return sample results until you wire a real handler (`getHandler` falls back to `samplePackHandler`; production runners implement `Handler` in `src/handlers`). Drafts cannot shadow builtin ids.

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/v1/packs` | Builtins + drafts |
| GET | `/v1/packs/:id` | One manifest |
| GET/POST | `/v1/pack-drafts` | List / create drafts |
| PUT/DELETE | `/v1/pack-drafts/:id` | Update / delete |
| POST | `/v1/jobs/:id/actions/apply` | `{ listing_id }` |
| GET | `/v1/jobs/:id/applied` | Applied listing ids |

## Design rule

> One shared queue + Activity board. **Packs** declare result views, settings labels, and action affordances — never a separate app per tool.
