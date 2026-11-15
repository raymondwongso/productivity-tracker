import type { RepeatRule, Weekday } from "./index.js";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60_000;
/** Largest "every N days/weeks". */
export const MAX_REPEAT_EVERY = 30;

/** `YYYY-MM-DD` → UTC midnight in ms; null when malformed or not a real date. */
function parseDate(s: string): number | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === s ? ms : null;
}

const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** ISO weekday of a `YYYY-MM-DD` date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): Weekday {
  const ms = parseDate(date);
  if (ms === null) throw new RangeError(`Not a date: ${date}`);
  return (((new Date(ms).getUTCDay() + 6) % 7) + 1) as Weekday;
}

/**
 * The last end date a series starting on `startsOn` may have: one calendar month later,
 * clamped to the end of a shorter month (31 Jan → 28 Feb), as Postgres' `date + interval '1 month'`.
 */
export function latestRepeatUntil(startsOn: string): string {
  const ms = parseDate(startsOn);
  if (ms === null) throw new RangeError(`Not a date: ${startsOn}`);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return formatDate(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
}

/**
 * Why a series starting on `startsOn` can't have this rule, or null when it can.
 * A series ends on a date at most one month after its first occurrence, and its first
 * occurrence must itself match the rule.
 */
export function checkRepeatRule(startsOn: string, rule: RepeatRule): string | null {
  const start = parseDate(startsOn);
  if (start === null) return "The first occurrence needs a valid date.";
  const until = parseDate(rule.until);
  if (until === null) return "Set the date the series ends on.";
  if (!Number.isInteger(rule.every) || rule.every < 1 || rule.every > MAX_REPEAT_EVERY) {
    return `Repeat every 1 to ${MAX_REPEAT_EVERY} ${rule.frequency === "daily" ? "days" : "weeks"}.`;
  }
  if (rule.frequency === "daily") {
    if (rule.weekdays !== null) return "Weekdays only apply to weekly series.";
  } else {
    const days = rule.weekdays ?? [];
    if (days.length === 0) return "Pick at least one weekday.";
    if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7) || new Set(days).size !== days.length) {
      return "Weekdays must be distinct days from Monday to Sunday.";
    }
    if (!days.includes(isoWeekday(startsOn))) return "The first occurrence must fall on one of the chosen weekdays.";
  }
  if (until < start) return "The series can't end before its first occurrence.";
  if (rule.until > latestRepeatUntil(startsOn)) return "A series can run for at most one month.";
  return null;
}

/**
 * The local dates of every occurrence, in order, starting with `startsOn`. Weekly intervals
 * count whole weeks from the Monday of the first occurrence's week. Assumes a valid rule
 * (see `checkRepeatRule`).
 */
export function occurrenceDates(startsOn: string, rule: RepeatRule): string[] {
  const start = parseDate(startsOn);
  const until = parseDate(rule.until);
  if (start === null || until === null || rule.every < 1) return [];
  const out: string[] = [];
  if (rule.frequency === "daily") {
    for (let d = start; d <= until; d += rule.every * DAY_MS) out.push(formatDate(d));
    return out;
  }
  const days = new Set(rule.weekdays ?? []);
  const weekStart = start - (isoWeekday(startsOn) - 1) * DAY_MS;
  for (let d = start; d <= until; d += DAY_MS) {
    const week = Math.floor((d - weekStart) / (7 * DAY_MS));
    const date = formatDate(d);
    if (week % rule.every === 0 && days.has(isoWeekday(date))) out.push(date);
  }
  return out;
}
