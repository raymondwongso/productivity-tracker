"use client";

import type { SleepDay } from "@productivitytracker/shared";
import { useState } from "react";
import { LabelChips } from "@/features/activities/components/label-chip";
import { formatHm } from "@/lib/dates";
import { VIZ } from "../colors";
import { dayLong } from "../format";
import { ChartTooltip, TipRow, TipTitle, type Tip } from "./chart-tooltip";
import { XTicks } from "./column-chart";
import { useWidth } from "./use-width";

const H = 250;
const L = 52;
const R = 6;
const T = 10;
const B = 24;
const at = (iso: string | null) => (iso ? new Date(iso) : null);

/**
 * Each day's main sleep: the planned window as an outline, the actual sleep as a bar. Clock time
 * runs down like the calendar, measured from 18:00 of that day.
 */
export function SleepScheduleChart({ days, items, label }: { days: Date[]; items: SleepDay["main"][]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(240, width - 20);
  const pw = W - L - R;
  const ph = H - T - B;
  const slot = pw / days.length;
  const base = (i: number) => new Date(days[i]!.getFullYear(), days[i]!.getMonth(), days[i]!.getDate(), 18).getTime();
  const off = (i: number, d: Date) => (d.getTime() - base(i)) / 60_000;

  let lo = 240; // 22:00
  let hi = 780; // 07:00
  items.forEach((it, i) => {
    if (!it) return;
    for (const d of [it.plannedStart, it.plannedEnd, it.actualStart, it.actualEnd].map(at)) {
      if (d) {
        lo = Math.min(lo, off(i, d));
        hi = Math.max(hi, off(i, d));
      }
    }
  });
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  const y = (m: number) => T + ((m - lo) / (hi - lo)) * ph;
  const every = (hi - lo) / 60 > 10 ? 3 : 2;
  const hours: number[] = [];
  for (let m = lo; m <= hi; m += 60) if ((m / 60) % every === 0) hours.push(m);

  return (
    <div ref={ref} className="relative px-2.5 pt-1.5 pb-1" role="img" aria-label={label}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block overflow-visible">
        {hours.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} className="stroke-grid" strokeWidth={1} />
            <text x={L - 8} y={y(m) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {String((18 + m / 60) % 24).padStart(2, "0")}:00
            </text>
          </g>
        ))}
        <XTicks days={days} slot={slot} height={H} />
        {items.map((it, i) => {
          const x0 = L + slot * i;
          const bw = Math.max(3, Math.min(20, slot * 0.66));
          const aw = Math.max(2, bw * 0.5);
          const ps = at(it?.plannedStart ?? null);
          const pe = at(it?.plannedEnd ?? null);
          const as = at(it?.actualStart ?? null);
          const ae = at(it?.actualEnd ?? null);
          return (
            <g
              key={i}
              onPointerMove={(e) => {
                setHover(i);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  content: (
                    <>
                      <TipTitle>{dayLong(days[i]!)}</TipTitle>
                      {it ? (
                        <>
                          <TipRow name="Planned" value={`${formatHm(ps)} → ${formatHm(pe)}`} />
                          <TipRow name="Actual" value={`${formatHm(as)} → ${formatHm(ae)}`} />
                          <div className="mt-1"><LabelChips labels={it.labels} /></div>
                        </>
                      ) : (
                        <TipRow value="" name="No sleep planned" />
                      )}
                    </>
                  ),
                });
              }}
              onPointerLeave={() => {
                setHover(null);
                setTip(null);
              }}
            >
              <rect x={x0} y={T} width={slot} height={ph} fill={hover === i ? "rgba(233,243,240,.06)" : "transparent"} />
              {ps && pe && (
                <rect data-planned="" x={x0 + (slot - bw) / 2} y={y(off(i, ps))} width={bw} height={y(off(i, pe)) - y(off(i, ps))} fill="none" stroke="#8fb0aa" strokeWidth={1.5} />
              )}
              {as && ae && (
                <rect data-actual="" x={x0 + (slot - aw) / 2} y={y(off(i, as))} width={aw} height={Math.max(2, y(off(i, ae)) - y(off(i, as)))} rx={2} fill={VIZ.sleep} />
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
