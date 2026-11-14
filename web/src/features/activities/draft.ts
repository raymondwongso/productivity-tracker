import type {
  Activity,
  ActivityLabel,
  CategorySlug,
  CreateActivityRequest,
  GracePeriods,
  UpdateActivityRequest,
  WorkoutFocus,
  WorkoutUnit,
} from "@productivitytracker/shared";
import { computeLabels } from "@productivitytracker/shared";
import { addMinutes, fromLocalInput, toLocalInput } from "@/lib/dates";
import { DEFAULT_MINUTES } from "./meta";

/** Form state of the activity modal. Number fields stay strings while typing. */
export interface Draft {
  category: CategorySlug;
  name: string;
  /** `datetime-local` values; "" when not set. */
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  notes: string;
  cancelled: boolean;
  focus: WorkoutFocus | null;
  caloriesBurned: string;
  workoutItems: { name: string; amount: string; unit: WorkoutUnit }[];
  totalCalories: string;
  mealItems: { name: string; calories: string }[];
  projectId: number | null;
  titleId: number | null;
  gameId: number | null;
}

const localOf = (iso: string | null) => toLocalInput(iso ? new Date(iso) : null);
const str = (n: number | null) => (n === null ? "" : String(n));

export function draftFromActivity(a: Activity): Draft {
  return {
    category: a.category,
    name: a.name,
    plannedStart: localOf(a.plannedStart),
    plannedEnd: localOf(a.plannedEnd),
    actualStart: localOf(a.actualStart),
    actualEnd: localOf(a.actualEnd),
    notes: a.notes,
    cancelled: a.cancelledAt !== null,
    focus: a.category === "workout" ? a.focus : null,
    caloriesBurned: a.category === "workout" ? str(a.caloriesBurned) : "",
    workoutItems: a.category === "workout" ? a.items.map((i) => ({ name: i.name, amount: String(i.amount), unit: i.unit })) : [],
    totalCalories: a.category === "meals" ? str(a.totalCalories) : "",
    mealItems: a.category === "meals" ? a.items.map((i) => ({ name: i.name, calories: String(i.calories) })) : [],
    projectId: a.category === "work" ? (a.project?.id ?? null) : null,
    titleId: a.category === "watch" ? (a.title?.id ?? null) : null,
    gameId: a.category === "gaming" ? (a.game?.id ?? null) : null,
  };
}

