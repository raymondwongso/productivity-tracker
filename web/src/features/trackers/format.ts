import { DOW, weekdayIndex } from "@/lib/dates";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const plural = (n: number, word: string) => `${num.format(n)} ${word}${n === 1 ? "" : "s"}`;
export const formatNumber = (n: number) => num.format(Math.round(n));

/** `7 h 30 min`, `45 min`, `2 h` */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** `12 h`, `1.5 h`: for share lists, where a rough figure reads faster. */
export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return `${h >= 10 || Number.isInteger(h) ? Math.round(h) : h.toFixed(1)} h`;
}

export const formatKcal = (n: number) => `${num.format(Math.round(n))} kcal`;
/** `+1,163 kcal` / `−250 kcal` */
export const formatSignedKcal = (n: number) => `${n >= 0 ? "+" : "−"}${formatKcal(Math.abs(n))}`;

export const dayShort = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`;
/** `Mon, Nov 9` */
export const dayLong = (d: Date) => `${DOW[weekdayIndex(d)]}, ${dayShort(d)}`;

/** Compact axis ticks. */
export const tickKcal = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `${v}`);
export const tickMinutes = (v: number) => (v ? `${v} min` : "0");
export const tickHours = (v: number) => (v ? `${+(v / 60).toFixed(1)} h` : "0");

/**
 * What a per-day average divided by: the days of the range up to today. On Nov 15, "This month"
 * says "average over 15 days, Nov 1 – Nov 15".
 */
export function averagedOver(days: Date[], averagedDays: number): string {
  if (!averagedDays) return "no days up to today yet";
  return `average over ${plural(averagedDays, "day")}, ${dayShort(days[0]!)} – ${dayShort(days[averagedDays - 1]!)}`;
}

/** Sum ÷ days, or 0 when no day of the range has happened yet. */
export const perDay = (total: number, averagedDays: number) => (averagedDays ? total / averagedDays : 0);
