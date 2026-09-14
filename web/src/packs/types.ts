export type PackViewType = "cards" | "table" | "json";

export type PackActionKind =
  | "apply"
  | "save_drive"
  | "notify"
  | "webhook"
  | "custom";

export type PackSettingFieldKind = "boolean" | "number" | "string";

export type PackFieldMeta = {
  key: string;
  label: string;
  kind?: "string" | "number" | "boolean" | "url" | "text";
  truncate?: boolean;
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
  action_type?: string;
  description?: string;
};

export type PackResultSchema = {
  listField?: string;
  itemFields: PackFieldMeta[];
  summaryFields?: PackFieldMeta[];
};

export type PackManifest = {
  id: string;
  title: string;
  description: string;
  jobType: string;
  resultSchema: PackResultSchema;
  settings: PackSettingsField[];
  view: PackViewType;
  actions: PackActionDef[];
  source: "builtin" | "draft";
  destinations?: string[];
};
