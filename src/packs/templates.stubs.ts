import { definePack } from "./definePack.js";
import type { PackManifest } from "./types.js";

const notifyWebhookSettings = [
  {
    key: "concurrency" as const,
    kind: "number" as const,
    label: "How many at once",
    help: "This tool only. 1 = one run at a time. Other tools have their own limit.",
    placeholder: "1",
  },
  {
    key: "notify_on_complete" as const,
    kind: "boolean" as const,
    label: "Notify me when a run finishes",
  },
  {
    key: "webhook_url" as const,
    kind: "string" as const,
    label: "Webhook URL (optional)",
    placeholder: "https://…",
  },
];

function stubPack(opts: {
  id: string;
  title: string;
  description: string;
  view?: PackManifest["view"];
  listField?: string;
  itemFields?: PackManifest["resultSchema"]["itemFields"];
  extraSettings?: PackManifest["settings"];
}): PackManifest {
  return definePack({
    id: opts.id,
    title: opts.title,
    description: opts.description,
    jobType: opts.id,
    view: opts.view ?? "json",
    resultSchema: {
      listField: opts.listField,
      itemFields: opts.itemFields ?? [
        { key: "id", label: "Id", kind: "string" },
        { key: "title", label: "Title", kind: "string", table: true },
        { key: "name", label: "Name", kind: "string", table: true },
      ],
    },
    settings: [...(opts.extraSettings ?? []), ...notifyWebhookSettings],
    actions: [
      {
        id: "notify",
        kind: "notify",
        label: "Notify",
        description: "In-app notify when a run finishes",
      },
      {
        id: "webhook",
        kind: "webhook",
        label: "Webhook",
        description: "POST results to a webhook URL",
      },
    ],
    destinations: ["Webhook"],
  });
}

export const templateWatcherPack = stubPack({
  id: "template.watcher",
  title: "Watcher",
  description: "An alert when it changes",
  view: "json",
  extraSettings: [
    {
      key: "watch_url",
      kind: "string",
      label: "URL to watch (optional)",
      placeholder: "https://…",
    },
  ],
});

export const templateCollectorPack = stubPack({
  id: "template.collector",
  title: "Collector",
  description: "A list from many pages",
  view: "table",
  listField: "items",
  itemFields: [
    { key: "id", label: "Id", kind: "string" },
    { key: "title", label: "Title", kind: "string", table: true },
    { key: "url", label: "URL", kind: "url", table: true },
    { key: "source", label: "Source", kind: "string", table: true },
  ],
  extraSettings: [
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
});

export const templateRepeaterPack = stubPack({
  id: "template.repeater",
  title: "Repeater",
  description: "The same job, on schedule",
  view: "json",
});

export const templateBriefPack = stubPack({
  id: "template.brief",
  title: "Daily Brief",
  description: "One summary for the day",
  view: "json",
});

export const templateComparePack = stubPack({
  id: "template.compare",
  title: "Compare",
  description: "A vs B differences",
  view: "table",
  listField: "diffs",
  itemFields: [
    { key: "field", label: "Field", kind: "string", table: true },
    { key: "a", label: "A", kind: "string", table: true },
    { key: "b", label: "B", kind: "string", table: true },
  ],
});

export const templateFilterPack = stubPack({
  id: "template.filter",
  title: "Filter",
  description: "Only items that fit",
  view: "table",
  listField: "items",
  itemFields: [
    { key: "id", label: "Id", kind: "string" },
    { key: "title", label: "Title", kind: "string", table: true },
    { key: "reason", label: "Why it fits", kind: "string", table: true },
  ],
});

export const templateDeliveryPack = stubPack({
  id: "template.delivery",
  title: "Delivery",
  description: "Results in email/Sheets/WA",
  view: "json",
  extraSettings: [
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
  ],
});

export const TEMPLATE_STUB_PACKS = [
  templateWatcherPack,
  templateCollectorPack,
  templateRepeaterPack,
  templateBriefPack,
  templateComparePack,
  templateFilterPack,
  templateDeliveryPack,
];
