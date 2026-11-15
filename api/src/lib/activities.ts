import type {
  Activity,
  ActivityFields,
  CategoryFieldsInput,
  CategorySlug,
  Game,
  GracePeriods,
  MealItem,
  Project,
  Title,
  UpdateActivityRequest,
  WorkoutItem,
} from "@productivitytracker/shared";
import { computeLabels } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import type { ActivityDetails, ActivityState } from "../repositories/postgres/activity.repository.js";
import { sanitizeNotes } from "./sanitize-notes.js";

export const WORKOUT_FOCUSES = [
  "cardio", "full_body", "upper_body", "lower_body", "hiit", "strength", "flexibility", "mobility", "yoga",
] as const;
export const NAME_MAX_LENGTH = 120;
export const MAX_ITEMS = 50;
export const MAX_CALORIES = 100_000;
const MAX_AMOUNT = 99_999_999.99;
const DAY_MS = 24 * 60 * 60_000;

type CategoryFieldKey = keyof CategoryFieldsInput;
const FIELDS_BY_CATEGORY: Record<CategorySlug, readonly CategoryFieldKey[]> = {
  sleep: [],
  workout: ["focus", "caloriesBurned", "items"],
  meals: ["totalCalories", "items"],
  work: ["projectId"],
  watch: ["titleId"],
  gaming: ["gameId"],
  misc: [],
};
const ALL_CATEGORY_FIELDS: readonly CategoryFieldKey[] = ["focus", "caloriesBurned", "items", "totalCalories", "projectId", "titleId", "gameId"];

/** Rejects category fields that don't belong to the activity's category (e.g. `focus` on a meal). */
export function assertFieldsFor(category: CategorySlug, req: Partial<Record<CategoryFieldKey, unknown>>): void {
  const allowed = FIELDS_BY_CATEGORY[category];
  for (const key of ALL_CATEGORY_FIELDS) {
    if (req[key] !== undefined && !allowed.includes(key)) {
      throw badRequest(`"${key}" does not apply to ${category} activities`);
    }
  }
}

export function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw badRequest("Name is required");
  if (n.length > NAME_MAX_LENGTH) throw badRequest(`Name must be at most ${NAME_MAX_LENGTH} characters`);
  return n;
}

