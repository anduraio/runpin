import type { PackManifest } from "./types";

const notifySettings = [
  {
    key: "notify_on_complete",
    kind: "boolean" as const,
    label: "Notify me when a run finishes",
  },
  {
    key: "webhook_url",
    kind: "string" as const,
    label: "Webhook URL (optional)",
    placeholder: "https://…",
  },
];

export const templateFinderPack: PackManifest = {
  id: "template.finder",
  title: "Finder",
  description: "A list of new finds — jobs or customers (ICP) via What to find.",
  jobType: "template.finder",
  view: "cards",
  resultSchema: {
    listField: "listings",
    itemFields: [
      { key: "id", label: "Id", kind: "string" },
      { key: "title", label: "Title", kind: "string", table: true },
      { key: "name", label: "Name", kind: "string", table: true },
      { key: "company", label: "Company", kind: "string", table: true },
      { key: "industry", label: "Industry", kind: "string", table: true },
      { key: "fit", label: "Fit", kind: "string", table: true },
      { key: "location", label: "Location", kind: "string", table: true },
      { key: "url", label: "URL", kind: "url", table: true },
      { key: "description", label: "Description", kind: "text", truncate: true },
      { key: "notes", label: "Notes", kind: "text", truncate: true, table: true },
    ],
  },
  settings: [
    {
      key: "mode",
      kind: "string",
      label: "What to find",
      help: "jobs = listings + Apply; icp = companies / customers",
      placeholder: "jobs or icp",
    },
    {
      key: "auto_apply",
      kind: "boolean",
      label: "Auto-apply to matching jobs",
      help: "Only when What to find = jobs (simulated)",
    },
    {
      key: "auto_apply_limit_per_day",
      kind: "number",
      label: "Daily auto-apply limit (optional)",
      placeholder: "e.g. 10",
    },
    {
      key: "save_to_google_drive",
      kind: "boolean",
      label: "Save results to Google Drive",
    },
    {
      key: "google_drive_folder",
      kind: "string",
      label: "Drive folder name (optional)",
      placeholder: "e.g. Runpin / Finds",
    },
    {
      key: "save_to_crm",
      kind: "boolean",
      label: "Save to CRM",
      help: "Useful when What to find = customers (simulated)",
    },
    {
      key: "enrich_contacts",
      kind: "boolean",
      label: "Enrich contacts",
      help: "Useful when What to find = customers (simulated)",
    },
    ...notifySettings,
  ],
  actions: [
    {
      id: "apply",
      kind: "apply",
      label: "Apply",
      description: "Apply to this listing (jobs mode; simulated)",
    },
    {
      id: "save_drive",
      kind: "save_drive",
      label: "Save export",
      description: "Download or sync the export",
    },
  ],
  source: "builtin",
  destinations: ["Files / Google Drive", "CRM (simulated)", "Webhook"],
};

/** Legacy — job detail for old hunt.jobs rows */
export const huntJobsPack: PackManifest = {
  id: "hunt.jobs",
  title: "Finder (jobs)",
  description: "Legacy pack id — prefer template.finder",
  jobType: "hunt.jobs",
  view: "cards",
  resultSchema: {
    listField: "listings",
    itemFields: [
      { key: "id", label: "Id", kind: "string" },
      { key: "title", label: "Title", kind: "string", table: true },
      { key: "company", label: "Company", kind: "string", table: true },
      { key: "location", label: "Location", kind: "string", table: true },
      { key: "url", label: "URL", kind: "url", table: true },
      { key: "description", label: "Description", kind: "text", truncate: true },
    ],
  },
  settings: [
    {
      key: "auto_apply",
      kind: "boolean",
      label: "Auto-apply to matching jobs",
      help: "Queues simulated applications when a hunt finishes (real apply later)",
    },
    {
      key: "auto_apply_limit_per_day",
      kind: "number",
      label: "Daily auto-apply limit (optional)",
      placeholder: "e.g. 10",
    },
    {
      key: "save_to_google_drive",
      kind: "boolean",
      label: "Save results to Google Drive",
    },
    {
      key: "google_drive_folder",
      kind: "string",
      label: "Drive folder name (optional)",
      placeholder: "e.g. Runpin / Job hunts",
    },
    ...notifySettings,
  ],
  actions: [
    {
      id: "apply",
      kind: "apply",
      label: "Apply",
      description: "Apply to this listing (simulated pipeline)",
    },
    {
      id: "save_drive",
      kind: "save_drive",
      label: "Save export",
      description: "Download or sync the job export",
    },
  ],
  source: "builtin",
  destinations: ["Files / Google Drive", "Webhook"],
};

