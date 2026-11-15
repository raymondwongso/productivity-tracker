import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRepeatRule, isoWeekday, latestRepeatUntil, occurrenceDates, type RepeatRule } from "@productivitytracker/shared";
import { AppError } from "../errors.js";
import { assertTimeZone, placeSlot, slotOf, toLocal, zonedToUtc } from "./recurrence.js";

const daily = (every: number, until: string): RepeatRule => ({ frequency: "daily", every, weekdays: null, until });
const weekly = (every: number, weekdays: RepeatRule["weekdays"], until: string): RepeatRule => ({ frequency: "weekly", every, weekdays, until });
const HOUR = 60 * 60_000;

test("isoWeekday counts Monday as 1 and Sunday as 7", () => {
  assert.equal(isoWeekday("2026-11-16"), 1);
  assert.equal(isoWeekday("2026-11-15"), 7);
});

test("daily series: every day, or every N days, up to and including the end date", () => {
  assert.deepEqual(occurrenceDates("2026-11-16", daily(1, "2026-11-19")), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
  assert.deepEqual(occurrenceDates("2026-11-16", daily(2, "2026-11-21")), ["2026-11-16", "2026-11-18", "2026-11-20"]);
  assert.deepEqual(occurrenceDates("2026-11-16", daily(1, "2026-11-16")), ["2026-11-16"]);
});

test("weekly series: chosen weekdays, every N weeks counted from the first week's Monday", () => {
  // Mon/Wed/Fri from Monday 16 Nov
  assert.deepEqual(occurrenceDates("2026-11-16", weekly(1, [1, 3, 5], "2026-11-27")), [
    "2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23", "2026-11-25", "2026-11-27",
  ]);
  // Every other week, starting mid-week on a Wednesday: the rest of that week counts as week 0.
  assert.deepEqual(occurrenceDates("2026-11-18", weekly(2, [3, 5], "2026-12-11")), [
    "2026-11-18", "2026-11-20", "2026-12-02", "2026-12-04",
  ]);
});

test("a series runs for at most one calendar month, clamped at a shorter month's end", () => {
  assert.equal(latestRepeatUntil("2026-11-15"), "2026-12-15");
  assert.equal(latestRepeatUntil("2026-01-31"), "2026-02-28");
  assert.equal(latestRepeatUntil("2028-01-31"), "2028-02-29");
  assert.equal(checkRepeatRule("2026-11-15", daily(1, "2026-12-15")), null);
  assert.match(checkRepeatRule("2026-11-15", daily(1, "2026-12-16")) ?? "", /one month/);
  assert.equal(occurrenceDates("2026-11-15", daily(1, "2026-12-15")).length, 31);
});

test("checkRepeatRule explains every invalid rule", () => {
  const start = "2026-11-16"; // a Monday
  assert.match(checkRepeatRule("2026-02-30", daily(1, "2026-03-01")) ?? "", /valid date/);
  assert.match(checkRepeatRule(start, daily(1, "soon")) ?? "", /ends on/);
  assert.match(checkRepeatRule(start, daily(0, "2026-11-20")) ?? "", /1 to 30 days/);
  assert.match(checkRepeatRule(start, weekly(31, [1], "2026-11-20")) ?? "", /1 to 30 weeks/);
  assert.match(checkRepeatRule(start, daily(1.5, "2026-11-20")) ?? "", /1 to 30/);
  assert.match(checkRepeatRule(start, { ...daily(1, "2026-11-20"), weekdays: [1] }) ?? "", /weekly/);
  assert.match(checkRepeatRule(start, weekly(1, [], "2026-11-20")) ?? "", /at least one/);
  assert.match(checkRepeatRule(start, weekly(1, null, "2026-11-20")) ?? "", /at least one/);
  assert.match(checkRepeatRule(start, weekly(1, [1, 1], "2026-11-20")) ?? "", /distinct/);
  assert.match(checkRepeatRule(start, weekly(1, [3, 5], "2026-11-20")) ?? "", /first occurrence must fall/);
  assert.match(checkRepeatRule(start, daily(1, "2026-11-15")) ?? "", /before its first/);
  assert.equal(checkRepeatRule(start, weekly(1, [1, 3], "2026-11-20")), null);
});

test("zonedToUtc keeps the local time across a DST change", () => {
  // Europe/Berlin leaves summer time on 25 Oct 2026: 07:00 is 05:00Z before, 06:00Z after.
  assert.equal(zonedToUtc("2026-10-20", 7 * HOUR, "Europe/Berlin").toISOString(), "2026-10-20T05:00:00.000Z");
  assert.equal(zonedToUtc("2026-10-27", 7 * HOUR, "Europe/Berlin").toISOString(), "2026-10-27T06:00:00.000Z");
  // A wall time skipped by the spring change lands after the gap: 02:30 → 03:30 CEST.
  assert.equal(zonedToUtc("2027-03-28", 2.5 * HOUR, "Europe/Berlin").toISOString(), "2027-03-28T01:30:00.000Z");
  assert.equal(zonedToUtc("2026-11-16", 6.5 * HOUR, "UTC").toISOString(), "2026-11-16T06:30:00.000Z");
});

test("toLocal reads the date and time of day in the zone", () => {
  assert.deepEqual(toLocal(new Date("2026-11-15T23:30:00Z"), "Asia/Jakarta"), { date: "2026-11-16", msOfDay: 6.5 * HOUR });
});

test("a slot past midnight is placed on another date with the same local times", () => {
  // Sleep 23:00 → 07:00 in Berlin on 20 Oct (summer time)...
  const { date, slot } = slotOf(new Date("2026-10-20T21:00:00Z"), new Date("2026-10-21T05:00:00Z"), "Europe/Berlin");
  assert.equal(date, "2026-10-20");
  assert.deepEqual(slot, { startMs: 23 * HOUR, endDayOffset: 1, endMs: 7 * HOUR });
  // ...on the night the clocks go back it still runs 23:00 → 07:00 local, nine real hours.
  const p = placeSlot("2026-10-24", slot, "Europe/Berlin");
  assert.equal(p.plannedStart.toISOString(), "2026-10-24T21:00:00.000Z");
  assert.equal(p.plannedEnd.toISOString(), "2026-10-25T06:00:00.000Z");
});

test("an unknown time zone is a 400", () => {
  assert.throws(() => assertTimeZone("Mars/Olympus"), (e: unknown) => e instanceof AppError && e.statusCode === 400);
  assertTimeZone("America/New_York");
});
