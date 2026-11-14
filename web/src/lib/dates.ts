/** Calendar date helpers. Everything is in the browser's local time; weeks run Monday to Sunday. */

export const MINUTE = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * MINUTE);
/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -weekdayIndex(d));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The Monday-first grid of whole weeks that covers the month of `d`: [start, end). */
export function monthGrid(d: Date): { start: Date; end: Date } {
  const first = startOfMonth(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: startOfWeek(first), end: addDays(startOfWeek(last), 7) };
}

export type CalendarView = "day" | "week" | "month";

/** The [from, to) range a view shows around `anchor`. */
export function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (view === "week") return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 7) };
  const g = monthGrid(anchor);
  return { from: g.start, to: g.end };
}

/** The anchor one step back or forward in a view. Month steps land on the 1st. */
export function stepAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addDays(anchor, 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

/** `07:05` */
export const formatHm = (d: Date | null) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "--:--");
/** `2026-11-14` (local) */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** `2026-11-14` → local midnight; null when malformed. */
export function parseDateKey(s: string | null): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** Value for `<input type="datetime-local">`: `2026-11-14T07:05`. */
export const toLocalInput = (d: Date | null) => (d ? `${toDateKey(d)}T${formatHm(d)}` : "");
/** `<input type="datetime-local">` value → Date (local); null when empty or invalid. */
export function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Heading for the calendar: `Nov 9 – 15, 2026`, `Oct 26 – Nov 1, 2026`, `Saturday, Nov 14, 2026`, `November 2026`. */
export function viewTitle(view: CalendarView, anchor: Date): string {
  if (view === "day") return `${DOW_LONG[weekdayIndex(anchor)]}, ${MON[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
  if (view === "month") return `${MONTH[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const m = startOfWeek(anchor);
  const s = addDays(m, 6);
  const right = m.getMonth() === s.getMonth() ? `${s.getDate()}` : `${MON[s.getMonth()]} ${s.getDate()}`;
  return `${MON[m.getMonth()]} ${m.getDate()} – ${right}, ${s.getFullYear()}`;
}

/** `Sat, Nov 14 at 09:00` */
export const formatSlot = (d: Date) => `${DOW[weekdayIndex(d)]}, ${MON[d.getMonth()]} ${d.getDate()} at ${formatHm(d)}`;
