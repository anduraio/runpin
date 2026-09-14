import type { PackFieldMeta, PackManifest } from "./types.js";

const SAMPLE_BY_KEY: Record<string, string[]> = {
  title: [
    "Senior Backend Engineer",
    "Product Designer",
    "Ops Lead",
  ],
  name: ["BrightLedger", "GreenRoute Logistics", "Canvas Health"],
  company: ["Nimbus Labs", "Northwind", "Harbor AI"],
  location: ["Remote", "Hybrid", "Onsite"],
  url: [
    "https://example.com/one",
    "https://example.com/two",
    "https://example.com/three",
  ],
  description: [
    "A sample listing so you can see how results will look.",
    "Another example with a slightly longer note for the card body.",
    "Third sample — enough rows to judge the layout.",
  ],
  industry: ["Fintech", "Logistics", "Health"],
  fit: ["high", "medium", "high"],
  notes: [
    "Example note for this row.",
    "Worth a second look next week.",
    "Fits the brief on paper.",
  ],
};

function sampleValue(field: PackFieldMeta, index: number): string {
  const preset = SAMPLE_BY_KEY[field.key];
  if (preset) return preset[index % preset.length];
  if (field.kind === "url") return `https://example.com/item-${index + 1}`;
  if (field.kind === "number") return String((index + 1) * 10);
  if (field.kind === "boolean") return index % 2 === 0 ? "yes" : "no";
  return `${field.label} ${index + 1}`;
}

/** Three dummy rows shaped like the pack's result list — for sample runs. */
export function sampleResultForPack(pack: PackManifest): Record<string, unknown> {
  const fields = pack.resultSchema.itemFields;
  const items = [0, 1, 2].map((i) => {
    const row: Record<string, unknown> = { id: `sample_${i + 1}` };
    for (const field of fields) {
      if (field.key === "id") {
        row.id = `sample_${i + 1}`;
        continue;
      }
      row[field.key] = sampleValue(field, i);
    }
    return row;
  });
  const listField = pack.resultSchema.listField?.trim() || "items";
  return { [listField]: items, sample: true };
}
