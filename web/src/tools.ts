/**
 * Display helpers for job types and schedules.
 * Runpin is engine-only: there is no tool catalog or per-tool form.
 */
import { getPack } from "./packs";

/** Display names for legacy job types, so old rows and routines stay readable. */
export const LEGACY_TYPE_LABELS: Record<string, string> = {
  "template.finder": "Finder",
  "template.watcher": "Watcher",
  "template.collector": "Collector",
  "template.repeater": "Repeater",
  "template.brief": "Daily Brief",
  "template.compare": "Compare",
  "template.filter": "Filter",
  "template.delivery": "Delivery",
  "hunt.jobs": "Finder (jobs)",
  "hunt.icp": "Finder (customers)",
  "hunt.linkedin": "Finder",
  "notify.webhook": "Delivery",
  echo: "Echo",
  http_callback: "HTTP callback",
};

export function toolTitle(id: string): string {
  return getPack(id)?.title ?? LEGACY_TYPE_LABELS[id] ?? id;
}

/** Human schedule text for Routines (avoid saying "cron"). */
export function friendlySchedule(cron: string): string {
  const c = cron.trim();
  if (c === "0 * * * *") return "Runs every hour";
  const everyN = c.match(/^0 \*\/(\d+) \* \* \*$/);
  if (everyN) {
    const n = everyN[1];
    return n === "1" ? "Runs every hour" : `Runs every ${n} hours`;
  }
  // daily at HH:00 UTC
  const daily = c.match(/^0 (\d{1,2}) \* \* \*$/);
  if (daily) {
    return `Runs every day at ${pad(Number(daily[1]))}:00 UTC`;
  }
  const weekly = c.match(/^0 (\d{1,2}) \* \* ([0-6])$/);
  if (weekly) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `Runs every ${days[Number(weekly[2])]} at ${pad(Number(weekly[1]))}:00 UTC`;
  }
  return `Runs on schedule (${c})`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
