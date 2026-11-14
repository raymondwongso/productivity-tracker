"use client";

import { useState } from "react";
import { SHARE, SHARE_OTHER } from "../colors";
import { ChartTooltip, TipRow, TipTitle, type Tip } from "./chart-tooltip";

export interface SharePart {
  key: string;
  name: string;
  /** Shown small after the name, e.g. "Movie" or the minutes. */
  sub?: string;
  value: number;
  /** An extra tooltip line, e.g. "3 sessions". */
  extra?: string;
}

export interface Slice {
  name: string;
  value: number;
  color: string;
  /** The parts folded into Other. */
  rest?: SharePart[];
  part?: SharePart;
}

/** The five largest parts keep their own color in order; the rest fold into a gray Other slice. */
export function foldParts(parts: SharePart[]): Slice[] {
  const top: Slice[] = parts.slice(0, 5).map((p, i) => ({ name: p.name, value: p.value, color: SHARE[i]!, part: p }));
  const rest = parts.slice(5);
  return rest.length ? [...top, { name: "Other", value: rest.reduce((s, p) => s + p.value, 0), color: SHARE_OTHER, rest }] : top;
}

const C = 90;
const RO = 86;
const RI = 58;
function arc(a0: number, a1: number) {
  const p = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(RO, a0)}A${RO} ${RO} 0 ${large} 1 ${p(RO, a1)}L${p(RI, a1)}A${RI} ${RI} 0 ${large} 0 ${p(RI, a0)}Z`;
}

/** SVG paths for each value's slice, clockwise from 12 o'clock. A lone slice is a full ring. */
export function slicePaths(values: number[]): string[] {
  const total = values.reduce((s, v) => s + v, 0);
  const starts = values.map((_, i) => -Math.PI / 2 + (values.slice(0, i).reduce((s, v) => s + v, 0) / total) * Math.PI * 2);
  return values.map((v, i) => {
    const a = starts[i]!;
    const da = (v / total) * Math.PI * 2;
    return da >= Math.PI * 2 - 1e-6 ? arc(a, a + Math.PI) + arc(a + Math.PI, a + Math.PI * 2) : arc(a, a + da);
  });
}

interface Props {
  parts: SharePart[];
  format: (v: number) => string;
  center: [string, string];
  label: string;
}

/** Donut plus a list that names every part, including the ones inside Other. */
export function ShareDonut({ parts, format, center, label }: Props) {
  const slices = foldParts(parts);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const [on, setOn] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
  const arcs = slicePaths(slices.map((s) => s.value));
  const hoverProps = (i: number) => ({
    onPointerMove: (e: { clientX: number; clientY: number }) => {
      const s = slices[i]!;
      setOn(i);
      setTip({
        x: e.clientX,
        y: e.clientY,
        content: (
          <>
            <TipTitle>{s.rest ? `Other · ${s.rest.length} more` : s.name}</TipTitle>
            <TipRow color={s.color} value={format(s.value)} name={`${pct(s.value)} of ${format(total)}`} />
            {s.part?.extra && <TipRow value="" name={s.part.extra} />}
          </>
        ),
      });
    },
    onPointerLeave: () => {
      setOn(null);
      setTip(null);
    },
  });
  const row = (p: { name: string; sub?: string; value: number }, i: number, color: string | null, key: string) => (
    <li
      key={key}
      {...hoverProps(i)}
      className={`grid grid-cols-[12px_minmax(0,1fr)_auto_44px] items-center gap-2 border-b border-grid px-1.5 py-1 ${color ? "" : "pl-[26px] text-xs text-ink-soft"} ${on === i ? "bg-surface-hover" : ""}`}
    >
      {color ? <i aria-hidden="true" className="block h-3 w-3 rounded-[2px]" style={{ background: color }} /> : <span />}
      <span className={`truncate ${color ? "font-semibold" : ""}`}>
        {p.name}
        {p.sub && <small className="ml-1.5 font-normal text-muted">{p.sub}</small>}
      </span>
      <span>{format(p.value)}</span>
      <span className="text-right text-muted">{pct(p.value)}</span>
    </li>
  );
  return (
    <div className="grid items-center gap-x-[18px] gap-y-2 px-3.5 pt-1.5 pb-3 sm:grid-cols-[minmax(150px,190px)_minmax(0,1fr)]">
      <div role="img" aria-label={`${label}: ${slices.map((s) => `${s.name} ${format(s.value)} (${pct(s.value)})`).join(", ")}`} className="mx-auto w-full max-w-[200px]">
        <svg viewBox="0 0 180 180" aria-hidden="true">
          {slices.map((s, i) => (
            <path key={s.name} d={arcs[i]} fill={s.color} stroke="#15313a" strokeWidth={2} style={on === i ? { filter: "brightness(1.15)" } : undefined} {...hoverProps(i)} />
          ))}
          <text x={C} y={C + 4} textAnchor="middle" className="fill-ink text-[22px] font-extrabold">
            {center[0]}
          </text>
          <text x={C} y={C + 22} textAnchor="middle" className="fill-muted text-xs">
            {center[1]}
          </text>
        </svg>
      </div>
      <ul className="flex flex-col text-[13px]">
        {slices.map((s, i) => [
          row({ name: s.name, sub: s.part?.sub, value: s.value }, i, s.color, s.name),
          ...(s.rest ?? []).map((p) => row(p, i, null, `rest-${p.key}`)),
        ])}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}
