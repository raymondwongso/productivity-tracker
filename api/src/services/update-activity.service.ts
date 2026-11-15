import type { Activity, EditScope, GracePeriods, UpdateActivityRequest } from "@productivitytracker/shared";
import { badRequest, notFound } from "../errors.js";
import {
  applyPatch,
  assertFieldsFor,
  changedCategoryFields,
  checkReferences,
  checkTimes,
  labelsFor,
  mergeDetails,
  stateOf,
  timesChanged,
  type ReferenceLookups,
} from "../lib/activities.js";
import { addDaysToDate, daysBetween, placeSlot, slotOf } from "../lib/recurrence.js";
import type { ActivitySeriesRepository } from "../repositories/postgres/activity-series.repository.js";
import type { ActivityRepository, ActivityState } from "../repositories/postgres/activity.repository.js";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

export class UpdateActivityService {
  constructor(
    private readonly settings: Pick<SettingsRepository, "getGracePeriods">,
    private readonly refs: ReferenceLookups,
    private readonly activities: Pick<ActivityRepository, "findByIdForUser" | "update" | "listFollowing" | "updateMany">,
    private readonly series: Pick<ActivitySeriesRepository, "findByIdForUser">,
  ) {}

  /**
   * `req` may carry a stray `category` from the client; changing it is refused.
   * With scope "following", what changed on this occurrence is carried to every later
   * occurrence of its series (see `updateFollowing`).
   */
  async execute(
    userId: number,
    id: number,
    req: UpdateActivityRequest & { category?: unknown },
    scope: EditScope = "this",
  ): Promise<Activity> {
    const current = await this.activities.findByIdForUser(id, userId);
    if (!current) throw notFound("Activity not found");
    if (req.category !== undefined && req.category !== current.category) {
      throw badRequest("An activity's category can't be changed");
    }
    assertFieldsFor(current.category, req);

    const prev = stateOf(current);
    const next = applyPatch(prev, req);
    const details = mergeDetails(current.category, req, prev.details);
    await checkReferences(userId, details, prev.details, this.refs);

    // Labels only move when a time changes; other edits keep what was stored, even if the
    // grace periods have changed since. The grace periods are read at most once.
    let grace: GracePeriods | null = null;
    const graceNow = async () => (grace ??= await this.settings.getGracePeriods());
    const labelled = async (before: ActivityState, after: Omit<ActivityState, "labels">): Promise<ActivityState> => ({
      ...after,
      labels: timesChanged(before, after) ? labelsFor(after, await graceNow()) : before.labels,
    });

    const target = await labelled(prev, { ...next, details });
    if (scope === "this") {
      const saved = await this.activities.update(id, userId, target);
      if (!saved) throw notFound("Activity not found");
      return saved;
    }

    if (current.seriesId === null) throw badRequest("This activity isn't part of a series");
    const series = await this.series.findByIdForUser(current.seriesId, userId);
    if (!series) throw badRequest("This activity isn't part of a series");
    const tz = series.timeZone;

    // Carry over only what changed here. Planned times move as a new local start time and
    // duration (and the same shift in days); actual times stay with this occurrence.
    const fieldChanges = changedCategoryFields(prev.details, details);
    const plannedMoved = !sameTime(prev.plannedStart, next.plannedStart) || !sameTime(prev.plannedEnd, next.plannedEnd);
    const from = slotOf(prev.plannedStart, prev.plannedEnd, tz);
    const to = slotOf(next.plannedStart, next.plannedEnd, tz);
    const dayShift = daysBetween(from.date, to.date);

    const later = (await this.activities.listFollowing(current.seriesId, userId, prev.plannedStart)).filter((a) => a.id !== id);
    const updates: { id: number; state: ActivityState }[] = [{ id, state: target }];
    for (const a of later) {
      const p = stateOf(a);
      const planned = plannedMoved
        ? placeSlot(addDaysToDate(slotOf(p.plannedStart, p.plannedEnd, tz).date, dayShift), to.slot, tz)
        : { plannedStart: p.plannedStart, plannedEnd: p.plannedEnd };
      const moved = { ...planned, actualStart: p.actualStart, actualEnd: p.actualEnd };
      checkTimes(moved);
      updates.push({
        id: a.id,
        state: await labelled(p, {
          ...moved,
          name: next.name !== prev.name ? next.name : p.name,
          notes: next.notes !== prev.notes ? next.notes : p.notes,
          cancelledAt: p.cancelledAt,
          details: mergeDetails(a.category, fieldChanges, p.details),
        }),
      });
    }

    const saved = await this.activities.updateMany(userId, updates);
    if (!saved?.[0]) throw notFound("Activity not found");
    return saved[0];
  }
}

const sameTime = (a: Date, b: Date) => a.getTime() === b.getTime();
