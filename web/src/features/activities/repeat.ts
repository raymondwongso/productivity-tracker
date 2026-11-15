import type { RepeatRule } from "@productivitytracker/shared";
import { DOW, formatDateKey } from "@/lib/dates";

const plural = (n: number, one: string) => (n === 1 ? one : `${n} ${one}s`);

/** `Repeats every 2 weeks on Mon, Wed until Mon, Dec 14`. */
export function describeRepeat(rule: RepeatRule): string {
  const every = rule.frequency === "daily" ? `every ${plural(rule.every, "day")}` : `every ${plural(rule.every, "week")}`;
  const on = rule.frequency === "weekly" && rule.weekdays?.length ? ` on ${rule.weekdays.map((d) => DOW[d - 1]).join(", ")}` : "";
  return `Repeats ${every}${on} until ${formatDateKey(rule.until)}`;
}
