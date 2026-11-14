"use client";

import { useState, type ReactNode } from "react";
import { dayLong, dayShort } from "../format";
import { ChartTooltip, TipRow, TipTitle, type Tip } from "./chart-tooltip";
import { useWidth } from "./use-width";
import { DOW, weekdayIndex } from "@/lib/dates";

export interface Series {
  name: string;
  color: string;
  values: number[];
}

interface Props {
  days: Date[];
  series: Series[];
  /** One bar, segments stacked on one bar, or bars side by side. */
  mode?: "single" | "stack" | "group";
  tick: (v: number) => string;
  format: (v: number) => string;
  extraTip?: (i: number) => ReactNode;
  height?: number;
  label: string;
}

const L = 52;
const R = 6;
const T = 10;
const B = 24;

/** A rounded value-axis top and step: 0, step, …, top in four or so ticks. */
export function niceScale(max: number, ticks = 4): { step: number; top: number } {
  if (!(max > 0)) return { step: 1, top: ticks };
  const raw = max / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw - 1e-9) ?? 10 * p;
  return { step, top: Math.ceil(max / step - 1e-9) * step };
}

/** A bar with a 4px rounded top, square at the baseline. */
const barPath = (x: number, y0: number, w: number, h: number, r = 4) => {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  const y1 = y0 - h;
  return `M${x} ${y0}V${y1 + rr}Q${x} ${y1} ${x + rr} ${y1}H${x + w - rr}Q${x + w} ${y1} ${x + w} ${y1 + rr}V${y0}Z`;
};

export function XTicks({ days, slot, height }: { days: Date[]; slot: number; height: number }) {
  const n = days.length;
  const every = Math.max(1, Math.ceil((n <= 7 ? 52 : 46) / slot));
  return (
    <>
      {days.map((d, i) =>
        i % every ? null : (
          <text key={i} className="fill-muted text-[11px]" x={L + slot * i + slot / 2} y={height - 6} textAnchor="middle">
            {n <= 7 ? `${DOW[weekdayIndex(d)]} ${d.getDate()}` : dayShort(d)}
          </text>
        ),
      )}
    </>
  );
}

/** One column per day on one value axis. */
export function ColumnChart({ days, series, mode = "single", tick, format, extraTip, height = 200, label }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(240, width - 20);
  const pw = W - L - R;
  const ph = height - T - B;
  const n = days.length;
  const slot = pw / n;
  const totals = days.map((_, i) =>
    mode === "stack" ? series.reduce((s, se) => s + (se.values[i] ?? 0), 0) : Math.max(...series.map((se) => se.values[i] ?? 0)),
  );
  const { step, top } = niceScale(Math.max(0, ...totals));
  const y = (v: number) => T + ph - (v / top) * ph;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const tipFor = (i: number) => (
    <>
      <TipTitle>{dayLong(days[i]!)}</TipTitle>
      {series.map((se) => (
        <TipRow key={se.name} color={se.color} value={format(se.values[i] ?? 0)} name={series.length > 1 ? se.name : undefined} />
      ))}
      {extraTip?.(i)}
    </>
  );

  return (
    <div ref={ref} className="relative px-2.5 pt-1.5 pb-1" role="img" aria-label={label}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden="true" className="block overflow-visible">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-line" : "stroke-grid"} strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {tick(v)}
            </text>
          </g>
        ))}
        <XTicks days={days} slot={slot} height={height} />
        {days.map((_, i) => {
          const x0 = L + slot * i;
          const base = T + ph;
          const marks: ReactNode[] = [];
          if (mode === "group") {
            const ns = series.length;
            const bw = Math.max(2, Math.min(12, (slot * 0.72 - 2 * (ns - 1)) / ns));
            let x = x0 + (slot - (bw * ns + 2 * (ns - 1))) / 2;
            for (const se of series) {
              marks.push(<path key={se.name} data-mark="" fill={se.color} d={barPath(x, base, bw, ((se.values[i] ?? 0) / top) * ph)} />);
              x += bw + 2;
            }
          } else {
            const bw = Math.max(2, Math.min(24, slot * 0.66));
            const x = x0 + (slot - bw) / 2;
            const last = series.reduce((li, se, j) => ((se.values[i] ?? 0) > 0 ? j : li), -1);
            let b = base;
            series.forEach((se, j) => {
              const v = se.values[i] ?? 0;
              if (!(v > 0)) return;
              const h = (v / top) * ph;
              // A 2px surface gap separates stacked segments; only the top one is rounded.
              marks.push(
                j === last ? (
                  <path key={se.name} data-mark="" fill={se.color} d={barPath(x, b, bw, h)} />
                ) : (
                  <rect key={se.name} data-mark="" fill={se.color} x={x} y={b - h + 2} width={bw} height={Math.max(0, h - 2)} />
                ),
              );
              b -= h;
            });
          }
          return (
            <g
              key={i}
              data-day={i}
              onPointerMove={(e) => {
                setHover(i);
                setTip({ x: e.clientX, y: e.clientY, content: tipFor(i) });
              }}
              onPointerLeave={() => {
                setHover(null);
                setTip(null);
              }}
              style={hover === i ? { filter: "brightness(1.15)" } : undefined}
            >
              <rect x={x0} y={T} width={slot} height={ph} fill={hover === i ? "rgba(233,243,240,.06)" : "transparent"} />
              {marks}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
