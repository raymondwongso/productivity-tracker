"use client";

import type { Activity, ActivityLabel, Category } from "@productivitytracker/shared";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ActivityModal, type ModalTarget } from "@/features/activities/components/activity-modal";
import { CategoryPicker } from "@/features/activities/components/category-picker";
import { LabelChip } from "@/features/activities/components/label-chip";
import { useActivities, useCategories } from "@/features/activities/hooks";
import { LABEL_ORDER } from "@/features/activities/meta";
import { addDays, parseDateKey, startOfDay, stepAnchor, toDateKey, viewRange, viewTitle, type CalendarView as View } from "@/lib/dates";
import { NARROW, useMediaQuery } from "@/lib/use-media-query";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";
import { WeekOverview } from "./week-overview";

const VIEWS: View[] = ["day", "week", "month"];
const SUBTITLE: Record<View, string> = {
  day: "Day view",
  week: "Week view · Monday to Sunday",
  month: "Month view · click a day to open it",
};

export function CalendarView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "week";
  // On phones the week and month fit the screen as overviews, and a tap opens the day.
  const narrow = useMediaQuery(NARROW);
  const overview = narrow && view === "week";
  const anchor = parseDateKey(params.get("date")) ?? startOfDay(new Date());
  const { from, to } = viewRange(view, anchor);

  const { data: activities = [], isError, error } = useActivities(from, to);
  const { data: categoryList = [] } = useCategories();
  const categories = useMemo(() => new Map(categoryList.map((c) => [c.id, c])), [categoryList]);

  const [picker, setPicker] = useState<Date | null>(null);
  const [target, setTarget] = useState<ModalTarget | null>(null);

  const go = (next: { view?: View; date?: Date }) => {
    const q = new URLSearchParams({ view: next.view ?? view, date: toDateKey(next.date ?? anchor) });
    router.push(`${pathname}?${q}`, { scroll: false });
  };

  // Counts cover activities that start inside the visible range.
  const starting = activities.filter((a) => {
    const s = new Date(a.plannedStart);
    return s >= from && s < to;
  });
  const counts = new Map<ActivityLabel, number>(LABEL_ORDER.map((l) => [l, 0]));
  starting.forEach((a) => a.labels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1)));

  const openDay = (d: Date) => go({ view: "day", date: d });
  const openNew = () => {
    const s = new Date();
    s.setMinutes(0, 0, 0);
    s.setHours(s.getHours() + 1);
    setPicker(view === "day" && toDateKey(anchor) !== toDateKey(new Date()) ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 9) : s);
  };
  const modalCategory: Category | undefined =
    target?.kind === "new" ? target.category : target ? categories.get(target.activity.categoryId) : undefined;

  const segBtn = (pressed: boolean) => `flex items-center px-3 py-2 text-sm font-semibold ${pressed ? "bg-ink text-bg" : "hover:bg-surface-hover"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-3 pt-3.5 md:px-6 md:pt-5">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] md:text-[26px]">{viewTitle(view, anchor)}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{overview ? "Week view · tap a day to open it" : SUBTITLE[view]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex border-2 border-ink">
            <button type="button" aria-label="Previous" className={segBtn(false)} onClick={() => go({ date: stepAnchor(view, anchor, -1) })}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className={`${segBtn(false)} border-x-2 border-ink`} onClick={() => go({ date: startOfDay(new Date()) })}>
              Today
            </button>
            <button type="button" aria-label="Next" className={segBtn(false)} onClick={() => go({ date: stepAnchor(view, anchor, 1) })}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex border-2 border-ink" role="group" aria-label="Calendar view">
            {VIEWS.map((v, i) => (
              <button key={v} type="button" aria-pressed={v === view} className={`${segBtn(v === view)} ${i ? "border-l-2 border-ink" : ""}`} onClick={() => go({ view: v })}>
                {v[0]!.toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" onClick={openNew} className="flex items-center gap-3 bg-primary px-3 py-2.5 font-semibold text-on-primary hover:bg-primary-hover active:bg-primary-pressed">
            New activity
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted" aria-label="Labels in this range">
        <span>{starting.length} activities in view</span>
        {LABEL_ORDER.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <LabelChip label={l} />
            <b className="font-semibold text-ink">{counts.get(l)}</b>
          </span>
        ))}
        {view !== "month" && !overview && <span>· click an empty slot to plan something there</span>}
      </div>

      {isError && (
        <p role="alert" className="border-l-4 border-danger-text bg-danger-tint px-3 py-2 text-[13px] text-danger-text">
          Couldn’t load activities: {error.message}
        </p>
      )}

      {view === "month" ? (
        <MonthView
          month={anchor.getMonth()}
          from={from}
          to={to}
          activities={activities}
          categories={categories}
          onOpen={(a: Activity) => setTarget({ kind: "edit", activity: a })}
          onDayClick={openDay}
          compact={narrow}
        />
      ) : overview ? (
        <WeekOverview days={Array.from({ length: 7 }, (_, i) => addDays(from, i))} activities={activities} categories={categories} onDayClick={openDay} />
      ) : (
        <TimeGrid
          days={view === "day" ? [from] : Array.from({ length: 7 }, (_, i) => addDays(from, i))}
          activities={activities}
          categories={categories}
          onOpen={(a) => setTarget({ kind: "edit", activity: a })}
          onSlot={setPicker}
          onDayClick={openDay}
        />
      )}

      {picker && (
        <CategoryPicker
          start={picker}
          categories={categoryList}
          onClose={() => setPicker(null)}
          onPick={(c) => {
            setTarget({ kind: "new", category: c, start: picker });
            setPicker(null);
          }}
        />
      )}
      {target && modalCategory && (
        <ActivityModal key={target.kind === "edit" ? target.activity.id : "new"} target={target} category={modalCategory} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}
