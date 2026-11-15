"use client";

import type { Activity, Category } from "@productivitytracker/shared";
import type { CSSProperties } from "react";
import { CATEGORY_ICONS } from "@/features/activities/meta";
import { addDays, DOW, formatHm, sameDay } from "@/lib/dates";

interface Props {
  month: number;
  from: Date;
  to: Date;
  activities: Activity[];
  categories: Map<number, Category>;
  onOpen: (a: Activity) => void;
  onDayClick: (day: Date) => void;
  /** Phone layout: the whole month fits, each cell is one tap target with category dots. */
  compact?: boolean;
}

const MAX_ROWS = 4;
const MAX_DOTS = 6;

/** Monday-first month grid. Each day lists its activities by start time, then "+N more". */
export function MonthView({ month, from, to, activities, categories, onOpen, onDayClick, compact }: Props) {
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  const dayActivities = (d: Date) =>
    activities.filter((a) => sameDay(new Date(a.plannedStart), d)).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));

  if (compact) {
    return (
      <div className="min-h-[288px] flex-1 border-2 border-b-0 border-ink bg-bg">
        <div className="grid h-full grid-cols-7" style={{ gridTemplateRows: `auto repeat(${days.length / 7}, minmax(0, 1fr))` }}>
          {DOW.map((d, i) => (
            <div key={d} className={`border-b-2 border-ink bg-bar py-1.5 text-center text-[10px] font-semibold tracking-[.04em] text-muted uppercase ${i ? "border-l border-l-line" : ""}`}>
              {d}
            </div>
          ))}
          {days.map((d, i) => {
            const list = dayActivities(d);
            const out = d.getMonth() !== month;
            return (
              <button
                key={d.getTime()}
                type="button"
                onClick={() => onDayClick(d)}
                aria-label={`Open ${d.toDateString()}, ${list.length} ${list.length === 1 ? "activity" : "activities"}`}
                className={`flex min-h-0 min-w-0 flex-col items-start gap-1 overflow-hidden border-b border-line p-1 text-left active:bg-surface-hover ${i % 7 ? "border-l" : ""} ${out ? "bg-bar" : ""}`}
              >
                <span className={`px-1 text-[13px] leading-[18px] font-extrabold ${sameDay(d, today) ? "bg-ink text-bg" : out ? "text-muted" : ""}`}>{d.getDate()}</span>
                {list.length > 0 && (
                  <span aria-hidden="true" className="flex flex-wrap items-center gap-[3px] px-0.5">
                    {list.slice(0, MAX_DOTS).map((a) => (
                      <i
                        key={a.id}
                        title={a.name}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.cancelledAt ? "bg-line" : "bg-(--cat)"}`}
                        style={{ "--cat": categories.get(a.categoryId)?.color ?? "#8fb0aa" } as CSSProperties}
                      />
                    ))}
                    {list.length > MAX_DOTS && <span className="text-[10px] leading-none font-semibold text-muted">+{list.length - MAX_DOTS}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto border-2 border-b-0 border-ink bg-bg">
      <div className="grid min-w-[784px] grid-cols-[repeat(7,minmax(112px,1fr))]">
        {DOW.map((d, i) => (
          <div key={d} className={`sticky top-0 z-[3] border-b-2 border-ink bg-bar px-2.5 py-2 text-xs font-semibold tracking-[.06em] text-muted uppercase ${i ? "border-l border-l-line" : ""}`}>
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          const list = dayActivities(d);
          const out = d.getMonth() !== month;
          return (
            <div
              key={d.getTime()}
              onClick={(e) => e.target === e.currentTarget && onDayClick(d)}
              className={`flex min-h-[124px] min-w-0 cursor-pointer flex-col gap-1 border-b border-line p-1.5 hover:bg-[#142f37] ${i % 7 ? "border-l" : ""} ${out ? "bg-bar" : ""}`}
            >
              <button
                type="button"
                onClick={() => onDayClick(d)}
                aria-label={`Open ${d.toDateString()}`}
                className={`self-start px-1.5 py-px text-sm font-extrabold ${sameDay(d, today) ? "bg-ink text-bg" : out ? "text-muted" : ""}`}
              >
                {d.getDate()}
              </button>
              {list.slice(0, MAX_ROWS).map((a) => {
                const c = categories.get(a.categoryId);
                const Icon = CATEGORY_ICONS[a.category];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpen(a)}
                    title={`${c?.name ?? a.category}: ${a.name} · ${a.labels.join(", ")}`}
                    style={{ "--cat": c?.color ?? "#8fb0aa" } as CSSProperties}
                    className="flex min-w-0 items-center gap-1.5 border-l-4 border-(--cat) bg-surface py-0.5 pr-1 pl-1.5 text-left text-xs hover:bg-surface-hover"
                  >
                    <Icon size={12} className="shrink-0 text-(--cat)" aria-hidden="true" />
                    <span className="shrink-0 text-muted">{formatHm(new Date(a.plannedStart))}</span>
                    <span className={`truncate font-semibold ${a.cancelledAt ? "text-muted line-through" : ""}`}>{a.name}</span>
                  </button>
                );
              })}
              {list.length > MAX_ROWS && (
                <button type="button" onClick={() => onDayClick(d)} className="pl-1 text-left text-xs font-semibold text-primary hover:underline">
                  +{list.length - MAX_ROWS} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
