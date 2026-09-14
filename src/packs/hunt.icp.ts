import { definePack } from "./definePack.js";

export const huntIcpPack = definePack({
  id: "hunt.icp",
  title: "ICP hunter",
  description:
    "Discover companies that match your ideal customer profile — export and enrich, no Apply.",
  jobType: "hunt.icp",
  view: "table",
  resultSchema: {
    listField: "companies",
    itemFields: [
      { key: "id", label: "Id", kind: "string" },
      { key: "name", label: "Company", kind: "string", table: true },
      { key: "industry", label: "Industry", kind: "string", table: true },
      { key: "fit", label: "Fit", kind: "string", table: true },
      {
        key: "notes",
        label: "Notes",
        kind: "text",
        truncate: true,
        table: true,
      },
    ],
  },
  settings: [
    {
      key: "concurrency",
      kind: "number",
      label: "How many at once",
      help: "This tool only. 1 = one run at a time. Other tools have their own limit.",
      placeholder: "1",
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
    {
      key: "notify_on_complete",
      kind: "boolean",
      label: "Notify me when a run finishes",
    },
    {
      key: "webhook_url",
      kind: "string",
      label: "Webhook URL (optional)",
      placeholder: "https://…",
    },
  ],
  actions: [
    {
      id: "save_drive",
      kind: "save_drive",
      label: "Save export",
      description: "Download the company export when available",
    },
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
  destinations: ["Files / Google Drive", "CRM (simulated)", "Webhook"],
});