export function parseTime(value: string, label: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} is not a valid date and time`);
  return d;
}
const parseOptional = (value: string | null | undefined, label: string) =>
  value === null || value === undefined ? null : parseTime(value, label);

export interface Times {
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
}

export function checkTimes(t: Times): void {
  if (t.plannedEnd <= t.plannedStart) throw badRequest("Planned end must be after planned start");
  if (t.plannedEnd.getTime() - t.plannedStart.getTime() > DAY_MS) throw badRequest("An activity can be at most 24 hours long");
  if (t.actualEnd && !t.actualStart) throw badRequest("Set the actual start before the actual end");
  if (t.actualStart && t.actualEnd && t.actualEnd <= t.actualStart) throw badRequest("Actual end must be after actual start");
}

const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
export const timesChanged = (a: Times, b: Times) =>
  !sameTime(a.plannedStart, b.plannedStart) || !sameTime(a.plannedEnd, b.plannedEnd) ||
  !sameTime(a.actualStart, b.actualStart) || !sameTime(a.actualEnd, b.actualEnd);

export function labelsFor(s: Times & { cancelledAt: Date | null }, grace: GracePeriods) {
  return computeLabels({ ...s, cancelled: s.cancelledAt !== null }, grace);
}

function checkCalories(v: number | null | undefined, label: string): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v) || v < 0 || v > MAX_CALORIES) throw badRequest(`${label} must be a whole number from 0 to ${MAX_CALORIES}`);
  return v;
}

export function cleanWorkoutItems(items: WorkoutItem[]): WorkoutItem[] {
  if (items.length > MAX_ITEMS) throw badRequest(`A workout can have at most ${MAX_ITEMS} items`);
  return items.map((i, n) => {
    const name = i.name.trim();
    if (!name) throw badRequest(`Workout item ${n + 1} needs a name`);
    if (name.length > NAME_MAX_LENGTH) throw badRequest(`Workout item ${n + 1} name is too long`);
    if (!(i.amount > 0) || i.amount > MAX_AMOUNT) throw badRequest(`Workout item ${n + 1} amount must be more than 0`);
    if (i.unit !== "x" && i.unit !== "mins") throw badRequest(`Workout item ${n + 1} unit must be x or mins`);
    return { name, amount: Math.round(i.amount * 100) / 100, unit: i.unit };
  });
}

export function cleanMealItems(items: MealItem[]): MealItem[] {
  if (items.length > MAX_ITEMS) throw badRequest(`A meal can have at most ${MAX_ITEMS} items`);
  return items.map((i, n) => {
    const name = i.name.trim();
    if (!name) throw badRequest(`Meal item ${n + 1} needs a name`);
    if (name.length > NAME_MAX_LENGTH) throw badRequest(`Meal item ${n + 1} name is too long`);
    return { name, calories: checkCalories(i.calories, `Meal item ${n + 1} calories`) ?? 0 };
  });
}

/** Merges category fields from a request onto the previous details (or empty ones on create). */
export function mergeDetails(
  category: CategorySlug,
  req: CategoryFieldsInput,
  previous: ActivityDetails | null,
): ActivityDetails {
  switch (category) {
    case "sleep":
    case "misc":
      return { category };
    case "workout": {
      const p = previous?.category === "workout" ? previous : { focus: null, caloriesBurned: null, items: [] };
      if (req.focus !== undefined && req.focus !== null && !WORKOUT_FOCUSES.includes(req.focus)) throw badRequest("Unknown workout focus");
      return {
        category,
        focus: req.focus === undefined ? p.focus : req.focus,
        caloriesBurned: req.caloriesBurned === undefined ? p.caloriesBurned : checkCalories(req.caloriesBurned, "Calorie burn"),
        items: req.items === undefined ? p.items : cleanWorkoutItems(req.items as WorkoutItem[]),
      };
    }
    case "meals": {
      const p = previous?.category === "meals" ? previous : { totalCalories: null, items: [] };
      const items = req.items === undefined ? p.items : cleanMealItems(req.items as MealItem[]);
      const typed = req.totalCalories === undefined ? p.totalCalories : checkCalories(req.totalCalories, "Total calories");
      // With items, the total is always their sum; without, it's what the user typed.
      const totalCalories = items.length ? items.reduce((s, i) => s + i.calories, 0) : typed;
      return { category, totalCalories, items };
    }
    case "work": {
      const p = previous?.category === "work" ? previous.projectId : null;
      return { category, projectId: req.projectId === undefined ? p : req.projectId };
    }
    case "watch": {
      const p = previous?.category === "watch" ? previous.titleId : null;
      return { category, titleId: req.titleId === undefined ? p : req.titleId };
    }
    case "gaming": {
      const p = previous?.category === "gaming" ? previous.gameId : null;
      return { category, gameId: req.gameId === undefined ? p : req.gameId };
    }
  }
}

export interface ReferenceLookups {
  projects: { findByIdForUser(id: number, userId: number): Promise<Project | null> };
  titles: { findByIdForUser(id: number, userId: number): Promise<Title | null> };
  games: { findByIdForUser(id: number, userId: number): Promise<Game | null> };
}

/**
 * Checks that a newly chosen project, title or game belongs to the user. A new project must be ongoing;
 * keeping a project that has since been completed is allowed.
 */
export async function checkReferences(
  userId: number,
  next: ActivityDetails,
  previous: ActivityDetails | null,
  { projects, titles, games }: ReferenceLookups,
): Promise<void> {
  if (next.category === "work" && next.projectId !== null) {
    const unchanged = previous?.category === "work" && previous.projectId === next.projectId;
    if (!unchanged) {
      const project = await projects.findByIdForUser(next.projectId, userId);
      if (!project) throw badRequest("Project not found");
      if (project.status !== "ongoing") throw badRequest("Choose an ongoing project");
    }
  }
  if (next.category === "watch" && next.titleId !== null) {
    const unchanged = previous?.category === "watch" && previous.titleId === next.titleId;
    if (!unchanged && !(await titles.findByIdForUser(next.titleId, userId))) throw badRequest("Movie or series not found");
  }
  if (next.category === "gaming" && next.gameId !== null) {
    const unchanged = previous?.category === "gaming" && previous.gameId === next.gameId;
    if (!unchanged && !(await games.findByIdForUser(next.gameId, userId))) throw badRequest("Game not found");
  }
}

/** Times and text fields of a create request, validated. */
export function parseFields(req: ActivityFields): Omit<ActivityState, "labels" | "details" | "cancelledAt"> {
  const t: Times = {
    plannedStart: parseTime(req.plannedStart, "Planned start"),
    plannedEnd: parseTime(req.plannedEnd, "Planned end"),
    actualStart: parseOptional(req.actualStart, "Actual start"),
    actualEnd: parseOptional(req.actualEnd, "Actual end"),
  };
  checkTimes(t);
  return { ...t, name: cleanName(req.name), notes: sanitizeNotes(req.notes ?? "") };
}

/** Applies a partial update to the stored state. Labels are left to the caller. */
export function applyPatch(prev: ActivityState, req: UpdateActivityRequest): Omit<ActivityState, "labels" | "details"> {
  const t: Times = {
    plannedStart: req.plannedStart === undefined ? prev.plannedStart : parseTime(req.plannedStart, "Planned start"),
    plannedEnd: req.plannedEnd === undefined ? prev.plannedEnd : parseTime(req.plannedEnd, "Planned end"),
    actualStart: req.actualStart === undefined ? prev.actualStart : parseOptional(req.actualStart, "Actual start"),
    actualEnd: req.actualEnd === undefined ? prev.actualEnd : parseOptional(req.actualEnd, "Actual end"),
  };
  checkTimes(t);
  return {
    ...t,
    name: req.name === undefined ? prev.name : cleanName(req.name),
    notes: req.notes === undefined ? prev.notes : sanitizeNotes(req.notes),
    cancelledAt: prev.cancelledAt,
  };
}

const date = (s: string | null) => (s === null ? null : new Date(s));

/** The stored state of an activity, as the repository writes it back. */
export function stateOf(a: Activity): ActivityState {
  let details: ActivityDetails;
  switch (a.category) {
    case "workout":
      details = { category: "workout", focus: a.focus, caloriesBurned: a.caloriesBurned, items: a.items };
      break;
    case "meals":
      details = { category: "meals", totalCalories: a.totalCalories, items: a.items };
      break;
    case "work":
      details = { category: "work", projectId: a.project?.id ?? null };
      break;
    case "watch":
      details = { category: "watch", titleId: a.title?.id ?? null };
      break;
    case "gaming":
      details = { category: "gaming", gameId: a.game?.id ?? null };
      break;
    case "misc":
      details = { category: "misc" };
      break;
    case "sleep":
      details = { category: "sleep" };
  }
  return {
    name: a.name,
    plannedStart: new Date(a.plannedStart),
    plannedEnd: new Date(a.plannedEnd),
    actualStart: date(a.actualStart),
    actualEnd: date(a.actualEnd),
    notes: a.notes,
    cancelledAt: date(a.cancelledAt),
    labels: a.labels,
    details,
  };
}

const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

/**
 * The category fields that differ between two detail states of the same category, shaped as
 * request input. Used to carry an edit of "this and following" to the later occurrences:
 * only what changed on the edited occurrence is copied.
 */
export function changedCategoryFields(prev: ActivityDetails, next: ActivityDetails): CategoryFieldsInput {
  switch (next.category) {
    case "workout": {
      const p = prev.category === "workout" ? prev : null;
      return {
        ...(differs(p?.focus, next.focus) ? { focus: next.focus } : {}),
        ...(differs(p?.caloriesBurned, next.caloriesBurned) ? { caloriesBurned: next.caloriesBurned } : {}),
        ...(differs(p?.items, next.items) ? { items: next.items } : {}),
      };
    }
    case "meals": {
      const p = prev.category === "meals" ? prev : null;
      return {
        ...(differs(p?.totalCalories, next.totalCalories) ? { totalCalories: next.totalCalories } : {}),
        ...(differs(p?.items, next.items) ? { items: next.items } : {}),
      };
    }
    case "work":
      return differs(prev.category === "work" ? prev.projectId : undefined, next.projectId) ? { projectId: next.projectId } : {};
    case "watch":
      return differs(prev.category === "watch" ? prev.titleId : undefined, next.titleId) ? { titleId: next.titleId } : {};
    case "gaming":
      return differs(prev.category === "gaming" ? prev.gameId : undefined, next.gameId) ? { gameId: next.gameId } : {};
    case "sleep":
    case "misc":
      return {};
  }
}
