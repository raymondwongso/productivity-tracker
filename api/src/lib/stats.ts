// Pure aggregation for the tracker pages. A finished activity (actual start and end, not
// cancelled) counts on the local date of its planned start. Labels are the stored ones.
import type {
  ActivityLabel,
  CinemaStats,
  FitnessStats,
  SleepDay,
  SleepStats,
  TimePart,
  TimeStats,
  WorkoutFocus,
} from "@productivitytracker/shared";
import type { StatsActivity } from "../repositories/postgres/stats.repository.js";
import { WORKOUT_FOCUSES } from "./activities.js";
import type { StatsRange } from "./stats-range.js";

const MIN = 60_000;
const LABEL_ORDER: ActivityLabel[] = ["pending", "late", "premature", "overrun", "done", "cancelled"];

export const isFinished = (a: StatsActivity) => !a.cancelled && a.actualStart !== null && a.actualEnd !== null;
const minutes = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / MIN);
const duration = (a: StatsActivity) => minutes(a.actualStart!, a.actualEnd!);
/** Not cancelled, planned end passed, no actual end: left out, and the page says how many. */
export const isNotCounted = (a: StatsActivity, now: Date) => !a.cancelled && a.actualEnd === null && a.plannedEnd < now;

function byDay(range: StatsRange, rows: StatsActivity[]): Map<string, StatsActivity[]> {
  const m = new Map(range.days.map((d) => [d, [] as StatsActivity[]]));
  for (const r of rows) m.get(r.date)?.push(r);
  return m;
}

export function buildSleepStats(range: StatsRange, rows: StatsActivity[], now: Date): SleepStats {
  const days: SleepDay[] = [];
  let trackedDays = 0;
  for (const [date, list] of byDay(range, rows)) {
    const live = list.filter((a) => !a.cancelled);
    const started = live.filter((a) => a.actualStart !== null);
    if (started.length) trackedDays += 1;
    const labels = LABEL_ORDER.filter((l) => started.some((a) => a.labels.includes(l)));
    let lateMinutes = 0;
    let prematureMinutes = 0;
    for (const a of started) {
      if (a.labels.includes("late")) lateMinutes += minutes(a.plannedStart, a.actualStart!);
      if (a.labels.includes("premature") && a.actualEnd) prematureMinutes += minutes(a.actualEnd, a.plannedEnd);
    }
    const main = [...live].sort(
      (x, y) => y.plannedEnd.getTime() - y.plannedStart.getTime() - (x.plannedEnd.getTime() - x.plannedStart.getTime()) || x.id - y.id,
    )[0];
    days.push({
      date,
      labels,
      sleptMinutes: started.filter(isFinished).reduce((s, a) => s + duration(a), 0),
      lateMinutes,
      prematureMinutes,
      onSchedule: live.length > 0 && live.every((a) => a.labels.length === 1 && a.labels[0] === "done"),
      unlogged: live.some((a) => isNotCounted(a, now)),
      main: main
        ? {
            activityId: main.id,
            plannedStart: main.plannedStart.toISOString(),
            plannedEnd: main.plannedEnd.toISOString(),
            actualStart: main.actualStart?.toISOString() ?? null,
            actualEnd: main.actualEnd?.toISOString() ?? null,
            labels: main.labels,
          }
        : null,
    });
  }
  const count = (p: (d: SleepDay) => boolean) => days.filter(p).length;
  const sum = (k: "sleptMinutes" | "lateMinutes" | "prematureMinutes") => days.reduce((s, d) => s + d[k], 0);
  return {
    summary: {
      trackedDays,
      onScheduleDays: count((d) => d.onSchedule),
      lateDays: count((d) => d.labels.includes("late")),
      prematureDays: count((d) => d.labels.includes("premature")),
      overrunDays: count((d) => d.labels.includes("overrun")),
      sleptMinutes: sum("sleptMinutes"),
      lateMinutes: sum("lateMinutes"),
      prematureMinutes: sum("prematureMinutes"),
      unloggedDays: count((d) => d.unlogged),
      averagedDays: range.averagedDays,
    },
    days,
  };
}

