import type { ActivityLabel, CategorySlug, WorkoutFocus } from "@productivitytracker/shared";
import { Briefcase, Dumbbell, Film, Gamepad2, Moon, Utensils, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<CategorySlug, LucideIcon> = {
  sleep: Moon,
  work: Briefcase,
  workout: Dumbbell,
  meals: Utensils,
  watch: Film,
  gaming: Gamepad2,
};

export const CATEGORY_HINTS: Record<CategorySlug, string> = {
  sleep: "Bedtime and wake-up",
  work: "Time on an ongoing project",
  workout: "Focus, exercises and calories burned",
  meals: "What you ate and calories taken",
  watch: "A movie or an episode of a series",
  gaming: "A session with a game",
};

export const NAME_PLACEHOLDERS: Record<CategorySlug, string> = {
  sleep: "Night sleep",
  work: "Deep work",
  workout: "Leg day",
  meals: "Lunch",
  watch: "Movie night",
  gaming: "Evening session",
};

/** Default planned length, in minutes, for a new activity. */
export const DEFAULT_MINUTES: Record<CategorySlug, number> = { sleep: 480, work: 60, workout: 60, meals: 45, watch: 60, gaming: 60 };

export const FOCUS_OPTIONS: { value: WorkoutFocus; label: string }[] = [
  { value: "cardio", label: "Cardio" },
  { value: "full_body", label: "Full body workout" },
  { value: "upper_body", label: "Upper body workout" },
  { value: "lower_body", label: "Lower body workout" },
  { value: "hiit", label: "HIIT" },
  { value: "strength", label: "Strength" },
  { value: "flexibility", label: "Flexibility" },
  { value: "mobility", label: "Mobility" },
  { value: "yoga", label: "Yoga" },
];
export const focusLabel = (f: WorkoutFocus | null) => FOCUS_OPTIONS.find((o) => o.value === f)?.label ?? null;

export const LABEL_ORDER: ActivityLabel[] = ["pending", "late", "premature", "overrun", "done", "cancelled"];
