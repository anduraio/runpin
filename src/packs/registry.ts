import { huntJobsPack } from "./hunt.jobs.js";
import { huntIcpPack } from "./hunt.icp.js";
import { templateFinderPack } from "./template.finder.js";
import { TEMPLATE_STUB_PACKS } from "./templates.stubs.js";
import { definePack, packFromDraftForm } from "./definePack.js";
import type { PackManifest } from "./types.js";

const builtins: PackManifest[] = [
  templateFinderPack,
  ...TEMPLATE_STUB_PACKS,
  // Legacy packs — still resolve for old job types / job detail
  huntJobsPack,
  huntIcpPack,
];

const builtinById = new Map(builtins.map((p) => [p.id, p]));

/** Draft packs loaded from DB / files — mutated via setDraftPacks. */
let draftPacks: PackManifest[] = [];

export function setDraftPacks(packs: PackManifest[]) {
  draftPacks = packs.map((p) => ({ ...p, source: "draft" as const }));
}

export function getBuiltinPacks(): PackManifest[] {
  return [...builtins];
}

export function getDraftPacks(): PackManifest[] {
  return [...draftPacks];
}

/**
 * Resolve a pack by id (job type). Builtins win over drafts with the same id.
 * Unknown types return undefined — callers should fall back to JSON view.
 */
export function getPack(type: string): PackManifest | undefined {
  const id = type.trim();
  return builtinById.get(id) ?? draftPacks.find((p) => p.id === id);
}

/** All packs: builtins first, then drafts (excluding ids that collide with builtins). */
export function listPacks(): PackManifest[] {
  const builtinIds = new Set(builtins.map((p) => p.id));
  const drafts = draftPacks.filter((p) => !builtinIds.has(p.id));
  return [...builtins, ...drafts];
}

/** Serialize a pack for API / builder UI (plain JSON). */
export function packToJson(pack: PackManifest) {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    jobType: pack.jobType,
    resultSchema: pack.resultSchema,
    settings: pack.settings,
    view: pack.view,
    actions: pack.actions,
    source: pack.source,
    destinations: pack.destinations ?? [],
  };
}

export function draftRowToPack(row: {
  id: string;
  title: string;
  description: string | null;
  manifest_json: string;
}): PackManifest {
  try {
    const raw = JSON.parse(row.manifest_json) as Record<string, unknown>;
    const view =
      raw.view === "cards" || raw.view === "table" || raw.view === "json"
        ? raw.view
        : "json";
    const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
    const actionKinds = actionsRaw
      .map((a) => {
        if (typeof a === "string") return a;
        if (a && typeof a === "object" && "kind" in a) {
          return String((a as { kind: unknown }).kind);
        }
        return "";
      })
      .filter((k): k is "apply" | "save_drive" | "notify" | "webhook" =>
        ["apply", "save_drive", "notify", "webhook"].includes(k)
      );

    // Prefer full manifest if it looks like one
    if (
      raw.resultSchema &&
      typeof raw.resultSchema === "object" &&
      Array.isArray((raw as { actions?: unknown }).actions) &&
      typeof (raw.actions as unknown[])[0] === "object"
    ) {
      return definePack({
        id: row.id,
        title: row.title || String(raw.title ?? row.id),
        description: row.description ?? String(raw.description ?? ""),
        jobType: String(raw.jobType ?? row.id),
        resultSchema: raw.resultSchema as PackManifest["resultSchema"],
        settings: Array.isArray(raw.settings)
          ? (raw.settings as PackManifest["settings"])
          : [],
        view,
        actions: raw.actions as PackManifest["actions"],
        destinations: Array.isArray(raw.destinations)
          ? (raw.destinations as string[])
          : undefined,
        source: "draft",
      });
    }

    return packFromDraftForm({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      view,
      listField:
        typeof raw.listField === "string"
          ? raw.listField
          : typeof (raw.resultSchema as { listField?: string } | undefined)
                ?.listField === "string"
            ? (raw.resultSchema as { listField: string }).listField
            : undefined,
      actions: actionKinds,
    });
  } catch {
    return packFromDraftForm({
      id: row.id,
      title: row.title || row.id,
      description: row.description ?? undefined,
      view: "json",
    });
  }
}

export { definePack, packFromDraftForm };
export type { PackManifest };