/** Legacy — job detail for old hunt.icp rows */
export const huntIcpPack: PackManifest = {
  id: "hunt.icp",
  title: "Finder (customers)",
  description: "Legacy pack id — prefer template.finder with mode=icp",
  jobType: "hunt.icp",
  view: "table",
  resultSchema: {
    listField: "companies",
    itemFields: [
      { key: "id", label: "Id", kind: "string" },
      { key: "name", label: "Company", kind: "string", table: true },
      { key: "industry", label: "Industry", kind: "string", table: true },
      { key: "fit", label: "Fit", kind: "string", table: true },
      { key: "notes", label: "Notes", kind: "text", truncate: true, table: true },
    ],
  },
  settings: [
    {
      key: "save_to_google_drive",
      kind: "boolean",
      label: "Save results to Google Drive",
    },
    {
      key: "google_drive_folder",
      kind: "string",
      label: "Drive folder name (optional)",
      placeholder: "e.g. Runpin / ICP hunts",
    },
    {
      key: "save_to_crm",
      kind: "boolean",
      label: "Save to CRM",
      help: "Simulated until CRM is connected",
    },
    {
      key: "enrich_contacts",
      kind: "boolean",
      label: "Enrich contacts",
      help: "Simulated until CRM is connected",
    },
    ...notifySettings,
  ],
  actions: [
    {
      id: "save_drive",
      kind: "save_drive",
      label: "Save export",
      description: "Download the company export when available",
    },
    { id: "notify", kind: "notify", label: "Notify" },
    { id: "webhook", kind: "webhook", label: "Webhook" },
  ],
  source: "builtin",
  destinations: ["Files / Google Drive", "CRM (simulated)", "Webhook"],
};

function stub(
  id: string,
  title: string,
  description: string,
  view: PackManifest["view"],
  listField?: string,
  extraSettings: PackManifest["settings"] = [],
  itemFields?: PackManifest["resultSchema"]["itemFields"]
): PackManifest {
  return {
    id,
    title,
    description,
    jobType: id,
    view,
    resultSchema: {
      listField,
      itemFields: itemFields ?? [
        { key: "id", label: "Id", kind: "string" },
        { key: "title", label: "Title", kind: "string", table: true },
        { key: "name", label: "Name", kind: "string", table: true },
      ],
    },
    settings: [...extraSettings, ...notifySettings],
    actions: [
      { id: "notify", kind: "notify", label: "Notify" },
      { id: "webhook", kind: "webhook", label: "Webhook" },
    ],
    source: "builtin",
    destinations: ["Webhook"],
  };
}

export const templateWatcherPack = stub(
  "template.watcher",
  "Watcher",
  "An alert when it changes",
  "json",
  undefined,
  [
    {
      key: "watch_url",
      kind: "string",
      label: "URL to watch (optional)",
      placeholder: "https://…",
    },
  ]
);

export const templateCollectorPack = stub(
  "template.collector",
  "Collector",
  "A list from many pages",
  "table",
  "items",
  [
    {
      key: "save_to_google_drive",
      kind: "boolean",
      label: "Save results to Google Drive",
    },
    {
      key: "google_drive_folder",
      kind: "string",
      label: "Drive folder name (optional)",
      placeholder: "e.g. Runpin / Collected",
    },
  ],
  [
    { key: "id", label: "Id", kind: "string" },
    { key: "title", label: "Title", kind: "string", table: true },
    { key: "url", label: "URL", kind: "url", table: true },
    { key: "source", label: "Source", kind: "string", table: true },
  ]
);

export const templateRepeaterPack = stub(
  "template.repeater",
  "Repeater",
  "The same job, on schedule",
  "json"
);

export const templateBriefPack = stub(
  "template.brief",
  "Daily Brief",
  "One summary for the day",
  "json"
);

export const templateComparePack = stub(
  "template.compare",
  "Compare",
  "A vs B differences",
  "table",
  "diffs",
  [],
  [
    { key: "field", label: "Field", kind: "string", table: true },
    { key: "a", label: "A", kind: "string", table: true },
    { key: "b", label: "B", kind: "string", table: true },
  ]
);

export const templateFilterPack = stub(
  "template.filter",
  "Filter",
  "Only items that fit",
  "table",
  "items",
  [],
  [
    { key: "id", label: "Id", kind: "string" },
    { key: "title", label: "Title", kind: "string", table: true },
    { key: "reason", label: "Why it fits", kind: "string", table: true },
  ]
);

export const templateDeliveryPack = stub(
  "template.delivery",
  "Delivery",
  "Results in email/Sheets/WA",
  "json",
  undefined,
  [
    {
      key: "channel",
      kind: "string",
      label: "Channel",
      help: "email | sheets | whatsapp | webhook",
      placeholder: "email",
    },
    {
      key: "destination",
      kind: "string",
      label: "Destination (optional)",
      placeholder: "you@example.com / sheet id / WA number",
    },
  ]
);

const builtins = [
  templateFinderPack,
  templateWatcherPack,
  templateCollectorPack,
  templateRepeaterPack,
  templateBriefPack,
  templateComparePack,
  templateFilterPack,
  templateDeliveryPack,
  huntJobsPack,
  huntIcpPack,
];

export function getBuiltinPack(type: string): PackManifest | undefined {
  return builtins.find((p) => p.id === type);
}

export function listBuiltinPacks(): PackManifest[] {
  return [...builtins];
}
