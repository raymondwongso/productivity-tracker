import { describe, expect, it } from "vitest";
import {
  addDays,
  formatHm,
  fromLocalInput,
  monthGrid,
  parseDateKey,
  startOfWeek,
  stepAnchor,
  toDateKey,
  toLocalInput,
  viewRange,
  viewTitle,
} from "./dates";

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

describe("weeks run Monday to Sunday", () => {
  it("finds the Monday for any day, including Sunday", () => {
    expect(toDateKey(startOfWeek(d(2026, 11, 14)))).toBe("2026-11-09"); // Saturday
    expect(toDateKey(startOfWeek(d(2026, 11, 15)))).toBe("2026-11-09"); // Sunday
    expect(toDateKey(startOfWeek(d(2026, 11, 9)))).toBe("2026-11-09"); // Monday
  });

  it("gives each view its range", () => {
    const anchor = d(2026, 11, 14, 15, 30);
    expect(viewRange("day", anchor)).toEqual({ from: d(2026, 11, 14), to: d(2026, 11, 15) });
    expect(viewRange("week", anchor)).toEqual({ from: d(2026, 11, 9), to: d(2026, 11, 16) });
    expect(viewRange("month", anchor)).toEqual({ from: d(2026, 10, 26), to: d(2026, 12, 7) });
  });

  it("builds whole-week month grids", () => {
    const g = monthGrid(d(2026, 2, 10)); // Feb 2026 starts on a Sunday
    expect(toDateKey(g.start)).toBe("2026-01-26");
    expect(toDateKey(g.end)).toBe("2026-03-02");
    expect((g.end.getTime() - g.start.getTime()) / 86_400_000 % 7).toBe(0);
  });
});

describe("navigation and titles", () => {
  it("steps by a day, a week, or to the 1st of the next month", () => {
    expect(toDateKey(stepAnchor("day", d(2026, 11, 30), 1))).toBe("2026-12-01");
    expect(toDateKey(stepAnchor("week", d(2026, 11, 14), -1))).toBe("2026-11-07");
    expect(toDateKey(stepAnchor("month", d(2026, 1, 31), 1))).toBe("2026-02-01");
  });

  it("formats headings", () => {
    expect(viewTitle("week", d(2026, 11, 14))).toBe("Nov 9 – 15, 2026");
    expect(viewTitle("week", d(2026, 10, 28))).toBe("Oct 26 – Nov 1, 2026");
    expect(viewTitle("day", d(2026, 11, 14))).toBe("Saturday, Nov 14, 2026");
    expect(viewTitle("month", d(2026, 11, 14))).toBe("November 2026");
  });
});

describe("conversions", () => {
  it("round-trips datetime-local values", () => {
    const t = d(2026, 11, 14, 7, 5);
    expect(toLocalInput(t)).toBe("2026-11-14T07:05");
    expect(fromLocalInput("2026-11-14T07:05")).toEqual(t);
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });

  it("formats times and parses date keys", () => {
    expect(formatHm(d(2026, 1, 1, 23, 9))).toBe("23:09");
    expect(formatHm(null)).toBe("--:--");
    expect(parseDateKey("2026-11-14")).toEqual(d(2026, 11, 14));
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("junk")).toBeNull();
    expect(toDateKey(addDays(d(2026, 12, 31), 1))).toBe("2027-01-01");
  });
});
