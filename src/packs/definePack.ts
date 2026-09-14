import type { DefinePackInput, PackManifest } from "./types.js";

/** Normalize and freeze a pack manifest. */
export function definePack(input: DefinePackInput): PackManifest {
  if (!input.id || !input.id.trim()) {
    throw new Error("definePack: id is required");
  }
  if (!input.title?.trim()) {
    throw new Error(`definePack(${input.id}): title is required`);
  }
  const view = input.view ?? "json";
  if (view !== "cards" && view !== "table" && view !== "json") {
    throw new Error(`definePack(${input.id}): invalid view ${String(view)}`);
  }
  return {
    id: input.id.trim(),
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    jobType: (input.jobType ?? input.id).trim(),
    resultSchema: {
      listField: input.resultSchema?.listField,
      itemFields: [...(input.resultSchema?.itemFields ?? [])],
      summaryFields: input.resultSchema?.summaryFields
        ? [...input.resultSchema.summaryFields]
        : undefined,
    },
    settings: [...(input.settings ?? [])],
    view,
    actions: [...(input.actions ?? [])],
    source: input.source ?? "builtin",
    destinations: input.destinations ? [...input.destinations] : undefined,
  };
}

const DEFAULT_ITEM_FIELDS: PackManifest["resultSchema"]["itemFields"] = [
  { key: "title", label: "Title", table: true },
  { key: "name", label: "Name", table: true },
  { key: "id", label: "Id", table: true },
];

function actionDefsFromKinds(
  actions: Array<"apply" | "save_drive" | "notify" | "webhook">
): PackManifest["actions"] {
  return actions.map((kind) => {
    switch (kind) {
      case "apply":
        return {
          id: "apply",
          kind: "apply" as const,
          label: "Apply",
          description: "Apply to this result (simulated)",
        };
      case "save_drive":
        return {
          id: "save_drive",
          kind: "save_drive" as const,
          label: "Save a copy",
          description: "Save results to Files / Drive",
        };
      case "notify":
        return {
          id: "notify",
          kind: "notify" as const,
          label: "Ping me",
          description: "In-app notification when a run finishes",
        };
      case "webhook":
        return {
          id: "webhook",
          kind: "webhook" as const,
          label: "Webhook",
          description: "POST results to a webhook URL",
        };
    }
  });
}

function settingsFromActions(
  actions: Array<"apply" | "save_drive" | "notify" | "webhook">
): PackManifest["settings"] {
  const settings: PackManifest["settings"] = [];
  if (actions.includes("apply")) {
    settings.push({
      key: "auto_apply",
      kind: "boolean",
      label: "Auto-apply when a run finishes",
      help: "Queues simulated applications for matching results",
    });
  }
  if (actions.includes("save_drive")) {
    settings.push({
      key: "save_to_google_drive",
      kind: "boolean",
      label: "Save results to Files",
    });
    settings.push({
      key: "google_drive_folder",
      kind: "string",
      label: "Folder name (optional)",
      placeholder: "e.g. Runpin / My hunts",
    });
  }
  if (actions.includes("notify")) {
    settings.push({
      key: "notify_on_complete",
      kind: "boolean",
      label: "Notify me when a run finishes",
    });
  }
  if (actions.includes("webhook")) {
    settings.push({
      key: "webhook_url",
      kind: "string",
      label: "Webhook URL (optional)",
      placeholder: "https://…",
    });
  }
  return settings;
}

function destinationsFromActions(
  actions: Array<"apply" | "save_drive" | "notify" | "webhook">
): string[] | undefined {
  const dest: string[] = [];
  if (actions.includes("save_drive")) dest.push("Files / Google Drive");
  if (actions.includes("webhook")) dest.push("Webhook");
  return dest.length ? dest : undefined;
}

/** Build a draft pack from the Make-your-own-tool form. */
export function packFromDraftForm(input: {
  id: string;
  title: string;
  description?: string;
  view?: "cards" | "table" | "json";
  listField?: string;
  actions?: Array<"apply" | "save_drive" | "notify" | "webhook">;
  itemFields?: PackManifest["resultSchema"]["itemFields"];
}): PackManifest {
  const actions = input.actions ?? [];
  const itemFields =
    input.itemFields && input.itemFields.length > 0
      ? input.itemFields
      : DEFAULT_ITEM_FIELDS;

  return definePack({
    id: input.id,
    title: input.title,
    description: input.description ?? "",
    jobType: input.id,
    resultSchema: {
      listField: input.listField?.trim() || "items",
      itemFields,
    },
    settings: settingsFromActions(actions),
    view: input.view ?? "cards",
    actions: actionDefsFromKinds(actions),
    destinations: destinationsFromActions(actions),
    source: "draft",
  });
}
