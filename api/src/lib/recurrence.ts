import { badRequest } from "../errors.js";

const DAY_MS = 24 * 60 * 60_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** A cached formatter for `tz`. Throws a 400 for an unknown zone. */
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      throw badRequest(`Unknown time zone "${tz}"`);
    }
    formatters.set(tz, f);
  }
  return f;
}

export function assertTimeZone(tz: string): void {
  formatterFor(tz);
}

/** The wall-clock time in `tz` at `ms`, read as if it were UTC (to whole seconds). */
function wallClock(ms: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const part of formatterFor(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/** `tz`'s offset from UTC at instant `ms`, in ms (positive east of Greenwich). */
const offsetAt = (ms: number, tz: string) => wallClock(ms, tz) - Math.floor(ms / 1000) * 1000;

const dateMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDaysToDate = (date: string, n: number) => formatDate(dateMs(date) + n * DAY_MS);
export const daysBetween = (from: string, to: string) => Math.round((dateMs(to) - dateMs(from)) / DAY_MS);

/** The local date (YYYY-MM-DD) and time of day (ms after local midnight) of an instant in `tz`. */
export function toLocal(d: Date, tz: string): { date: string; msOfDay: number } {
  const ms = d.getTime();
  const wall = wallClock(ms, tz) + (ms - Math.floor(ms / 1000) * 1000);
  const date = formatDate(wall);
  return { date, msOfDay: wall - dateMs(date) };
}

/**
 * The instant at local `date` + `msOfDay` in `tz`. A wall time that a DST change skips lands
 * after the gap (02:30 on a spring-forward night becomes 03:30); a repeated one (fall back)
 * resolves to one of its two instants.
 */
export function zonedToUtc(date: string, msOfDay: number, tz: string): Date {
  const wall = dateMs(date) + msOfDay;
  const wallSeconds = wall - (((wall % 1000) + 1000) % 1000);
  const guess = wall - offsetAt(wall, tz);
  const candidates = [guess, wall - offsetAt(guess, tz)];
  const exact = candidates.filter((c) => wallClock(c, tz) === wallSeconds);
  return new Date(exact.length ? Math.min(...exact) : Math.max(...candidates));
}

/** Where an activity sits in local time: its start time of day, and its end relative to it. */
export interface LocalSlot {
  startMs: number;
  /** Days from the start's local date to the end's (1 for a sleep past midnight). */
  endDayOffset: number;
  endMs: number;
}

export function slotOf(start: Date, end: Date, tz: string): { date: string; slot: LocalSlot } {
  const s = toLocal(start, tz);
  const e = toLocal(end, tz);
  return { date: s.date, slot: { startMs: s.msOfDay, endDayOffset: daysBetween(s.date, e.date), endMs: e.msOfDay } };
}

/** The planned times of `slot` on local `date` in `tz`. */
export function placeSlot(date: string, slot: LocalSlot, tz: string): { plannedStart: Date; plannedEnd: Date } {
  return {
    plannedStart: zonedToUtc(date, slot.startMs, tz),
    plannedEnd: zonedToUtc(addDaysToDate(date, slot.endDayOffset), slot.endMs, tz),
  };
}
