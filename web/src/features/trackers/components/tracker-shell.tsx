"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { parseDateKey, startOfDay, toDateKey } from "@/lib/dates";
import { dayShort, plural } from "../format";
import { clampRange, dayCount, MAX_RANGE_DAYS, presetLabel, presetRange, RANGE_PRESETS, rangeFromParams, rangeToQuery, type RangePreset, type TrackerRange } from "../range";

/** The page's date range, kept in the URL so a view can be bookmarked. */
export function useTrackerRange() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const range = rangeFromParams(params, startOfDay(new Date()));
  const go = (r: TrackerRange) => {
    const q = rangeToQuery(r);
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const setPreset = (preset: RangePreset) =>
    go(preset === "custom" ? { ...range, preset } : { preset, ...presetRange(preset, startOfDay(new Date())) });
  const setCustom = (from: Date, to: Date, moved: "from" | "to") => {
    const r = clampRange(from, to, moved);
    if (r.clamped) toast(`A range can be at most ${MAX_RANGE_DAYS} days`);
    go({ preset: "custom", from: r.from, to: r.to });
  };
  return { range, setPreset, setCustom };
}

interface Props {
  title: string;
  color: string;
  range: TrackerRange;
  onPreset: (p: RangePreset) => void;
  onCustom: (from: Date, to: Date, moved: "from" | "to") => void;
  /** Under the subtitle, e.g. the Fitness jump links. */
  extra?: ReactNode;
  /** A refetch is under way: hold the previous numbers, dimmed. */
  stale?: boolean;
  error?: string | null;
  children: ReactNode;
}

export function TrackerShell({ title, color, range, onPreset, onCustom, extra, stale, error, children }: Props) {
  const n = dayCount(range.from, range.to);
  return (
    <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-4 pt-[18px] pb-20 md:px-8 md:pt-7">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3.5 border-b-2 border-ink pb-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-[-0.02em] md:text-[30px]">
            <i aria-hidden="true" className="inline-block h-3.5 w-3.5 shrink-0" style={{ background: color }} />
            {title}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            <b className="font-semibold text-ink-soft">{presetLabel(range.preset)}</b> · {dayShort(range.from)} – {dayShort(range.to)}, {range.to.getFullYear()}
            {range.preset === "custom" ? ` · ${plural(n, "day")}` : ""} · finished activities, counted on the day they were planned
          </p>
          {extra}
        </div>
        <RangePicker range={range} onPreset={onPreset} onCustom={onCustom} />
      </header>
      {error && (
        <p role="alert" className="border-l-4 border-danger-text bg-danger-tint px-3 py-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
      <div className={`flex flex-col gap-[22px] transition-opacity ${stale ? "opacity-60" : ""}`}>{children}</div>
    </div>
  );
}

function RangePicker({ range, onPreset, onCustom }: Pick<Props, "range" | "onPreset" | "onCustom">) {
  const dateInput = (which: "from" | "to") => (
    <input
      type="date"
      aria-label={which === "from" ? "From" : "To"}
      value={toDateKey(range[which])}
      onChange={(e) => {
        const d = parseDateKey(e.target.value);
        if (d) onCustom(which === "from" ? d : range.from, which === "to" ? d : range.to, which);
      }}
      className="border-2 border-ink bg-surface px-2 py-1.5 text-[13px] [&::-webkit-calendar-picker-indicator]:invert-90"
    />
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex max-w-full overflow-x-auto border-2 border-ink">
        {RANGE_PRESETS.map((p, i) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={range.preset === p.value}
            onClick={() => onPreset(p.value)}
            className={`shrink-0 px-2.5 py-[7px] text-[13px] font-semibold whitespace-nowrap ${i ? "border-l-2 border-ink" : ""} ${range.preset === p.value ? "bg-ink text-bg" : "hover:bg-surface-hover"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {range.preset === "custom" && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          {dateInput("from")}
          <span>to</span>
          {dateInput("to")}
        </div>
      )}
    </div>
  );
}

export function StatTiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] border-2 border-ink">{children}</div>;
}

export function StatTile({ label, value, sub, hero }: { label: ReactNode; value: string; sub?: string; hero?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 border-r border-b border-line px-3.5 py-3 ${hero ? "bg-surface" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">{label}</p>
      <p className="text-[26px] font-extrabold tracking-[-0.01em] [font-variant-numeric:normal]">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function ChartGrid({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-4 md:grid-cols-2">{children}</div>;
}

export function Section({ id, title, color, sub, children }: { id: string; title: string; color: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="flex scroll-mt-3 flex-col gap-3.5">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold">
        <i aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: color }} />
        {title}
        {sub && <small className="text-[13px] font-normal text-muted">{sub}</small>}
      </h2>
      {children}
    </section>
  );
}
