import { nanoid } from "nanoid";
import { getDb } from "./schema.js";
import { type CatalogTool } from "../shared/toolCatalog.js";
import {
  defaultSettingsForTool,
  normalizeToolSettings,
  type ToolSettings,
} from "../shared/toolSettings.js";
import { getDraftPacks, getPack, type PackManifest } from "../packs/index.js";
import { initPackDrafts } from "./packDrafts.js";

function packToCatalogTool(pack: PackManifest): CatalogTool {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description || "A tool you made",
    category: "custom",
    jobType: pack.jobType || pack.id,
    tags: ["yours"],
  };
}

/** Installable tool for this id — only builder drafts. The shelf is gone. */
export function resolveCatalogTool(toolId: string): CatalogTool | undefined {
  initPackDrafts();
  const pack = getPack(toolId);
  return pack?.source === "draft" ? packToCatalogTool(pack) : undefined;
}

export type AccountToolRow = {
  id: string;
  api_key_hash: string;
  tool_id: string;
  added_at: string;
  settings: string;
};

function parseSettingsJson(raw: string | null | undefined): ToolSettings {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ToolSettings;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function listInstalledToolIds(apiKeyHash: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tool_id FROM account_tools WHERE api_key_hash = ? ORDER BY added_at DESC`
    )
    .all(apiKeyHash) as { tool_id: string }[];
  return rows.map((r) => r.tool_id);
}

export function listInstalledTools(
  apiKeyHash: string
): (CatalogTool & { installed: true; added_at: string })[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tool_id, added_at FROM account_tools WHERE api_key_hash = ? ORDER BY added_at DESC`
    )
    .all(apiKeyHash) as { tool_id: string; added_at: string }[];
  const out: (CatalogTool & { installed: true; added_at: string })[] = [];
  for (const row of rows) {
    const meta = resolveCatalogTool(row.tool_id);
    if (meta) {
      out.push({ ...meta, installed: true, added_at: row.added_at });
    }
  }
  return out;
}

export function isToolInstalled(apiKeyHash: string, toolId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM account_tools WHERE api_key_hash = ? AND tool_id = ?`
    )
    .get(apiKeyHash, toolId) as { ok: number } | undefined;
  return !!row;
}

export function listCatalogWithInstalled(
  apiKeyHash: string
): (CatalogTool & { installed: boolean; added_at: string | null })[] {
  const installed = new Map(
    (
      getDb()
        .prepare(
          `SELECT tool_id, added_at FROM account_tools WHERE api_key_hash = ?`
        )
        .all(apiKeyHash) as { tool_id: string; added_at: string }[]
    ).map((r) => [r.tool_id, r.added_at])
  );
  initPackDrafts();
  const custom = getDraftPacks().map(packToCatalogTool);
  return custom.map((t) => {
    const added = installed.get(t.id) ?? null;
    return {
      ...t,
      installed: added !== null,
      added_at: added,
    };
  });
}

export function addInstalledTool(
  apiKeyHash: string,
  toolId: string
): { ok: true; tool_id: string; added_at: string } | { ok: false; error: string } {
  if (!resolveCatalogTool(toolId)) {
    return { ok: false, error: "unknown_tool" };
  }
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT added_at FROM account_tools WHERE api_key_hash = ? AND tool_id = ?`
    )
    .get(apiKeyHash, toolId) as { added_at: string } | undefined;
  if (existing) {
    return { ok: true, tool_id: toolId, added_at: existing.added_at };
  }
  const added_at = new Date().toISOString();
  const settings = JSON.stringify(defaultSettingsForTool(toolId));
  db.prepare(
    `INSERT INTO account_tools (id, api_key_hash, tool_id, added_at, settings) VALUES (?, ?, ?, ?, ?)`
  ).run(nanoid(), apiKeyHash, toolId, added_at, settings);
  return { ok: true, tool_id: toolId, added_at };
}

export function removeInstalledTool(apiKeyHash: string, toolId: string): boolean {
  const db = getDb();
  const info = db
    .prepare(
      `DELETE FROM account_tools WHERE api_key_hash = ? AND tool_id = ?`
    )
    .run(apiKeyHash, toolId);
  return info.changes > 0;
}

export function getToolSettings(
  apiKeyHash: string,
  toolId: string
): { tool_id: string; settings: ToolSettings } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT tool_id, settings FROM account_tools WHERE api_key_hash = ? AND tool_id = ?`
    )
    .get(apiKeyHash, toolId) as
    | { tool_id: string; settings: string }
    | undefined;
  if (!row) return null;
  const stored = parseSettingsJson(row.settings);
  // Merge with defaults so UI always sees known keys
  const defaults = defaultSettingsForTool(toolId);
  return { tool_id: row.tool_id, settings: { ...defaults, ...stored } };
}

export function putToolSettings(
  apiKeyHash: string,
  toolId: string,
  settingsInput: unknown
):
  | { ok: true; tool_id: string; settings: ToolSettings }
  | { ok: false; error: "not_found" | "validation"; message?: string } {
  if (!isToolInstalled(apiKeyHash, toolId)) {
    return { ok: false, error: "not_found" };
  }
  const normalized = normalizeToolSettings(toolId, settingsInput);
  if (!normalized.ok) {
    return { ok: false, error: "validation", message: normalized.error };
  }
  const db = getDb();
  db.prepare(
    `UPDATE account_tools SET settings = ? WHERE api_key_hash = ? AND tool_id = ?`
  ).run(JSON.stringify(normalized.settings), apiKeyHash, toolId);
  return { ok: true, tool_id: toolId, settings: normalized.settings };
}