const FOCUS_RANK = new Map<WorkoutFocus | null, number>(WORKOUT_FOCUSES.map((f, i) => [f, i]));

export function buildFitnessStats(range: StatsRange, workouts: StatsActivity[], meals: StatsActivity[], now: Date): FitnessStats {
  const w = byDay(range, workouts.filter(isFinished));
  const m = byDay(range, meals.filter(isFinished));
  const focus = new Map<WorkoutFocus | null, { sessions: number; minutes: number }>();
  for (const a of workouts.filter(isFinished)) {
    const f = focus.get(a.focus) ?? { sessions: 0, minutes: 0 };
    f.sessions += 1;
    f.minutes += duration(a);
    focus.set(a.focus, f);
  }
  const workoutDays = range.days.map((date) => {
    const list = w.get(date) ?? [];
    return { date, minutes: list.reduce((s, a) => s + duration(a), 0), caloriesBurned: list.reduce((s, a) => s + (a.caloriesBurned ?? 0), 0) };
  });
  const mealDays = range.days.map((date) => ({ date, calories: (m.get(date) ?? []).reduce((s, a) => s + (a.totalCalories ?? 0), 0) }));
  return {
    averagedDays: range.averagedDays,
    workout: {
      sessions: workouts.filter(isFinished).length,
      minutes: workoutDays.reduce((s, d) => s + d.minutes, 0),
      caloriesBurned: workoutDays.reduce((s, d) => s + d.caloriesBurned, 0),
      notCounted: workouts.filter((a) => isNotCounted(a, now)).length,
      focus: [...focus]
        .map(([f, v]) => ({ focus: f, ...v }))
        .sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes || (FOCUS_RANK.get(a.focus) ?? 99) - (FOCUS_RANK.get(b.focus) ?? 99)),
      days: workoutDays,
    },
    meals: {
      meals: meals.filter(isFinished).length,
      calories: mealDays.reduce((s, d) => s + d.calories, 0),
      notCounted: meals.filter((a) => isNotCounted(a, now)).length,
      days: mealDays,
    },
    diet: {
      days: range.days.map((date, i) => {
        const consumed = mealDays[i]!.calories;
        const burned = workoutDays[i]!.caloriesBurned;
        return { date, consumed, burned, net: consumed - burned };
      }),
    },
  };
}

/** Minutes per project, title or game, and per day. `noneName` names activities without one. */
export function buildTimeStats(range: StatsRange, rows: StatsActivity[], now: Date, noneName: string): TimeStats {
  const done = rows.filter(isFinished);
  const parts = new Map<number | null, TimePart>();
  for (const a of done) {
    const p = parts.get(a.refId) ?? { id: a.refId, name: a.refName ?? noneName, minutes: 0, sessions: 0 };
    p.minutes += duration(a);
    p.sessions += 1;
    parts.set(a.refId, p);
  }
  const perDay = byDay(range, done);
  const days = range.days.map((date) => ({ date, minutes: (perDay.get(date) ?? []).reduce((s, a) => s + duration(a), 0) }));
  return {
    averagedDays: range.averagedDays,
    minutes: days.reduce((s, d) => s + d.minutes, 0),
    sessions: done.length,
    notCounted: rows.filter((a) => isNotCounted(a, now)).length,
    parts: [...parts.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)),
    days,
  };
}

/** Cinema parts also say whether each title is a movie or a series. */
export function buildCinemaStats(range: StatsRange, rows: StatsActivity[], now: Date): CinemaStats {
  const base = buildTimeStats(range, rows, now, "No title");
  const kinds = new Map(rows.map((r) => [r.refId, r.refKind]));
  return { ...base, parts: base.parts.map((p) => ({ ...p, kind: kinds.get(p.id) ?? null })) };
}
