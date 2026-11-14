import { describe, expect, it } from "vitest";
import { toDateKey } from "@/lib/dates";
import { clampRange, dayCount, daysOf, MAX_RANGE_DAYS, presetRange, rangeFromParams, rangeToQuery } from "./range";

// Sunday, Nov 15 2026
const TODAY = new Date(2026, 10, 15);
const keys = (r: { from: Date; to: Date }) => [toDateKey(r.from), toDateKey(r.to)];
const params = (q: string) => new URLSearchParams(q);

describe("tracker ranges", () => {
  it("resolves every preset around today", () => {
    expect(keys(presetRange("week", TODAY))).toEqual(["2026-11-09", "2026-11-15"]);
    expect(keys(presetRange("month", TODAY))).toEqual(["2026-11-01", "2026-11-30"]);
    expect(keys(presetRange("7d", TODAY))).toEqual(["2026-11-09", "2026-11-15"]);
    expect(keys(presetRange("30d", TODAY))).toEqual(["2026-10-17", "2026-11-15"]);
    expect(keys(presetRange("90d", TODAY))).toEqual(["2026-08-18", "2026-11-15"]);
    expect(dayCount(...(Object.values(presetRange("90d", TODAY)) as [Date, Date]))).toBe(90);
  });

  it("reads the range from the URL, defaulting to this month", () => {
    const fallback = rangeFromParams(params(""), TODAY);
    expect([fallback.preset, ...keys(fallback)]).toEqual(["month", "2026-11-01", "2026-11-30"]);
    expect(rangeFromParams(params("range=nope"), TODAY)).toMatchObject({ preset: "month" });
    expect(rangeFromParams(params("from=2026-10-01"), TODAY)).toMatchObject({ preset: "month" });
    expect(rangeFromParams(params("range=30d"), TODAY)).toMatchObject({ preset: "30d" });
    const month = rangeFromParams(params("range=month"), TODAY);
    expect([month.preset, ...keys(month)]).toEqual(["month", "2026-11-01", "2026-11-30"]);
    const custom = rangeFromParams(params("from=2026-10-01&to=2026-10-31"), TODAY);
    expect([custom.preset, ...keys(custom)]).toEqual(["custom", "2026-10-01", "2026-10-31"]);
    // A reversed or overlong custom range is put right, not rejected.
    expect(keys(rangeFromParams(params("from=2026-10-31&to=2026-10-01"), TODAY))).toEqual(["2026-10-01", "2026-10-31"]);
    expect(dayCount(...(Object.values(keys(rangeFromParams(params("from=2026-01-01&to=2026-12-31"), TODAY)).map((k) => new Date(k))) as [Date, Date]))).toBe(MAX_RANGE_DAYS);
  });

  it("writes presets and custom ranges back to the URL", () => {
    expect(rangeToQuery({ preset: "week", ...presetRange("week", TODAY) })).toBe("range=week");
    // The default needs no query, so a plain link (and a cleared URL) opens on it.
    expect(rangeToQuery({ preset: "month", ...presetRange("month", TODAY) })).toBe("");
    expect(rangeToQuery({ preset: "custom", from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) })).toBe("from=2026-10-01&to=2026-10-31");
  });

  it("caps a custom range at 92 days, keeping the end the user moved", () => {
    const a = new Date(2026, 0, 1);
    const b = new Date(2026, 11, 31);
    const movedFrom = clampRange(a, b, "from");
    expect([...keys(movedFrom), movedFrom.clamped]).toEqual(["2026-01-01", "2026-04-02", true]);
    const movedTo = clampRange(a, b, "to");
    expect([...keys(movedTo), movedTo.clamped]).toEqual(["2026-10-01", "2026-12-31", true]);
    expect(clampRange(new Date(2026, 10, 1), new Date(2026, 10, 15), "to").clamped).toBe(false);
  });

  it("lists every day, across a month and a DST change", () => {
    expect(daysOf(new Date(2026, 9, 30), new Date(2026, 10, 2)).map(toDateKey)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(dayCount(new Date(2026, 2, 1), new Date(2026, 2, 31))).toBe(31);
  });
});
