"use client";

import type { ReactNode } from "react";

export interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** One tooltip per chart, beside the pointer. Values lead, names follow. */
export function ChartTooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const left = Math.max(4, Math.min(tip.x + 14, window.innerWidth - 240));
  const top = tip.y + 14 + 140 > window.innerHeight ? tip.y - 140 : tip.y + 14;
  return (
    <div role="tooltip" className="pointer-events-none fixed z-[70] min-w-[150px] border-2 border-ink bg-bar px-2.5 py-2 text-xs shadow-[0_8px_20px_rgba(0,0,0,.4)]" style={{ left, top }}>
      {tip.content}
    </div>
  );
}

export function TipTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1 font-semibold text-muted">{children}</p>;
}

/** A row keyed by a short stroke of the series color. */
export function TipRow({ color, value, name, sum }: { color?: string; value: ReactNode; name?: ReactNode; sum?: boolean }) {
  return (
    <div className={`flex items-center gap-2 leading-[18px] ${sum ? "mt-1 border-t border-line pt-1" : ""}`}>
      {color && <i className="w-3 shrink-0 border-t-2" style={{ borderColor: color }} aria-hidden="true" />}
      <b className="font-extrabold text-ink">{value}</b>
      {name && <span className="text-ink-soft">{name}</span>}
    </div>
  );
}
