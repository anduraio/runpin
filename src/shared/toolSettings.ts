import { z } from "zod";

/** Shared action preferences stored on installed tools. Executed by the worker via src/actions after job complete/fail. */

function optionalTrimmedString(max: number) {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val !== "string") return val;
    const t = val.trim();
    return t === "" ? undefined : t;
  }, z.string().max(max).optional());
}

export const RUNNER_CONCURRENCY_DEFAULT = 1;
export const RUNNER_CONCURRENCY_MAX = 20;

const concurrencyField = {
  concurrency: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") {
      return RUNNER_CONCURRENCY_DEFAULT;
    }
    if (typeof val === "string" && val.trim() !== "") return Number(val);
    return val;
  }, z.number().int().min(1).max(RUNNER_CONCURRENCY_MAX).default(RUNNER_CONCURRENCY_DEFAULT)),
};

export const FinderSettingsSchema = z.object({
  ...concurrencyField,
  /** What to find: jobs | customers (ICP). */
  mode: z.enum(["jobs", "icp"]).default("jobs"),
  auto_apply: z.boolean().default(false),
  auto_apply_limit_per_day: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    if (typeof val === "string" && val.trim() !== "") return Number(val);
    return val;
  }, z.number().int().min(1).max(500).optional()),
  save_to_google_drive: z.boolean().default(false),
  google_drive_folder: optionalTrimmedString(500),
  save_to_crm: z.boolean().default(false),
  enrich_contacts: z.boolean().default(false),
  notify_on_complete: z.boolean().default(false),
  webhook_url: optionalTrimmedString(2000),
});

/** @deprecated legacy — prefer FinderSettingsSchema via template.finder */
export const HuntJobsSettingsSchema = FinderSettingsSchema.omit({
  mode: true,
  save_to_crm: true,
  enrich_contacts: true,
}).extend({
  auto_apply: z.boolean().default(false),
});

export const HuntIcpSettingsSchema = z.object({
  ...concurrencyField,
  save_to_google_drive: z.boolean().default(false),
  google_drive_folder: optionalTrimmedString(500),
  save_to_crm: z.boolean().default(false),
  enrich_contacts: z.boolean().default(false),
  notify_on_complete: z.boolean().default(false),
  webhook_url: optionalTrimmedString(2000),
});

export const MinimalSettingsSchema = z.object({
  ...concurrencyField,
  notify_on_complete: z.boolean().default(false),
  webhook_url: optionalTrimmedString(2000),
});

export const WatcherSettingsSchema = MinimalSettingsSchema.extend({
  watch_url: optionalTrimmedString(2000),
});

export const CollectorSettingsSchema = MinimalSettingsSchema.extend({
  save_to_google_drive: z.boolean().default(false),
  google_drive_folder: optionalTrimmedString(500),
});

export const DeliverySettingsSchema = MinimalSettingsSchema.extend({
  channel: z.enum(["email", "sheets", "whatsapp", "webhook"]).default("email"),
  destination: optionalTrimmedString(2000),
});

export type ToolSettings = Record<string, unknown>;

export function parseRunnerConcurrency(settings: ToolSettings | undefined): number {
  const n = Number(settings?.concurrency ?? RUNNER_CONCURRENCY_DEFAULT);
  if (!Number.isFinite(n) || n < 1) return RUNNER_CONCURRENCY_DEFAULT;
  return Math.min(RUNNER_CONCURRENCY_MAX, Math.floor(n));
}

export function settingsSchemaForTool(toolId: string) {
  switch (toolId) {
    case "template.finder":
      return FinderSettingsSchema;
    case "template.watcher":
      return WatcherSettingsSchema;
    case "template.collector":
    case "template.filter":
    case "template.compare":
      return CollectorSettingsSchema;
    case "template.delivery":
      return DeliverySettingsSchema;
    case "template.repeater":
    case "template.brief":
      return MinimalSettingsSchema;
    case "hunt.jobs":
      return HuntJobsSettingsSchema;
    case "hunt.icp":
      return HuntIcpSettingsSchema;
    case "hunt.linkedin":
      return CollectorSettingsSchema;
    case "echo":
    case "http_callback":
    case "notify.webhook":
      return MinimalSettingsSchema;
    default:
      // Custom tools (and anything unknown) share the common action keys.
      return HuntJobsSettingsSchema;
  }
}

/** Light validate + normalize; keeps only known keys for the tool. */
export function normalizeToolSettings(
  toolId: string,
  input: unknown
): { ok: true; settings: ToolSettings } | { ok: false; error: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "settings must be an object" };
  }
  const schema = settingsSchemaForTool(toolId);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues.map((i) => i.message).join("; ") ||
        "invalid settings",
    };
  }
  const cleaned: ToolSettings = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return { ok: true, settings: cleaned };
}

export function defaultSettingsForTool(toolId: string): ToolSettings {
  const result = normalizeToolSettings(toolId, {});
  return result.ok ? result.settings : { notify_on_complete: false };
}
