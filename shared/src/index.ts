export * from "./labels.js";

// ---------- errors and auth ----------

export interface ApiErrorBody {
  error: string;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ---------- reference data ----------

export type CategorySlug = "sleep" | "work" | "workout" | "meals" | "watch" | "gaming" | "misc";

export interface Category {
  id: number;
  slug: CategorySlug;
  name: string;
  /** `#rrggbb` */
  color: string;
  sortOrder: number;
}

export interface GracePeriods {
  lateMinutes: number;
  prematureMinutes: number;
  overrunMinutes: number;
}

export type ProjectStatus = "ongoing" | "on_hold" | "completed";

export interface Project {
  id: number;
  name: string;
  status: ProjectStatus;
}

export interface CreateProjectRequest {
  name: string;
}

export type TitleKind = "movie" | "series";

export interface Title {
  id: number;
  name: string;
  kind: TitleKind;
}

export interface CreateTitleRequest {
  name: string;
  kind: TitleKind;
}

export interface Game {
  id: number;
  name: string;
}

export interface CreateGameRequest {
  name: string;
}

// ---------- activities ----------

export type ActivityLabel = "pending" | "late" | "premature" | "overrun" | "done" | "cancelled";

export type WorkoutFocus =
  | "cardio"
  | "full_body"
  | "upper_body"
  | "lower_body"
  | "hiit"
  | "strength"
  | "flexibility"
  | "mobility"
  | "yoga";

export type WorkoutUnit = "x" | "mins";

export interface WorkoutItem {
  name: string;
  amount: number;
  unit: WorkoutUnit;
}

export interface MealItem {
  name: string;
  calories: number;
}

export interface ActivityBase {
  id: number;
  categoryId: number;
  name: string;
  /** ISO 8601 */
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  /** Sanitized HTML. */
  notes: string;
  cancelledAt: string | null;
  /** Stored; set by the API when the activity is written. */
  labels: ActivityLabel[];
  createdAt: string;
  updatedAt: string;
}

export interface SleepActivity extends ActivityBase {
  category: "sleep";
}
export interface WorkoutActivity extends ActivityBase {
  category: "workout";
  focus: WorkoutFocus | null;
  caloriesBurned: number | null;
  items: WorkoutItem[];
}
export interface MealActivity extends ActivityBase {
  category: "meals";
  totalCalories: number | null;
  items: MealItem[];
}
export interface WorkActivity extends ActivityBase {
  category: "work";
  project: Pick<Project, "id" | "name"> | null;
}
export interface WatchActivity extends ActivityBase {
  category: "watch";
  title: Title | null;
}

export interface GamingActivity extends ActivityBase {
  category: "gaming";
  game: Game | null;
}

/** Anything else: errands, driving. No category fields and no tracker. */
export interface MiscActivity extends ActivityBase {
  category: "misc";
}

export type Activity = SleepActivity | WorkoutActivity | MealActivity | WorkActivity | WatchActivity | GamingActivity | MiscActivity;

/** Fields every category accepts on create. Times are ISO 8601. */
export interface ActivityFields {
  name: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  notes?: string;
}

export interface WorkoutFields {
  focus?: WorkoutFocus | null;
  caloriesBurned?: number | null;
  items?: WorkoutItem[];
}
export interface MealFields {
  /** Ignored when items are given: the total is then their sum. */
  totalCalories?: number | null;
  items?: MealItem[];
}
export interface WorkFields {
  projectId?: number | null;
}
export interface WatchFields {
  titleId?: number | null;
}
export interface GamingFields {
  gameId?: number | null;
}

export type CreateActivityRequest =
  | (ActivityFields & { category: "sleep" })
  | (ActivityFields & WorkoutFields & { category: "workout" })
  | (ActivityFields & MealFields & { category: "meals" })
  | (ActivityFields & WorkFields & { category: "work" })
  | (ActivityFields & WatchFields & { category: "watch" })
  | (ActivityFields & GamingFields & { category: "gaming" })
  | (ActivityFields & { category: "misc" });

/**
 * Partial update. The category cannot change; category fields must match the activity's category.
 * `items`, when present, replaces the whole list.
 */
export type UpdateActivityRequest = Partial<ActivityFields> &
  Omit<WorkoutFields, "items"> &
  Omit<MealFields, "items"> &
  WorkFields &
  WatchFields &
  GamingFields & { items?: WorkoutItem[] | MealItem[] };

/** The category-specific part of a create or update request. */
export type CategoryFieldsInput = Omit<UpdateActivityRequest, keyof ActivityFields>;

// ---------- trackers (stats) ----------
// A finished activity (actual start and end, not cancelled) counts on the local date of its
// planned start. Minutes and kcal are raw numbers; dates are local YYYY-MM-DD.

/** Query of every stats route. `from` and `to` are inclusive local dates; `tz` is an IANA zone. */
export interface StatsQuery {
  from: string;
  to: string;
  tz: string;
}

export interface SleepDay {
  date: string;
  /** Union of the stored labels of that day's started, non-cancelled sleeps. */
  labels: ActivityLabel[];
  /** Actual durations of the finished sleeps planned to start that day. */
  sleptMinutes: number;
  /** Actual start minus planned start, on late sleeps. */
  lateMinutes: number;
  /** Planned end minus actual end, on premature sleeps. */
  prematureMinutes: number;
  /** Every sleep that day is {done}. */
  onSchedule: boolean;
  /** A sleep whose planned end has passed without an actual end. */
  unlogged: boolean;
  /** The longest sleep planned that day, for the bedtime chart. */
  main: {
    activityId: number;
    plannedStart: string;
    plannedEnd: string;
    actualStart: string | null;
    actualEnd: string | null;
    labels: ActivityLabel[];
  } | null;
}

export interface SleepStats {
  summary: {
    trackedDays: number;
    onScheduleDays: number;
    lateDays: number;
    prematureDays: number;
    overrunDays: number;
    sleptMinutes: number;
    lateMinutes: number;
    prematureMinutes: number;
    unloggedDays: number;
    /** Days in the range up to today: what per-day averages divide by. */
    averagedDays: number;
  };
  days: SleepDay[];
}

export interface FitnessStats {
  averagedDays: number;
  workout: {
    sessions: number;
    minutes: number;
    caloriesBurned: number;
    notCounted: number;
    focus: { focus: WorkoutFocus | null; sessions: number; minutes: number }[];
    days: { date: string; minutes: number; caloriesBurned: number }[];
  };
  meals: {
    meals: number;
    calories: number;
    notCounted: number;
    days: { date: string; calories: number }[];
  };
  diet: { days: { date: string; consumed: number; burned: number; net: number }[] };
}

/** Time spent on one project, title or game. `id` null means none was set. */
export interface TimePart {
  id: number | null;
  name: string;
  minutes: number;
  sessions: number;
}

export interface TimeStats<P extends TimePart = TimePart> {
  averagedDays: number;
  minutes: number;
  sessions: number;
  notCounted: number;
  /** Largest first. */
  parts: P[];
  days: { date: string; minutes: number }[];
}

export type WorkStats = TimeStats;
export type CinemaStats = TimeStats<TimePart & { kind: TitleKind | null }>;
export type GamingStats = TimeStats;
