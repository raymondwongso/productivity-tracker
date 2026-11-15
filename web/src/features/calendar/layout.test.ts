import type { Activity } from "@productivitytracker/shared";
import { describe, expect, it } from "vitest";
import { cardBox, fitBox, segmentsForDay } from "./layout";

let id = 0;
const local = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 10, day, h, m).toISOString();
};
const act = (day: number, s: string, e: string, endDay = day): Activity => ({
  id: ++id, category: "sleep", categoryId: 1, name: `a${id}`, plannedStart: local(day, s), plannedEnd: local(endDay, e),
  actualStart: null, actualEnd: null, notes: "", cancelledAt: null, labels: ["pending"], seriesId: null, createdAt: "", updatedAt: "",
});
const nov = (day: number) => new Date(2026, 10, day);

describe("segmentsForDay", () => {
  it("splits an activity that crosses midnight into one piece per day", () => {
    const night = act(14, "23:00", "06:30", 15);
    const sat = segmentsForDay([night], nov(14));
    const sun = segmentsForDay([night], nov(15));
    expect(sat).toMatchObject([{ start: 23 * 60, end: 24 * 60, continuesBefore: false, continuesAfter: true }]);
    expect(sun).toMatchObject([{ start: 0, end: 6.5 * 60, continuesBefore: true, continuesAfter: false }]);
    expect(segmentsForDay([night], nov(16))).toEqual([]);
  });

  it("puts overlapping activities side by side and leaves the rest full width", () => {
    const deep = act(10, "09:00", "12:00");
    const standup = act(10, "10:30", "11:00");
    const lunch = act(10, "12:00", "12:45");
    const segs = segmentsForDay([lunch, standup, deep], nov(10));
    const by = (a: Activity) => segs.find((s) => s.activity.id === a.id)!;
    expect([by(deep).col, by(deep).cols]).toEqual([0, 2]);
    expect([by(standup).col, by(standup).cols]).toEqual([1, 2]);
    expect([by(lunch).col, by(lunch).cols]).toEqual([0, 1]); // touching is not overlapping
  });

  it("reuses a freed column inside one cluster", () => {
    const a = act(11, "09:00", "11:00");
    const b = act(11, "09:30", "10:00");
    const c = act(11, "10:00", "10:30");
    const segs = segmentsForDay([a, b, c], nov(11));
    expect(segs.map((s) => [s.col, s.cols])).toEqual([[0, 2], [1, 2], [1, 2]]);
  });
});

describe("cardBox", () => {
  it("places a card by planned time and splits the width by columns", () => {
    const [s] = segmentsForDay([act(12, "09:00", "10:30")], nov(12));
    expect(cardBox({ ...s!, col: 1, cols: 2 }, 80)).toEqual({ top: 721, height: 118, left: 50, width: 50, compact: false });
  });

  it("keeps short activities readable", () => {
    const [s] = segmentsForDay([act(12, "09:00", "09:10")], nov(12));
    const box = cardBox(s!, 80);
    expect(box.height).toBe(20);
    expect(box.compact).toBe(true);
  });
});

describe("fitBox", () => {
  it("places a segment as percentages of the whole day", () => {
    const [s] = segmentsForDay([act(12, "09:00", "10:30")], nov(12));
    expect(fitBox(s!)).toEqual({ top: 37.5, height: 6.25, left: 0, width: 100 });
  });

  it("puts overlapping segments side by side", () => {
    const deep = act(13, "09:00", "12:00");
    const standup = act(13, "10:30", "11:00");
    const segs = segmentsForDay([deep, standup], nov(13));
    expect(segs.map((s) => [fitBox(s).left, fitBox(s).width])).toEqual([[0, 50], [50, 50]]);
  });

  it("starts the next-day piece of a night at the top", () => {
    const night = act(14, "23:00", "06:00", 15);
    const [sat] = segmentsForDay([night], nov(14));
    const [sun] = segmentsForDay([night], nov(15));
    expect(fitBox(sat!)).toMatchObject({ top: (23 / 24) * 100, height: (1 / 24) * 100 });
    expect(fitBox(sun!)).toMatchObject({ top: 0, height: 25 });
  });
});
