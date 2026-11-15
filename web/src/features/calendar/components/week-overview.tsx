"use client";

import type { Activity, Category } from "@productivitytracker/shared";
import type { CSSProperties } from "react";
import { DOW, formatHm, MINUTE, sameDay, startOfDay, weekdayIndex } from "@/lib/dates";
import { fitBox, segmentsForDay } from "../layout";
import { useNow } from "./time-grid";

interface Props {
  days: Date[];
  activities: Activity[];
  categories: Map<number, Category>;
  onDayClick: (day: Date) => void;
}

const LABELS = [3, 6, 9, 12, 15, 18, 21];
const HEADER = "h-11 shrink-0 border-b-2 border-ink";
const pct = (n: number) => `${n}%`;

/**
 * Phone week view: seven columns covering all 24 hours with no scrolling. Activities are thin
 * colored bars, and tapping anywhere in a column opens that day.
 */
export function WeekOverview({ days, activities, categories, onDayClick }: Props) {
  const now = useNow();
  const nowTop = ((now.getTime() - startOfDay(now).getTime()) / MINUTE / (24 * 60)) * 100;

  return (
    <div aria-label="Week overview" className="flex min-h-[288px] flex-1 border-2 border-b-0 border-ink bg-bg">
      <div aria-hidden="true" className="flex w-6 shrink-0 flex-col border-r border-line bg-bar">
        <div className={HEADER} />
        <div className="relative flex-1">
          {LABELS.map((h) => (
            <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] leading-none text-muted" style={{ top: pct((h / 24) * 100) }}>
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>

      {days.map((d, i) => {
        const today = sameDay(d, now);
        const count = activities.filter((a) => sameDay(new Date(a.plannedStart), d)).length;
        return (
          <button
            key={d.getTime()}
            type="button"
            onClick={() => onDayClick(d)}
            aria-label={`Open ${d.toDateString()}, ${count} ${count === 1 ? "activity" : "activities"}`}
            className={`flex min-w-0 flex-1 flex-col ${i ? "border-l border-line" : ""}`}
          >
            <span className={`${HEADER} flex w-full flex-col items-center justify-center leading-none ${today ? "bg-ink text-bg" : "bg-bar"}`}>
              <span className={`text-[10px] font-semibold tracking-[.04em] uppercase ${today ? "" : "text-muted"}`}>{DOW[weekdayIndex(d)]}</span>
              <span className="mt-1 text-[15px] font-extrabold">{d.getDate()}</span>
            </span>
            <span
              className={`relative block w-full flex-1 ${today ? "bg-today" : ""}`}
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--color-grid) 0 1px, transparent 1px)",
                backgroundSize: "100% calc(100% / 24)",
              }}
            >
              {segmentsForDay(activities, d).map((s) => {
                const box = fitBox(s);
                const a = s.activity;
                const cancelled = a.cancelledAt !== null;
                return (
                  <span
                    key={a.id}
                    aria-hidden="true"
                    title={`${a.name} · ${formatHm(new Date(a.plannedStart))}–${formatHm(new Date(a.plannedEnd))}`}
                    className={`absolute min-h-0.5 ${cancelled ? "bg-line" : "bg-(--cat)"}`}
                    style={
                      {
                        "--cat": categories.get(a.categoryId)?.color ?? "#8fb0aa",
                        top: pct(box.top),
                        height: pct(box.height),
                        left: `calc(${pct(box.left)} + 1px)`,
                        width: `calc(${pct(box.width)} - 2px)`,
                      } as CSSProperties
                    }
                  />
                );
              })}
              {today && <span aria-hidden="true" className="pointer-events-none absolute right-0 left-0 z-[3] h-0.5 bg-primary" style={{ top: pct(nowTop) }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
