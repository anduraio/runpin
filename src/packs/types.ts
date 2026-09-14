/**
 * Pack SDK types — shared primitives for UI + settings + result rendering.
 * Runtime job handlers stay separate; packs describe how results look and what actions are offered.
 */

export type PackViewType = "cards" | "table" | "json";

export type PackActionKind =
  | "apply"
  | "save_drive"
  | "notify"
  | "webhook"
  | "custom";

export type PackSettingFieldKind = "boolean" | "number" | "string";

/** JSON-schema-ish field for result items (and settings metadata). */
export type PackFieldMeta = {
  key: string;
  label: string;
  kind?: "string" | "number" | "boolean" | "url" | "text";
  /** Show truncated with expand in card views */
  truncate?: boolean;
  /** Prefer this column in table views */
  table?: boolean;
};

export type PackSettingsField = {
  key: string;
  kind: PackSettingFieldKind;
  label: string;
  help?: string;
  placeholder?: string;
};

export type PackActionDef = {
  id: string;
  kind: PackActionKind;
  label: string;
  /** For custom actions — free-form type string recorded on job_actions */
  action_type?: string;
  description?: string;
};

/** Declarative result shape: which array holds list items + field metadata. */
export type PackResultSchema = {
  /** Top-level key holding the list (e.g. "listings", "companies"). Omit if result is a bare array. */
  listField?: string;
  itemFields: PackFieldMeta[];
  /** Optional summary fields on the root result object */
  summaryFields?: PackFieldMeta[];
};

export type PackManifest = {
  id: string;
  title: string;
  description: string;
  /** Job type this pack renders (usually same as id) */
  jobType: string;
  resultSchema: PackResultSchema;
  settings: PackSettingsField[];
  view: PackViewType;
  actions: PackActionDef[];
  /** Built-in vs draft from the pack builder */
  source: "builtin" | "draft";
  /** Destinations / notes for operators (not executed by themselves) */
  destinations?: string[];
};

export type DefinePackInput = Omit<PackManifest, "source"> & {
  source?: "builtin" | "draft";
};
