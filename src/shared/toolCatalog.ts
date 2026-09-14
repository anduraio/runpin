/**
 * Shared tool catalog.
 *
 * Runpin is engine-only: there is no shelf of ready-made job templates. The only
 * installable tools are builder-made draft packs (category "custom").
 * Finder and the job templates are a separate, later product — do not add them back.
 *
 * Keep web/src/tools.ts in sync for form helpers.
 */

export type ToolCategory = "hunt" | "utility" | "integration" | "custom";

export type CatalogTool = {
  id: string;
  title: string;
  /** Card “you get” line — answer “After this runs, what do I get?” in ≤6 words. */
  description: string;
  category: ToolCategory;
  /** Job type passed to POST /v1/jobs (must have a handler). */
  jobType: string;
  tags: string[];
};

/** Public shelf — intentionally empty. Installed tools are draft packs from the builder. */
export const TOOL_CATALOG: CatalogTool[] = [];

/** Advanced-only — not installable; enqueue from Advanced → New job / the API. */
export const ADVANCED_TOOLS: CatalogTool[] = [
  {
    id: "echo",
    title: "Ping / test",
    description: "Echo payload back",
    category: "utility",
    jobType: "echo",
    tags: ["test", "ping", "debug", "advanced"],
  },
  {
    id: "http_callback",
    title: "Webhook callback",
    description: "POST to a callback URL",
    category: "integration",
    jobType: "http_callback",
    tags: ["webhook", "http", "callback", "advanced"],
  },
];

export function catalogById(id: string): CatalogTool | undefined {
  return TOOL_CATALOG.find((t) => t.id === id);
}
