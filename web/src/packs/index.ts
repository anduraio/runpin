export type {
  PackManifest,
  PackViewType,
  PackActionKind,
  PackActionDef,
  PackFieldMeta,
  PackSettingsField,
  PackResultSchema,
} from "./types";
export {
  templateFinderPack,
  huntJobsPack,
  huntIcpPack,
  getBuiltinPack,
  listBuiltinPacks,
} from "./builtins";

import type { PackManifest } from "./types";
import { getBuiltinPack, listBuiltinPacks } from "./builtins";

/** Client-side resolve: builtins + optional draft packs from API cache. */
let draftCache: PackManifest[] = [];

export function setClientDraftPacks(packs: PackManifest[]) {
  draftCache = packs.map((p) => ({ ...p, source: "draft" as const }));
}

export function getPack(type: string): PackManifest | undefined {
  return getBuiltinPack(type) ?? draftCache.find((p) => p.id === type);
}

export function listPacks(): PackManifest[] {
  const ids = new Set(listBuiltinPacks().map((p) => p.id));
  return [
    ...listBuiltinPacks(),
    ...draftCache.filter((p) => !ids.has(p.id)),
  ];
}

export function extractListItems(
  result: unknown,
  listField?: string
): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const o = result as Record<string, unknown>;
    if (listField && Array.isArray(o[listField])) {
      return o[listField] as unknown[];
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}
