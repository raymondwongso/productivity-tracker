import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActivityLabel } from "@productivitytracker/shared";
import { AppError } from "../errors.js";
import type { StatsActivity } from "../repositories/postgres/stats.repository.js";
import { GetSleepStatsService } from "../services/get-sleep-stats.service.js";
import { buildCinemaStats, buildFitnessStats, buildSleepStats, buildTimeStats } from "./stats.js";
import { MAX_STATS_DAYS, parseStatsRange, todayIn } from "./stats-range.js";

const NOW = new Date("2026-11-15T12:00:00Z");
const at = (s: string) => new Date(`2026-11-${s}:00Z`);
let nextId = 1;
function row(date: string, p: [string, string], a: [string, string] | [string] | [] = [], o: Partial<StatsActivity> = {}): StatsActivity {
  return {
    id: nextId++, date, plannedStart: at(p[0]), plannedEnd: at(p[1]),
    actualStart: a[0] ? at(a[0]) : null, actualEnd: a[1] ? at(a[1]) : null,
    cancelled: false, labels: (a[0] ? (a[1] ? ["done"] : []) : ["pending"]) as ActivityLabel[],
    focus: null, caloriesBurned: null, totalCalories: null, refId: null, refName: null, refKind: null, ...o,
  };
}
const range = (from: string, to: string) => parseStatsRange({ from, to, tz: "UTC" }, NOW);
const is400 = (re: RegExp) => (e: unknown) => e instanceof AppError && e.statusCode === 400 && re.test(e.message);

test("the range lists every day and averages over the days up to today", () => {
  const month = range("2026-11-01", "2026-11-30");
  assert.equal(month.days.length, 30);
  assert.equal(month.days[0], "2026-11-01");
  assert.equal(month.days[29], "2026-11-30");
  // On Nov 15, "this month" averages Nov 1-15, not 1-30.
  assert.equal(month.averagedDays, 15);
  assert.equal(range("2026-11-09", "2026-11-15").averagedDays, 7);
  assert.equal(range("2026-11-16", "2026-11-22").averagedDays, 0);
  // Feb in a leap-free year, and a span across months.
  assert.equal(range("2026-02-27", "2026-03-02").days.join(","), "2026-02-27,2026-02-28,2026-03-01,2026-03-02");
});

test("today follows the requested time zone", () => {
  // 12:00 UTC on Nov 15 is already Nov 16 in Kiritimati (UTC+14) and still Nov 15 in Honolulu.
  assert.equal(todayIn("Pacific/Kiritimati", NOW), "2026-11-16");
  assert.equal(todayIn("Pacific/Honolulu", NOW), "2026-11-15");
  assert.equal(parseStatsRange({ from: "2026-11-01", to: "2026-11-30", tz: "Pacific/Kiritimati" }, NOW).averagedDays, 16);
});

test("the range rejects bad dates, reversed and too-long ranges, and unknown zones", () => {
  assert.throws(() => range("2026-11-1", "2026-11-15"), is400(/date like/));
  assert.throws(() => range("2026-02-30", "2026-03-15"), is400(/real date/));
  assert.throws(() => range("2026-11-15", "2026-11-01"), is400(/before/));
  assert.throws(() => range("2026-01-01", "2026-04-30"), is400(new RegExp(`${MAX_STATS_DAYS} days`)));
  assert.doesNotThrow(() => range("2026-08-16", "2026-11-15"));
  assert.throws(() => parseStatsRange({ from: "2026-11-01", to: "2026-11-02", tz: "Mars/Olympus" }, NOW), is400(/time zone/));
});

