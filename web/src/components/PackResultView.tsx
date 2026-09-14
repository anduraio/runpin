import { useState } from "react";
import type { PackManifest } from "../packs";
import { extractListItems } from "../packs";

type Props = {
  pack: PackManifest | undefined;
  result: unknown;
  jobId: string;
  jobType: string;
  appliedIds?: string[];
  onApply?: (listingId: string) => Promise<void>;
  applyBusyId?: string | null;
  hasExport?: boolean;
  onDownloadExport?: (format: "json" | "csv") => void;
  exportBusy?: boolean;
};

export default function PackResultView(props: Props) {
  const { pack, result } = props;
  if (result == null) {
    return <p className="muted">No results yet.</p>;
  }

  const view = pack?.view ?? "json";
  if (!pack || view === "json") {
    return <JsonFallback result={result} />;
  }

  const items = extractListItems(result, pack.resultSchema.listField);
  if (items.length === 0) {
    return (
      <p className="muted">
        Results will show here when this tool finds a list.
      </p>
    );
  }

  if (view === "cards") {
    return <CardsView {...props} items={items} pack={pack} />;
  }
  return <TableView {...props} items={items} pack={pack} />;
}

function CardsView({
  pack,
  items,
  appliedIds = [],
  onApply,
  applyBusyId,
  hasExport,
  onDownloadExport,
  exportBusy,
}: Props & { items: unknown[]; pack: PackManifest }) {
  const hasApply = pack.actions.some((a) => a.kind === "apply");
  const hasSave = pack.actions.some((a) => a.kind === "save_drive");

  return (
    <div>
      {hasSave && hasExport && onDownloadExport && (
        <div className="row pack-dest-bar">
          <span className="muted">Destinations:</span>
          <button
            type="button"
            className="secondary"
            disabled={exportBusy}
            onClick={() => onDownloadExport("json")}
          >
            Save export (JSON)
          </button>
          <button
            type="button"
            className="secondary"
            disabled={exportBusy}
            onClick={() => onDownloadExport("csv")}
          >
            CSV
          </button>
        </div>
      )}
      <div className="pack-cards">
        {items.map((item, i) => {
          const o =
            item && typeof item === "object" && !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : {};
          const listingId = o.id != null ? String(o.id) : "";
          const fields = pack.resultSchema.itemFields.filter(
            (f) => f.key !== "id"
          );
          const titleField =
            fields.find((f) => f.key === "title" || f.key === "name") ??
            fields[0];
          const urlField = fields.find(
            (f) => f.kind === "url" || f.key === "url"
          );
          const textFields = fields.filter(
            (f) =>
              f !== titleField &&
              f !== urlField &&
              (f.kind === "text" ||
                f.truncate ||
                f.key === "description" ||
                f.key === "notes")
          );
          const metaFields = fields.filter(
            (f) => f !== titleField && f !== urlField && !textFields.includes(f)
          );
          const title = titleField
            ? String(o[titleField.key] ?? `Item ${i + 1}`)
            : String(o.title ?? o.name ?? o.label ?? `Item ${i + 1}`);
          const url = urlField && o[urlField.key] != null
            ? String(o[urlField.key])
            : "";
          const applied = listingId && appliedIds.includes(listingId);

          return (
            <article key={listingId || i} className="pack-card">
              <header className="pack-card-header">
                <h3 className="pack-card-title">{title}</h3>
                {metaFields.map((f) => {
                  const v = o[f.key];
                  if (v == null || String(v).trim() === "") return null;
                  return (
                    <p key={f.key} className="pack-card-meta muted">
                      {String(v)}
                    </p>
                  );
                })}
              </header>
              {url && (
                <p className="pack-card-link">
                  <a href={url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </p>
              )}
              {textFields.map((f) => {
                const v = o[f.key];
                if (v == null || String(v).trim() === "") return null;
                return <TruncateText key={f.key} text={String(v)} />;
              })}
              {hasApply && listingId && onApply && (
                <div className="pack-card-actions">
                  <button
                    type="button"
                    disabled={!!applied || applyBusyId === listingId}
                    onClick={() => onApply(listingId)}
                  >
                    {applied
                      ? "Applied"
                      : applyBusyId === listingId
                        ? "Applying…"
                        : "Apply"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TableView({
  pack,
  items,
  hasExport,
  onDownloadExport,
  exportBusy,
}: Props & { items: unknown[]; pack: PackManifest }) {
  const cols = pack.resultSchema.itemFields.filter(
    (f) => f.table !== false && f.key !== "id"
  );
  const displayCols =
    cols.length > 0
      ? cols
      : [
          { key: "name", label: "Name" },
          { key: "title", label: "Title" },
        ];
  const hasSave = pack.actions.some((a) => a.kind === "save_drive");

  return (
    <div>
      {hasSave && (
        <div className="row pack-dest-bar">
          <span className="muted">
            {pack.destinations?.length
              ? `Destinations: ${pack.destinations.join(" · ")}`
              : "Destinations"}
          </span>
          {hasExport && onDownloadExport && (
            <>
              <button
                type="button"
                className="secondary"
                disabled={exportBusy}
                onClick={() => onDownloadExport("json")}
              >
                Save export (JSON)
              </button>
              <button
                type="button"
                className="secondary"
                disabled={exportBusy}
                onClick={() => onDownloadExport("csv")}
              >
                CSV
              </button>
            </>
          )}
          {!hasExport && (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Export appears after “Save to Files” runs (enable it in the job
              type’s runner settings).
            </span>
          )}
        </div>
      )}
      <div className="pack-table-wrap">
        <table className="pack-table">
          <thead>
            <tr>
              {displayCols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const o =
                item && typeof item === "object" && !Array.isArray(item)
                  ? (item as Record<string, unknown>)
                  : {};
              return (
                <tr key={o.id != null ? String(o.id) : i}>
                  {displayCols.map((c) => (
                    <td key={c.key}>
                      <CellValue value={o[c.key]} truncate={c.truncate} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellValue({
  value,
  truncate,
}: {
  value: unknown;
  truncate?: boolean;
}) {
  if (value == null) return <span className="muted">—</span>;
  const s = String(value);
  if (truncate) return <TruncateText text={s} />;
  if (/^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noreferrer">
        Link ↗
      </a>
    );
  }
  return <>{s}</>;
}

function TruncateText({ text, limit = 160 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  if (text.length <= limit) {
    return <p className="pack-desc">{text}</p>;
  }
  return (
    <div className="pack-desc">
      <p style={{ margin: 0 }}>{open ? text : `${text.slice(0, limit)}…`}</p>
      <button
        type="button"
        className="linkish pack-expand"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function JsonFallback({ result }: { result: unknown }) {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    const entries = Object.entries(result as Record<string, unknown>);
    if (entries.length > 0 && entries.length <= 12 && !entries.some(([, v]) => Array.isArray(v) && (v as unknown[]).length > 3)) {
      // Prefer JSON for unknown packs when structure is complex; small objects get field list
      const hasBigArray = entries.some(
        ([, v]) => Array.isArray(v) && (v as unknown[]).length > 0
      );
      if (!hasBigArray) {
        return (
          <dl className="result-fields">
            {entries.map(([k, v]) => (
              <div key={k} className="result-field">
                <dt>{k}</dt>
                <dd>
                  {v == null
                    ? "—"
                    : typeof v === "string" ||
                        typeof v === "number" ||
                        typeof v === "boolean"
                      ? String(v)
                      : JSON.stringify(v, null, 2)}
                </dd>
              </div>
            ))}
          </dl>
        );
      }
    }
  }
  return <pre className="mono">{JSON.stringify(result, null, 2)}</pre>;
}
