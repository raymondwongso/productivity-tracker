// computeLabels lives in shared/ (the web modal previews it live); the API stores its result.
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeLabels, type GracePeriods } from "@productivitytracker/shared";

const grace: GracePeriods = { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 };
const at = (hhmm: string) => new Date(`2026-11-14T${hhmm}:00Z`);
const planned = { plannedStart: at("09:00"), plannedEnd: at("10:00") };
const labels = (actualStart: string | null, actualEnd: string | null, cancelled = false, g = grace) =>
  computeLabels({ ...planned, actualStart: actualStart ? at(actualStart) : null, actualEnd: actualEnd ? at(actualEnd) : null, cancelled }, g);

test("each of the nine stored label sets", () => {
  assert.deepEqual(labels(null, null), ["pending"]);
  assert.deepEqual(labels("09:05", null), []);
  assert.deepEqual(labels("09:12", null), ["late"]);
  assert.deepEqual(labels("09:12", "10:05"), ["late"]);
  assert.deepEqual(labels("09:04", "10:06"), ["done"]);
  assert.deepEqual(labels("09:00", "09:35"), ["premature"]);
  assert.deepEqual(labels("09:00", "10:20"), ["overrun"]);
  assert.deepEqual(labels("09:20", "09:40"), ["late", "premature"]);
  assert.deepEqual(labels("09:15", "10:30"), ["late", "overrun"]);
  assert.deepEqual(labels("09:12", "10:30", true), ["cancelled"]);
});

test("grace boundaries are exclusive: exactly at the limit is still on time", () => {
  assert.deepEqual(labels("09:10", "10:00"), ["done"]);
  assert.deepEqual(labels("09:11", "10:00"), ["late"]);
  assert.deepEqual(labels("09:00", "09:45"), ["done"]);
  assert.deepEqual(labels("09:00", "09:44"), ["premature"]);
  assert.deepEqual(labels("09:00", "10:15"), ["done"]);
  assert.deepEqual(labels("09:00", "10:16"), ["overrun"]);
});

test("an activity that has not started stays pending, however overdue", () => {
  const overdue = computeLabels(
    { plannedStart: at("01:00"), plannedEnd: at("02:00"), actualStart: null, actualEnd: null, cancelled: false },
    grace,
  );
  assert.deepEqual(overdue, ["pending"]);
});

test("the grace periods passed in decide the result", () => {
  assert.deepEqual(labels("09:12", "10:00", false, { ...grace, lateMinutes: 20 }), ["done"]);
});