test("sleep: labels per day, slept minutes on the starting day, time lost on labelled sleeps only", () => {
  const r = range("2026-11-10", "2026-11-14");
  const rows = [
    // on time, crosses midnight: 7h30 counted on the 10th
    row("2026-11-10", ["10T23:00", "11T06:30"], ["10T23:00", "11T06:30"]),
    // 20 min late and 40 min early: late + premature
    row("2026-11-11", ["11T23:00", "12T06:30"], ["11T23:20", "12T05:50"], { labels: ["late", "premature"] }),
    // overslept 30 min; 5 min late is inside the grace, so not late and nothing lost
    row("2026-11-12", ["12T23:00", "13T06:30"], ["12T23:05", "13T07:00"], { labels: ["overrun"] }),
    // never logged
    row("2026-11-13", ["13T23:00", "14T06:30"]),
    // cancelled: ignored
    row("2026-11-14", ["14T23:00", "15T06:30"], ["14T23:00", "15T06:30"], { cancelled: true, labels: ["cancelled"] }),
  ];
  const s = buildSleepStats(r, rows, NOW);
  assert.deepEqual(s.days.map((d) => d.labels.join("+")), ["done", "late+premature", "overrun", "", ""]);
  assert.deepEqual(s.days.map((d) => d.sleptMinutes), [450, 390, 475, 0, 0]);
  assert.deepEqual(s.days.map((d) => [d.lateMinutes, d.prematureMinutes]), [[0, 0], [20, 40], [0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(s.days.map((d) => d.onSchedule), [true, false, false, false, false]);
  assert.deepEqual(s.days.map((d) => d.unlogged), [false, false, false, true, false]);
  assert.equal(s.days[4]!.main, null);
  assert.deepEqual(s.summary, {
    trackedDays: 3, onScheduleDays: 1, lateDays: 1, prematureDays: 1, overrunDays: 1,
    sleptMinutes: 1315, lateMinutes: 20, prematureMinutes: 40, unloggedDays: 1, averagedDays: 5,
  });
});

test("sleep: a day with a nap draws its longest sleep and adds both durations", () => {
  const r = range("2026-11-10", "2026-11-10");
  const nap = row("2026-11-10", ["10T13:00", "10T13:30"], ["10T13:00", "10T13:30"]);
  const night = row("2026-11-10", ["10T23:00", "11T06:30"], ["10T23:00", "11T06:30"]);
  const s = buildSleepStats(r, [nap, night], NOW);
  assert.equal(s.days[0]!.main?.activityId, night.id);
  assert.equal(s.days[0]!.sleptMinutes, 480);
});

test("fitness: finished workouts and meals per day, focus split, diet net", () => {
  const r = range("2026-11-13", "2026-11-14");
  const workouts = [
    row("2026-11-13", ["13T17:45", "13T18:45"], ["13T17:45", "13T18:45"], { focus: "strength", caloriesBurned: 300 }),
    row("2026-11-14", ["14T07:00", "14T08:00"], ["14T07:00", "14T07:40"], { focus: "cardio", caloriesBurned: 250, labels: ["premature"] }),
    row("2026-11-14", ["14T17:00", "14T17:30"], ["14T17:00", "14T17:30"], { focus: "cardio", caloriesBurned: null }),
    row("2026-11-14", ["14T19:00", "14T20:00"], [], { focus: "yoga", caloriesBurned: 200 }), // not finished
  ];
  const meals = [
    row("2026-11-13", ["13T12:00", "13T12:45"], ["13T12:00", "13T12:45"], { totalCalories: 650 }),
    row("2026-11-14", ["14T12:00", "14T12:45"], ["14T12:00", "14T12:45"], { totalCalories: 500 }),
    row("2026-11-14", ["14T19:00", "14T19:45"], ["14T19:00", "14T19:45"], { cancelled: true, totalCalories: 900, labels: ["cancelled"] }),
  ];
  const s = buildFitnessStats(r, workouts, meals, NOW);
  assert.equal(s.averagedDays, 2);
  assert.deepEqual([s.workout.sessions, s.workout.minutes, s.workout.caloriesBurned, s.workout.notCounted], [3, 130, 550, 1]);
  assert.deepEqual(s.workout.focus, [
    { focus: "cardio", sessions: 2, minutes: 70 },
    { focus: "strength", sessions: 1, minutes: 60 },
  ]);
  assert.deepEqual(s.workout.days, [
    { date: "2026-11-13", minutes: 60, caloriesBurned: 300 },
    { date: "2026-11-14", minutes: 70, caloriesBurned: 250 },
  ]);
  assert.deepEqual([s.meals.meals, s.meals.calories, s.meals.notCounted], [2, 1150, 0]);
  assert.deepEqual(s.diet.days, [
    { date: "2026-11-13", consumed: 650, burned: 300, net: 350 },
    { date: "2026-11-14", consumed: 500, burned: 250, net: 250 },
  ]);
});

test("time stats: minutes by reference, largest first, with a name for none; cinema adds the kind", () => {
  const r = range("2026-11-13", "2026-11-14");
  const rows = [
    row("2026-11-13", ["13T09:00", "13T12:00"], ["13T09:00", "13T12:00"], { refId: 1, refName: "Website", refKind: "series" }),
    row("2026-11-14", ["14T09:00", "14T10:00"], ["14T09:00", "14T10:30"], { refId: 2, refName: "Q4", refKind: "movie", labels: ["overrun"] }),
    row("2026-11-14", ["14T13:00", "14T14:00"], ["14T13:00", "14T14:00"]),
    row("2026-11-14", ["14T15:00", "14T16:00"], ["14T15:05"]), // in progress: not counted, not "not counted" either
  ];
  const w = buildTimeStats(r, rows, NOW, "No project");
  assert.deepEqual(w.parts, [
    { id: 1, name: "Website", minutes: 180, sessions: 1 },
    { id: 2, name: "Q4", minutes: 90, sessions: 1 },
    { id: null, name: "No project", minutes: 60, sessions: 1 },
  ]);
  assert.deepEqual(w.days, [{ date: "2026-11-13", minutes: 180 }, { date: "2026-11-14", minutes: 150 }]);
  assert.deepEqual([w.minutes, w.sessions, w.notCounted], [330, 3, 1]);
  const c = buildCinemaStats(r, rows, NOW);
  assert.deepEqual(c.parts.map((p) => [p.name, p.kind]), [["Website", "series"], ["Q4", "movie"], ["No title", null]]);
});

test("the sleep stats service asks for sleep in the parsed range and zone", async () => {
  const calls: unknown[][] = [];
  const svc = new GetSleepStatsService({ listForStats: async (...args) => { calls.push(args); return []; } }, () => NOW);
  const s = await svc.execute(7, { from: "2026-11-01", to: "2026-11-30", tz: "Asia/Jakarta" });
  assert.deepEqual(calls, [[7, "sleep", "2026-11-01", "2026-11-30", "Asia/Jakarta"]]);
  assert.equal(s.days.length, 30);
  assert.equal(s.summary.averagedDays, 15);
  await assert.rejects(svc.execute(7, { from: "2026-11-30", to: "2026-11-01", tz: "UTC" }), is400(/before/));
});
