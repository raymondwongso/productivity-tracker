import { describe, expect, it } from "vitest";
import { averagedOver, formatDuration, formatHours, formatKcal, formatSignedKcal, perDay, plural, tickHours, tickKcal } from "./format";
import { daysOf } from "./range";

describe("tracker formatting", () => {
  it("formats durations, hours and calories", () => {
    expect(formatDuration(450)).toBe("7 h 30 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(45.4)).toBe("45 min");
    expect(formatHours(90)).toBe("1.5 h");
    expect(formatHours(660)).toBe("11 h");
    expect(formatKcal(1234.6)).toBe("1,235 kcal");
    expect(formatSignedKcal(-250)).toBe("−250 kcal");
    expect(formatSignedKcal(1163)).toBe("+1,163 kcal");
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(15, "day")).toBe("15 days");
    expect(tickKcal(1500)).toBe("1.5k");
    expect(tickHours(90)).toBe("1.5 h");
  });

  it("averages over the days up to today and says which", () => {
    // This month on Nov 15: 30 days in the range, 15 of them so far.
    const days = daysOf(new Date(2026, 10, 1), new Date(2026, 10, 30));
    expect(perDay(30_000, 15)).toBe(2000);
    expect(averagedOver(days, 15)).toBe("average over 15 days, Nov 1 – Nov 15");
    expect(perDay(500, 0)).toBe(0);
    expect(averagedOver(days, 0)).toBe("no days up to today yet");
  });
});
