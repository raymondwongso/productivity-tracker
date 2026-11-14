import type { StatsQuery } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";

/** One column a day stays readable up to about three months. */
export const MAX_STATS_DAYS = 92;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60_000;

export interface StatsRange {
  /** Inclusive local dates, YYYY-MM-DD. */
  from: string;
  to: string;
  tz: string;
  /** Every date from `from` to `to`. */
  days: string[];
  /** Days in the range up to today in `tz`: what per-day averages divide by. */
  averagedDays: number;
}

function parseDate(value: string, label: string): number {
  const m = DATE_RE.exec(value);
  if (!m) throw badRequest(`"${label}" must be a date like 2026-11-15`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date.UTC rolls 2026-02-30 over to March; a real date round-trips.
  if (new Date(ms).toISOString().slice(0, 10) !== value) throw badRequest(`"${label}" is not a real date`);
  return ms;
}

/** Today's date in `tz`, YYYY-MM-DD. Throws a 400 for an unknown zone. */
export function todayIn(tz: string, now: Date): string {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    throw badRequest(`Unknown time zone "${tz}"`);
  }
  return fmt.format(now);
}

export function parseStatsRange(q: StatsQuery, now: Date = new Date()): StatsRange {
  const from = parseDate(q.from, "from");
  const to = parseDate(q.to, "to");
  if (to < from) throw badRequest('"to" can\'t be before "from"');
  const count = Math.round((to - from) / DAY_MS) + 1;
  if (count > MAX_STATS_DAYS) throw badRequest(`The range can be at most ${MAX_STATS_DAYS} days`);
  const today = todayIn(q.tz, now);
  const days = Array.from({ length: count }, (_, i) => new Date(from + i * DAY_MS).toISOString().slice(0, 10));
  return { from: q.from, to: q.to, tz: q.tz, days, averagedDays: days.filter((d) => d <= today).length };
}
