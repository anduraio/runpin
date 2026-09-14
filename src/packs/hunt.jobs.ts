import { definePack } from "./definePack.js";

export const huntJobsPack = definePack({
  id: "hunt.jobs",
  title: "Job hunter",
  description:
    "Find matching job listings and apply (simulated) from the results board.",
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
      {
        key: "description",
        label: "Description",
        kind: "text",
        truncate: true,
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
  destinations: ["Files / Google Drive", "Webhook"],
});
