"use client";

import type { Weekday } from "@productivitytracker/shared";
import { isoWeekday, latestRepeatUntil, MAX_REPEAT_EVERY } from "@productivitytracker/shared";
import { inputClass } from "@/components/ui/field";
import { DOW, formatDateKey, fromLocalInput, toDateKey } from "@/lib/dates";
import { previewOccurrences, type Draft, type DraftRepeat } from "../../draft";

interface Props {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  error?: string;
}

const CHOICES: { value: DraftRepeat["frequency"]; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const toggle = (on: boolean) =>
  `border-2 border-ink px-3 py-2 text-[13px] font-semibold ${on ? "bg-ink text-bg" : "bg-surface hover:bg-ink hover:text-bg"}`;

/** Repeat settings of a new activity: daily or weekly, every N, until a date at most a month out. */
export function RepeatFields({ draft, set, error }: Props) {
  const r = draft.repeat;
  const patch = (p: Partial<DraftRepeat>) => set({ repeat: { ...r, ...p } });
  const start = fromLocalInput(draft.plannedStart);
  const startsOn = start ? toDateKey(start) : null;
  const dates = previewOccurrences(draft);

  function choose(frequency: DraftRepeat["frequency"]) {
    // Weekly starts from the first occurrence's own weekday, which it must include.
    const weekdays = frequency === "weekly" && startsOn && !r.weekdays.includes(isoWeekday(startsOn)) ? [...r.weekdays, isoWeekday(startsOn)] : r.weekdays;
    patch({ frequency, weekdays });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-1.5 text-[13px] font-semibold">Repeat</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Repeat">
        {CHOICES.map((c) => (
          <button key={c.value} type="button" aria-pressed={r.frequency === c.value} className={toggle(r.frequency === c.value)} onClick={() => choose(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
      {r.frequency !== "none" && (
        <>
          <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
            <label htmlFor="f-every" className="font-semibold">Every</label>
            <input
              id="f-every"
              type="number"
              min={1}
              max={MAX_REPEAT_EVERY}
              className={`${inputClass} w-20 py-2`}
              value={r.every}
              onChange={(e) => patch({ every: e.target.value })}
            />
            <span>{r.frequency === "daily" ? (r.every === "1" ? "day" : "days") : r.every === "1" ? "week" : "weeks"}</span>
            <label htmlFor="f-until" className="ml-2 font-semibold">Ends on</label>
            <input
              id="f-until"
              type="date"
              className={`${inputClass} w-auto py-2`}
              min={startsOn ?? undefined}
              max={startsOn ? latestRepeatUntil(startsOn) : undefined}
              value={r.until}
              onChange={(e) => patch({ until: e.target.value })}
            />
          </div>
          {r.frequency === "weekly" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="On these days">
              {WEEKDAYS.map((d) => {
                const on = r.weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    className={`${toggle(on)} w-12 px-0`}
                    onClick={() => patch({ weekdays: on ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d] })}
                  >
                    {DOW[d - 1]}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted" aria-live="polite">
            {dates
              ? `Creates ${dates.length} ${dates.length === 1 ? "activity" : "activities"} · ${formatDateKey(dates[0]!)} → ${formatDateKey(dates[dates.length - 1]!)} · at most one month`
              : "A series runs for at most one month."}
          </p>
        </>
      )}
      {error && <p role="alert" className="text-[13px] text-danger-text">{error}</p>}
    </fieldset>
  );
}
