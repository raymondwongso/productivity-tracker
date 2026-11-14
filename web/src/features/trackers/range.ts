import { addDays, parseDateKey, startOfDay, startOfMonth, startOfWeek, toDateKey } from "@/lib/dates";

/** Date ranges of the tracker pages: inclusive local days, at most 92 of them. */

export type RangePreset = "week" | "month" | "7d" | "30d" | "90d" | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

/** Every tracker opens on this month: on Nov 15, Nov 1 – 30 (averages still stop at today). */
export const DEFAULT_PRESET: Exclude<RangePreset, "custom"> = "month";
export const MAX_RANGE_DAYS = 92;

export interface TrackerRange {
  preset: RangePreset;
  /** Local midnights, both inclusive. */
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60_000;
/** Days from `from` to `to`, both included. Rounds so a DST change doesn't lose or gain a day. */
export const dayCount = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) + 1;

export function presetRange(preset: Exclude<RangePreset, "custom">, today: Date): { from: Date; to: Date } {
  const t = startOfDay(today);
  switch (preset) {
    case "week":
      return { from: startOfWeek(t), to: addDays(startOfWeek(t), 6) };
    case "month":
      return { from: startOfMonth(t), to: new Date(t.getFullYear(), t.getMonth() + 1, 0) };
    case "7d":
      return { from: addDays(t, -6), to: t };
    case "30d":
      return { from: addDays(t, -29), to: t };
    case "90d":
      return { from: addDays(t, -89), to: t };
  }
}

/**
 * A custom range, put in order and cut to MAX_RANGE_DAYS. The end the user just moved stays put
 * and the other end follows.
 */
export function clampRange(a: Date, b: Date, moved: "from" | "to"): { from: Date; to: Date; clamped: boolean } {
  let [from, to] = a <= b ? [startOfDay(a), startOfDay(b)] : [startOfDay(b), startOfDay(a)];
  if (dayCount(from, to) <= MAX_RANGE_DAYS) return { from, to, clamped: false };
  if (moved === "from") to = addDays(from, MAX_RANGE_DAYS - 1);
  else from = addDays(to, -(MAX_RANGE_DAYS - 1));
  return { from, to, clamped: true };
}

interface Params {
  get(key: string): string | null;
}

/** `?range=30d`, or `?from=2026-10-01&to=2026-10-31` for a custom range; anything else is the default, this month. */
export function rangeFromParams(params: Params, today: Date): TrackerRange {
  const preset = RANGE_PRESETS.find((p) => p.value === params.get("range"))?.value;
  if (preset && preset !== "custom") return { preset, ...presetRange(preset, today) };
  const from = parseDateKey(params.get("from"));
  const to = parseDateKey(params.get("to"));
  if (from && to) {
    const r = clampRange(from, to, "from");
    return { preset: "custom", from: r.from, to: r.to };
  }
  return { preset: DEFAULT_PRESET, ...presetRange(DEFAULT_PRESET, today) };
}

/** The URL query for a range. The default preset has none, so a plain link always lands on it. */
export function rangeToQuery(r: TrackerRange): string {
  if (r.preset === DEFAULT_PRESET) return "";
  const q: Record<string, string> = r.preset === "custom" ? { from: toDateKey(r.from), to: toDateKey(r.to) } : { range: r.preset };
  return new URLSearchParams(q).toString();
}

export const presetLabel = (p: RangePreset) => RANGE_PRESETS.find((x) => x.value === p)!.label;

/** Every day of the range, as local midnights. */
export function daysOf(from: Date, to: Date): Date[] {
  return Array.from({ length: dayCount(from, to) }, (_, i) => addDays(from, i));
}

/** The browser's IANA time zone, which the API buckets days by. */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
