import type { Activity, GracePeriods } from "@productivitytracker/shared";
import { describe, expect, it } from "vitest";
import { draftFromActivity, mealTotal, newDraft, previewLabels, previewOccurrences, repeatRuleOf, toCreateRequest, toCreateSeriesRequest, toUpdateRequest, validateDraft } from "./draft";

const grace: GracePeriods = { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 };
const local = (hhmm: string, day = 14) => `2026-11-${day}T${hhmm}`;
const isoOf = (hhmm: string, day = 14) => new Date(local(hhmm, day)).toISOString();

const stored: Activity = {
  id: 7, category: "meals", categoryId: 4, name: "Lunch", plannedStart: isoOf("12:00"), plannedEnd: isoOf("12:45"),
  actualStart: isoOf("12:12"), actualEnd: isoOf("12:45"), notes: "<p>slow</p>", cancelledAt: null,
  labels: ["late"], seriesId: null, createdAt: "", updatedAt: "", totalCalories: 500, items: [{ name: "Rice", calories: 200 }, { name: "Fish", calories: 300 }],
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

  it("builds a misc request with no category fields and a 30-minute default", () => {
    const d = { ...newDraft("misc", new Date(local("17:00"))), name: " Groceries " };
    expect(toCreateRequest(d)).toEqual({
      category: "misc", name: "Groceries", plannedStart: isoOf("17:00"), plannedEnd: isoOf("17:30"), actualStart: null, actualEnd: null, notes: "",
    });
  });

  it("keeps a stored misc activity misc", () => {
    const misc: Activity = { ...stored, category: "misc", categoryId: 7, name: "Drive" };
    expect(toCreateRequest(draftFromActivity(misc)).category).toBe("misc");
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

describe("repeat", () => {
  // Saturday 14 Nov 2026, 09:00 local
  const fresh = () => ({ ...newDraft("workout", new Date(2026, 10, 14, 9, 0)), name: "Gym" });

  it("starts as not repeating, ready to repeat weekly on the start's weekday for a month", () => {
    const d = fresh();
    expect(d.repeat).toEqual({ frequency: "none", every: "1", weekdays: [6], until: "2026-12-14" });
    expect(repeatRuleOf(d)).toBeNull();
    expect(toCreateSeriesRequest(d)).toBeNull();
    expect(previewOccurrences(d)).toBeNull();
  });

  it("previews the dates the API will create and builds the series request", () => {
    const d = { ...fresh(), repeat: { frequency: "weekly" as const, every: "1", weekdays: [7, 6] as (6 | 7)[], until: "2026-11-22" } };
    expect(previewOccurrences(d)).toEqual(["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"]);
    const req = toCreateSeriesRequest(d);
    expect(req).toMatchObject({ category: "workout", name: "Gym", repeat: { frequency: "weekly", every: 1, weekdays: [6, 7], until: "2026-11-22" } });
    expect(typeof req?.repeat.timeZone).toBe("string");
    // Daily sends no weekdays.
    expect(repeatRuleOf({ ...d, repeat: { ...d.repeat, frequency: "daily" } })?.weekdays).toBeNull();
  });

  it("validates the rule like the API", () => {
    const d = fresh();
    const withRepeat = (r: Partial<typeof d.repeat>) => validateDraft({ ...d, repeat: { ...d.repeat, frequency: "weekly", ...r } }).repeat;
    expect(withRepeat({})).toBeUndefined();
    expect(withRepeat({ until: "2026-12-15" })).toMatch(/one month/);
    expect(withRepeat({ weekdays: [] })).toMatch(/at least one/);
    expect(withRepeat({ weekdays: [1] })).toMatch(/first occurrence/);
    expect(withRepeat({ every: "" })).toMatch(/1 to 30/);
    expect(withRepeat({ every: "0" })).toMatch(/1 to 30/);
    expect(previewOccurrences({ ...d, repeat: { ...d.repeat, frequency: "weekly", weekdays: [1] } })).toBeNull();
    // Not repeating is never a repeat error.
    expect(validateDraft({ ...d, repeat: { ...d.repeat, until: "" } }).repeat).toBeUndefined();
  });
});
