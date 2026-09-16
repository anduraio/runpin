import { config } from "./config.js";

/**
 * Vendor handlers — job types whose code lives outside this repo.
 *
 * Runpin is engine-only: `echo` and `http_callback` are the builtins, and
 * anything else is either a declarative pack or a **vendor handler** — a module
 * installed alongside the worker (see docs/VENDOR-HANDLERS.md). One JSON env
 * var declares them:
 *
 *   VENDOR_HANDLERS={"acme.report":{"module":"@acme/report-runner","export":"runReportJob"}}
 *
 * The type is registered from env, so the API can accept the job without ever
 * importing the module; the worker resolves it lazily on first claim.
 */
export type VendorHandlerSpec = {
  /** Job type clients enqueue, e.g. `acme.report`. */
  type: string;
  /** Module specifier resolved by the worker (`@scope/pkg`, `./rel/path.js`, `/abs/path.js`). */
  module: string;
  /** Named export to call. Defaults to `default`. */
  export: string;
  /** Display name for the UI. Falls back to the type id. */
  title?: string;
  /** Default when a client omits `max_attempts` (1–20). */
  max_attempts?: number;
  /** Default when a client omits `max_duration_sec` (1–86400). */
  max_duration_sec?: number;
};

/** Same rule as JobTypeId in shared/types.ts. */
const TYPE_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

const MAX_ATTEMPTS_CAP = 20;
const MAX_DURATION_SEC_CAP = 86400;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBoundedInt(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min) return undefined;
  return Math.min(max, Math.floor(n));
}

/**
 * Parse the raw env value into specs. Bad JSON or a bad entry is reported once
 * and skipped — a config typo must not take the worker down.
 */
export function parseVendorHandlerConfig(
  raw: string | undefined
): Record<string, VendorHandlerSpec> {
  const text = raw?.trim();
  if (!text) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.warn(
      `[vendor] VENDOR_HANDLERS is not valid JSON — ignoring it: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn(
      "[vendor] VENDOR_HANDLERS must be a JSON object of { \"job.type\": { ... } }"
    );
    return {};
  }

  const specs: Record<string, VendorHandlerSpec> = {};
  for (const [type, value] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (!TYPE_PATTERN.test(type)) {
      console.warn(`[vendor] ignoring "${type}": ${TYPE_PATTERN}`);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      console.warn(`[vendor] ignoring "${type}": spec must be an object`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    const moduleName = readString(entry.module);
    if (!moduleName) {
      console.warn(`[vendor] ignoring "${type}": "module" is required`);
      continue;
    }
    specs[type] = {
      type,
      module: moduleName,
      export: readString(entry.export) ?? "default",
      title: readString(entry.title),
      max_attempts: readBoundedInt(entry.max_attempts, 1, MAX_ATTEMPTS_CAP),
      max_duration_sec: readBoundedInt(
        entry.max_duration_sec,
        1,
        MAX_DURATION_SEC_CAP
      ),
    };
  }
  return specs;
}

let cachedRaw: string | undefined;
let cachedSpecs: Record<string, VendorHandlerSpec> = {};

/** Valid specs from VENDOR_HANDLERS, parsed once per distinct env value. */
export function vendorHandlers(): Record<string, VendorHandlerSpec> {
  const raw = config.vendorHandlersJson();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSpecs = parseVendorHandlerConfig(raw);
  }
  return cachedSpecs;
}

export function getVendorHandler(
  type: string
): VendorHandlerSpec | undefined {
  return vendorHandlers()[type];
}

export function vendorHandlerEntries(): VendorHandlerSpec[] {
  return Object.values(vendorHandlers());
}
