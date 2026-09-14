import { definePack } from "./definePack.js";

/** Finder — find new things (jobs or customers via mode setting). */
export const templateFinderPack = definePack({
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
      {
        key: "description",
        label: "Description",
        kind: "text",
        truncate: true,
      },
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
      description: "Apply to this listing (jobs mode; simulated)",
    },
    {
      id: "save_drive",
      kind: "save_drive",
      label: "Save export",
      description: "Download or sync the export",
    },
  ],
  destinations: ["Files / Google Drive", "CRM (simulated)", "Webhook"],
});