export function newDraft(category: CategorySlug, start: Date): Draft {
  return {
    category,
    name: "",
    plannedStart: toLocalInput(start),
    plannedEnd: toLocalInput(addMinutes(start, DEFAULT_MINUTES[category])),
    actualStart: "",
    actualEnd: "",
    notes: "",
    cancelled: false,
    focus: null,
    caloriesBurned: "",
    workoutItems: [],
    totalCalories: "",
    mealItems: [],
    projectId: null,
    titleId: null,
    gameId: null,
  };
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Sum of the meal items, or the typed total when there are none. */
export function mealTotal(d: Draft): number | null {
  if (d.mealItems.length) return d.mealItems.reduce((sum, i) => sum + (Number(i.calories) || 0), 0);
  return num(d.totalCalories);
}

interface DraftTimes {
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
}

function timesOf(d: Draft): DraftTimes | null {
  const plannedStart = fromLocalInput(d.plannedStart);
  const plannedEnd = fromLocalInput(d.plannedEnd);
  if (!plannedStart || !plannedEnd) return null;
  return { plannedStart, plannedEnd, actualStart: fromLocalInput(d.actualStart), actualEnd: fromLocalInput(d.actualEnd) };
}

const sameTime = (a: Date | null, b: string | null) => (a?.getTime() ?? null) === (b ? new Date(b).getTime() : null);

/**
 * The labels the API will store if this draft is saved. Mirrors the server: an existing
 * activity keeps its stored labels unless a time changed. Null while the times are incomplete.
 */
export function previewLabels(d: Draft, original: Activity | null, grace: GracePeriods | undefined): ActivityLabel[] | null {
  if (d.cancelled) return ["cancelled"];
  const t = timesOf(d);
  if (!t) return null;
  if (
    original &&
    sameTime(t.plannedStart, original.plannedStart) &&
    sameTime(t.plannedEnd, original.plannedEnd) &&
    sameTime(t.actualStart, original.actualStart) &&
    sameTime(t.actualEnd, original.actualEnd)
  ) {
    return original.labels;
  }
  if (!grace) return null;
  return computeLabels({ ...t, cancelled: false }, grace);
}

export interface DraftErrors {
  name?: string;
  planned?: string;
  actual?: string;
  numbers?: string;
}

const isWhole = (s: string) => s.trim() === "" || (/^\d+$/.test(s.trim()) && Number(s) <= 100_000);

export function validateDraft(d: Draft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = "Give the activity a name.";
  const t = timesOf(d);
  if (!t) e.planned = "Set the planned start and end.";
  else if (t.plannedEnd <= t.plannedStart) e.planned = "Planned end must be after planned start.";
  else if (t.plannedEnd.getTime() - t.plannedStart.getTime() > 24 * 60 * 60_000) e.planned = "An activity can be at most 24 hours long.";
  if (t) {
    if (t.actualEnd && !t.actualStart) e.actual = "Set the actual start before the actual end.";
    else if (t.actualStart && t.actualEnd && t.actualEnd <= t.actualStart) e.actual = "Actual end must be after actual start.";
  }
  if (d.category === "workout") {
    if (!isWhole(d.caloriesBurned)) e.numbers = "Calorie burn must be a whole number.";
    else if (d.workoutItems.some((i) => i.name.trim() && !(Number(i.amount) > 0))) e.numbers = "Each workout item needs an amount above 0.";
  }
  if (d.category === "meals") {
    if (!isWhole(d.totalCalories) || d.mealItems.some((i) => !isWhole(i.calories))) e.numbers = "Calories must be whole numbers.";
  }
  return e;
}

const iso = (s: string) => {
  const d = fromLocalInput(s);
  return d ? d.toISOString() : null;
};

/** Everything but the category, shaped for the API. Items without a name are dropped. */
export function toUpdateRequest(d: Draft): UpdateActivityRequest {
  const base: UpdateActivityRequest = {
    name: d.name.trim(),
    plannedStart: iso(d.plannedStart) ?? undefined,
    plannedEnd: iso(d.plannedEnd) ?? undefined,
    actualStart: iso(d.actualStart),
    actualEnd: iso(d.actualEnd),
    notes: d.notes,
  };
  switch (d.category) {
    case "workout":
      return {
        ...base,
        focus: d.focus,
        caloriesBurned: num(d.caloriesBurned),
        items: d.workoutItems.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: Number(i.amount), unit: i.unit })),
      };
    case "meals": {
      const items = d.mealItems.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), calories: Number(i.calories) || 0 }));
      return { ...base, items, totalCalories: items.length ? null : num(d.totalCalories) };
    }
    case "work":
      return { ...base, projectId: d.projectId };
    case "watch":
      return { ...base, titleId: d.titleId };
    case "gaming":
      return { ...base, gameId: d.gameId };
    default:
      return base;
  }
}

export function toCreateRequest(d: Draft): CreateActivityRequest {
  const u = toUpdateRequest(d);
  const base = {
    name: u.name ?? "",
    plannedStart: u.plannedStart ?? "",
    plannedEnd: u.plannedEnd ?? "",
    actualStart: u.actualStart,
    actualEnd: u.actualEnd,
    notes: u.notes,
  };
  switch (d.category) {
    case "workout":
      return { ...base, category: "workout", focus: u.focus, caloriesBurned: u.caloriesBurned, items: d.workoutItems.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), amount: Number(i.amount), unit: i.unit })) };
    case "meals":
      return { ...base, category: "meals", totalCalories: u.totalCalories, items: d.mealItems.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), calories: Number(i.calories) || 0 })) };
    case "work":
      return { ...base, category: "work", projectId: u.projectId };
    case "watch":
      return { ...base, category: "watch", titleId: u.titleId };
    case "gaming":
      return { ...base, category: "gaming", gameId: u.gameId };
    default:
      return { ...base, category: "sleep" };
  }
}
