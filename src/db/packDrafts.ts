import { nanoid } from "nanoid";
import { getDb } from "./schema.js";
import {
  draftRowToPack,
  getBuiltinPacks,
  getPack,
  setDraftPacks,
  type PackManifest,
} from "../packs/index.js";
import { packFromDraftForm } from "../packs/definePack.js";
import {
  ADVANCED_TOOLS,
  TOOL_CATALOG,
  catalogById,
} from "../shared/toolCatalog.js";

export type PackDraftRow = {
  id: string;
  title: string;
  description: string | null;
  manifest_json: string;
  created_at: string;
  updated_at: string;
};

export function listPackDraftRows(): PackDraftRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM pack_drafts ORDER BY updated_at DESC`
    )
    .all() as PackDraftRow[];
}

export function getPackDraft(id: string): PackDraftRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM pack_drafts WHERE id = ?`)
    .get(id) as PackDraftRow | undefined;
}

export type CreatePackDraftInput = {
  id?: string;
  title: string;
  description?: string;
  view?: "cards" | "table" | "json";
  listField?: string;
  actions?: Array<"apply" | "save_drive" | "notify" | "webhook">;
  itemFields?: PackManifest["resultSchema"]["itemFields"];
  /** Full manifest override (advanced) */
  manifest?: Partial<PackManifest>;
};

function buildManifestJson(input: CreatePackDraftInput, id: string): string {
  if (input.manifest && input.manifest.resultSchema) {
    const pack = {
      ...input.manifest,
      id,
      title: input.title,
      description: input.description ?? input.manifest.description ?? "",
      source: "draft",
    };
    return JSON.stringify(pack);
  }
  const pack = packFromDraftForm({
    id,
    title: input.title,
    description: input.description,
    view: input.view ?? "cards",
    listField: input.listField,
    actions: input.actions ?? [],
    itemFields: input.itemFields,
  });
  return JSON.stringify(pack);
}

function isReservedToolId(id: string): boolean {
  if (TOOL_CATALOG.some((t) => t.id === id)) return true;
  if (ADVANCED_TOOLS.some((t) => t.id === id)) return true;
  return getBuiltinPacks().some((p) => p.id === id);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** Copy a Browse / builtin tool into a private draft the operator can edit. */
export function clonePackToDraft(sourceId: string): PackDraftRow {
  const id = sourceId.trim();
  const pack = getPack(id);
  const catalog =
    catalogById(id) ?? ADVANCED_TOOLS.find((t) => t.id === id);
  if (!pack && !catalog) {
    throw new Error("Unknown tool");
  }

  const baseTitle = (catalog?.title ?? pack?.title ?? "Tool").trim();
  const takenTitles = new Set(listPackDraftRows().map((r) => r.title));
  let title = `${baseTitle} (copy)`;
  let n = 2;
  while (takenTitles.has(title)) {
    title = `${baseTitle} (copy ${n})`;
    n += 1;
  }

  const slug = slugify(baseTitle) || "tool";
  let draftId = `custom.${slug}`;
  let i = 2;
  while (getPackDraft(draftId) || isReservedToolId(draftId)) {
    draftId = `custom.${slug}-${i}`;
    i += 1;
  }

  const description = (
    pack?.description ??
    catalog?.description ??
    ""
  ).trim();

  if (pack) {
    return createPackDraft({
      id: draftId,
      title,
      description,
      manifest: {
        ...pack,
        id: draftId,
        title,
        description,
        jobType: draftId,
        source: "draft",
        resultSchema: {
          ...pack.resultSchema,
          itemFields: [...pack.resultSchema.itemFields],
        },
        actions: [...pack.actions],
        settings: [...pack.settings],
      },
    });
  }

  return createPackDraft({
    id: draftId,
    title,
    description,
    view: "cards",
    listField: "items",
    actions: [],
  });
}

export function createPackDraft(input: CreatePackDraftInput): PackDraftRow {
  const id = (input.id?.trim() || `custom.${nanoid(8)}`).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(id)) {
    throw new Error(
      "Tool id must be 2–64 chars: lowercase letters, numbers, dots, dashes, underscores"
    );
  }
  if (isReservedToolId(id)) {
    throw new Error("That name is already used by a ready-made tool");
  }
  const existing = getPackDraft(id);
  if (existing) {
    throw new Error(`You already have a tool with this name`);
  }
  const now = new Date().toISOString();
  const manifest_json = buildManifestJson(input, id);
  getDb()
    .prepare(
      `INSERT INTO pack_drafts (id, title, description, manifest_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.title.trim(),
      input.description?.trim() || null,
      manifest_json,
      now,
      now
    );
  reloadDraftsIntoRegistry();
  return getPackDraft(id)!;
}

export function updatePackDraft(
  id: string,
  input: CreatePackDraftInput
): PackDraftRow | undefined {
  const row = getPackDraft(id);
  if (!row) return undefined;
  const now = new Date().toISOString();
  const title = input.title?.trim() || row.title;
  const description =
    input.description !== undefined
      ? input.description.trim() || null
      : row.description;
  const manifest_json = buildManifestJson(
    { ...input, title, description: description ?? undefined },
    id
  );
  getDb()
    .prepare(
      `UPDATE pack_drafts SET title = ?, description = ?, manifest_json = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(title, description, manifest_json, now, id);
  reloadDraftsIntoRegistry();
  return getPackDraft(id);
}

export function deletePackDraft(id: string): boolean {
  const info = getDb().prepare(`DELETE FROM pack_drafts WHERE id = ?`).run(id);
  if (info.changes > 0) {
    getDb().prepare(`DELETE FROM account_tools WHERE tool_id = ?`).run(id);
  }
  reloadDraftsIntoRegistry();
  return info.changes > 0;
}

export function reloadDraftsIntoRegistry(): PackManifest[] {
  const rows = listPackDraftRows();
  const packs = rows.map(draftRowToPack);
  setDraftPacks(packs);
  return packs;
}

/** Call after DB migrate so drafts are available to getPack/listPacks. */
export function initPackDrafts(): void {
  reloadDraftsIntoRegistry();
}
