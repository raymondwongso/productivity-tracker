import type { Activity, GracePeriods } from "@productivitytracker/shared";
import { describe, expect, it } from "vitest";
import { draftFromActivity, mealTotal, newDraft, previewLabels, toCreateRequest, toUpdateRequest, validateDraft } from "./draft";

const grace: GracePeriods = { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 };
const local = (hhmm: string, day = 14) => `2026-11-${day}T${hhmm}`;
const isoOf = (hhmm: string, day = 14) => new Date(local(hhmm, day)).toISOString();

const stored: Activity = {
  id: 7, category: "meals", categoryId: 4, name: "Lunch", plannedStart: isoOf("12:00"), plannedEnd: isoOf("12:45"),
  actualStart: isoOf("12:12"), actualEnd: isoOf("12:45"), notes: "<p>slow</p>", cancelledAt: null,
  labels: ["late"], createdAt: "", updatedAt: "", totalCalories: 500, items: [{ name: "Rice", calories: 200 }, { name: "Fish", calories: 300 }],
};

describe("previewLabels", () => {
  it("computes labels for a new activity, several at once", () => {
    // Work defaults to a one-hour plan: 09:00 → 10:00.
    const d = { ...newDraft("work", new Date(local("09:00"))), actualStart: local("09:15"), actualEnd: local("10:30") };
    expect(previewLabels(d, null, grace)).toEqual(["late", "overrun"]);
  });

  it("keeps the stored labels while no time changes, like the API", () => {
    // Stored under an older, stricter grace: a fresh computation with a wider grace would differ.
    const d = { ...draftFromActivity(stored), name: "Renamed" };
    expect(previewLabels(d, stored, { ...grace, lateMinutes: 30 })).toEqual(["late"]);
    expect(previewLabels({ ...d, actualEnd: local("13:10") }, stored, grace)).toEqual(["late", "overrun"]);
  });

  it("shows cancelled, and nothing while times are incomplete", () => {
    expect(previewLabels({ ...draftFromActivity(stored), cancelled: true }, stored, grace)).toEqual(["cancelled"]);
    expect(previewLabels({ ...newDraft("sleep", new Date()), plannedEnd: "" }, null, grace)).toBeNull();
  });
});

describe("validateDraft", () => {
  const d = newDraft("workout", new Date(local("09:00")));
  it("checks name and time order", () => {
    expect(validateDraft(d)).toEqual({ name: "Give the activity a name." });
    expect(validateDraft({ ...d, name: "x", plannedEnd: local("08:00") }).planned).toMatch(/after planned start/);
    expect(validateDraft({ ...d, name: "x", plannedEnd: local("10:00", 15) }).planned).toMatch(/24 hours/);
    expect(validateDraft({ ...d, name: "x", actualEnd: local("10:00") }).actual).toMatch(/actual start before/);
    expect(validateDraft({ ...d, name: "x", actualStart: local("10:00"), actualEnd: local("09:59") }).actual).toMatch(/after actual start/);
  });
  it("checks numbers", () => {
    expect(validateDraft({ ...d, name: "x", caloriesBurned: "12.5" }).numbers).toBeDefined();
    expect(validateDraft({ ...d, name: "x", workoutItems: [{ name: "Squat", amount: "0", unit: "x" }] }).numbers).toBeDefined();
  });
});

describe("requests", () => {
  it("builds a create request with only the category's fields", () => {
    const d = {
      ...newDraft("workout", new Date(local("17:45"))), name: " Gym ", focus: "strength" as const, caloriesBurned: "320",
      workoutItems: [{ name: "Squat", amount: "5", unit: "x" as const }, { name: " ", amount: "1", unit: "x" as const }],
    };
    expect(toCreateRequest(d)).toEqual({
      category: "workout", name: "Gym", plannedStart: isoOf("17:45"), plannedEnd: isoOf("18:45"), actualStart: null, actualEnd: null,
      notes: "", focus: "strength", caloriesBurned: 320, items: [{ name: "Squat", amount: 5, unit: "x" }],
    });
  });

  it("sends items instead of a total when a meal has items", () => {
    const d = draftFromActivity(stored);
    expect(mealTotal(d)).toBe(500);
    const u = toUpdateRequest({ ...d, mealItems: [...d.mealItems, { name: "Tea", calories: "40" }] });
    expect(u.totalCalories).toBeNull();
    expect(u.items).toHaveLength(3);
    expect(toUpdateRequest({ ...d, mealItems: [], totalCalories: "450" }).totalCalories).toBe(450);
  });
});
