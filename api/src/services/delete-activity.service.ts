import type { EditScope } from "@productivitytracker/shared";
import { badRequest, notFound } from "../errors.js";
import type { ActivitySeriesRepository } from "../repositories/postgres/activity-series.repository.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";

export class DeleteActivityService {
  constructor(
    private readonly activities: Pick<ActivityRepository, "findByIdForUser" | "delete">,
    private readonly series: Pick<ActivitySeriesRepository, "deleteFollowing" | "deleteIfEmpty">,
  ) {}

  /**
   * "this" deletes one activity (and its series, if that was the last occurrence).
   * "following" deletes it and every later occurrence of its series, and ends the series before it.
   */
  async execute(userId: number, id: number, scope: EditScope = "this"): Promise<void> {
    const current = await this.activities.findByIdForUser(id, userId);
    if (!current) throw notFound("Activity not found");
    if (scope === "following") {
      if (current.seriesId === null) throw badRequest("This activity isn't part of a series");
      await this.series.deleteFollowing(current.seriesId, userId, new Date(current.plannedStart));
      return;
    }
    if (!(await this.activities.delete(id, userId))) throw notFound("Activity not found");
    if (current.seriesId !== null) await this.series.deleteIfEmpty(current.seriesId, userId);
  }
}
