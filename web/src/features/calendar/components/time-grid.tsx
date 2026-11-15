"use client";

import type { Activity, Category } from "@productivitytracker/shared";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ActivityCard } from "@/features/activities/components/activity-card";
import { DOW, MINUTE, sameDay, startOfDay, toDateKey, weekdayIndex } from "@/lib/dates";
import { cardBox, segmentsForDay } from "../layout";

interface Props {
  days: Date[];
  activities: Activity[];
  categories: Map<number, Category>;
  onOpen: (a: Activity) => void;
  /** Click on an empty slot: the half hour that was clicked. */
  onSlot: (start: Date) => void;
  onDayClick: (day: Date) => void;
}

const HOURS = Array.from({ length: 23 }, (_, i) => i + 1);

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Week (seven columns) and Day (one tall column) views: 00:00 to 24:00, cards placed by planned time. */
export function TimeGrid({ days, activities, categories, onOpen, onSlot, onDayClick }: Props) {
  const single = days.length === 1;
  const hourHeight = single ? 96 : 80;
  const colMin = single ? 260 : 140;
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const firstDay = toDateKey(days[0]!);

  // Open at 06:00 whenever the range changes, and bring today's column into view on narrow screens.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = 6 * hourHeight - 10;
    const today = el.querySelector<HTMLElement>("[data-today]");
    if (today) {
      const off = today.getBoundingClientRect().left - el.getBoundingClientRect().left;
      if (off + today.offsetWidth > el.clientWidth) el.scrollLeft = off - 60;
    }
  }, [firstDay, hourHeight]);

  const grid: CSSProperties = {
    gridTemplateColumns: `56px repeat(${days.length}, minmax(${colMin}px, 1fr))`,
    minWidth: `calc(56px + ${days.length} * ${colMin}px)`,
  };
  const dayHeight = 24 * hourHeight;

  return (
    <div ref={scroller} tabIndex={0} aria-label="Time grid" className="min-h-0 flex-1 overflow-auto border-2 border-b-0 border-ink bg-bg">
      <div className="grid" style={grid}>
        <div className="sticky top-0 left-0 z-[8] border-b-2 border-ink bg-bar" />
        {days.map((d) => {
          const today = sameDay(d, now);
          const count = activities.filter((a) => sameDay(new Date(a.plannedStart), d)).length;
          return (
            <div key={d.getTime()} className={`sticky top-0 z-[6] flex items-baseline gap-1.5 border-b-2 border-l border-ink border-l-line px-2.5 py-2 ${today ? "bg-ink text-bg" : "bg-bar"}`}>
              <button type="button" onClick={() => onDayClick(d)} className="flex items-baseline gap-1.5 hover:underline" aria-label={`Open ${d.toDateString()}`}>
                <span className={`text-xs font-semibold tracking-[.06em] uppercase ${today ? "" : "text-muted"}`}>{DOW[weekdayIndex(d)]}</span>
                <span className="text-lg font-extrabold">{d.getDate()}</span>
              </button>
              <span className={`ml-auto text-[11px] ${today ? "" : "text-muted"}`}>{count} planned</span>
            </div>
          );
        })}

        <div className="sticky left-0 z-[4] border-r border-line bg-bar" style={{ height: dayHeight }}>
          <div className="relative h-full">
            {HOURS.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: h * hourHeight }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <div
              key={d.getTime()}
              data-today={today ? "" : undefined}
              className={`relative cursor-copy border-l border-line hover:bg-[#142f37] ${today ? "bg-today" : ""}`}
              style={{
                height: dayHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-grid) 0 1px, transparent 1px ${hourHeight}px)`,
              }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const half = Math.min(47, Math.max(0, Math.floor((y / hourHeight) * 2)));
                onSlot(new Date(startOfDay(d).getTime() + half * 30 * MINUTE));
              }}
            >
              {segmentsForDay(activities, d).map((s) => {
                const box = cardBox(s, hourHeight);
                return (
                  <ActivityCard
                    key={s.activity.id}
                    activity={s.activity}
                    category={categories.get(s.activity.categoryId)}
                    compact={box.compact}
                    continued={s.continuesBefore}
                    onOpen={onOpen}
                    style={{ top: box.top, height: box.height, left: `calc(${box.left}% + 3px)`, width: `calc(${box.width}% - 6px)` }}
                  />
                );
              })}
              {today && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 left-0 z-[5] h-0.5 bg-primary before:absolute before:-top-1 before:-left-[5px] before:h-2.5 before:w-2.5 before:bg-primary"
                  style={{ top: ((now.getTime() - startOfDay(now).getTime()) / MINUTE / 60) * hourHeight }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
