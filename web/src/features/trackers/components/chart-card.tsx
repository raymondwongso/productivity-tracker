import type { ReactNode } from "react";

export interface LegendItem {
  name: string;
  color: string;
  /** "box" draws an outline, for the planned window on the sleep chart. */
  kind?: "fill" | "box";
}

export interface TableData {
  head: string[];
  rows: ReactNode[][];
}

interface Props {
  title: string;
  sub?: string;
  legend?: LegendItem[];
  note?: string;
  /** Take the full width of the grid. */
  span?: boolean;
  table?: TableData;
  /** When set, the card shows this sentence instead of the chart. */
  empty?: string | null;
  children?: ReactNode;
}

/** A chart in a bordered card, with its "Show as table" twin underneath. */
export function ChartCard({ title, sub, legend, note, span, table, empty, children }: Props) {
  return (
    <section aria-label={title} className={`flex min-w-0 flex-col border-2 border-ink bg-surface ${span ? "md:col-span-2" : ""}`} data-span={span ? "true" : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1 px-3.5 pt-3 pb-1">
        <h3 className="text-[15px] font-extrabold">{title}</h3>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {empty ? (
        <p className="mx-3.5 mt-2.5 mb-3.5 border border-dashed border-line p-3.5 text-[13px] text-muted">{empty}</p>
      ) : (
        <>
          {legend && legend.length > 0 && (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-3.5 pt-0.5 text-xs text-ink-soft">
              {legend.map((l) => (
                <span key={l.name} className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={l.kind === "box" ? { border: "1.5px solid #8fb0aa" } : { background: l.color }}
                  />
                  {l.name}
                </span>
              ))}
            </div>
          )}
          {children}
          {note && <p className="px-3.5 pb-2.5 text-xs text-muted">{note}</p>}
          {table && <ChartTable table={table} />}
        </>
      )}
    </section>
  );
}

export function ChartTable({ table }: { table: TableData }) {
  return (
    <details className="border-t border-line">
      <summary className="cursor-pointer px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink">Show as table</summary>
      <div className="max-h-[260px] overflow-auto border-t border-line">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {table.head.map((h, i) => (
                <th key={h} className={`sticky top-0 bg-bar px-3.5 py-1.5 text-[11px] font-semibold tracking-[.05em] whitespace-nowrap text-muted uppercase ${i ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, n) => (
              <tr key={n}>
                {r.map((c, i) => (
                  <td key={i} className={`border-b border-grid px-3.5 py-1 whitespace-nowrap ${i ? "text-right" : "text-left"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
