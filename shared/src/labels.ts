import type { ActivityLabel, GracePeriods } from "./index.js";

export interface LabelTimes {
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  cancelled: boolean;
}

const MINUTE = 60_000;

/**
 * The labels stored on an activity. Returns one of the nine sets allowed by the
 * `activities_labels_valid` constraint, in canonical order (late first).
 * "Late" depends on the actual start only: an activity that has not started is just pending.
 */
export function computeLabels(t: LabelTimes, g: GracePeriods): ActivityLabel[] {
  if (t.cancelled) return ["cancelled"];
  if (!t.actualStart) return ["pending"];
  const labels: ActivityLabel[] = [];
  if (t.actualStart.getTime() - t.plannedStart.getTime() > g.lateMinutes * MINUTE) labels.push("late");
  if (t.actualEnd) {
    const end = t.actualEnd.getTime();
    const planned = t.plannedEnd.getTime();
    if (planned - end > g.prematureMinutes * MINUTE) labels.push("premature");
    else if (end - planned > g.overrunMinutes * MINUTE) labels.push("overrun");
    if (labels.length === 0) labels.push("done");
  }
  return labels;
}
