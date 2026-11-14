import type { Activity } from "@productivitytracker/shared";
import { notFound } from "../errors.js";
import { labelsFor, stateOf } from "../lib/activities.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

export class RestoreActivityService {
  constructor(
    private readonly settings: Pick<SettingsRepository, "getGracePeriods">,
    private readonly activities: Pick<ActivityRepository, "findByIdForUser" | "update">,
  ) {}

  /** Clears the cancellation and relabels from the times with the current grace periods. */
  async execute(userId: number, id: number): Promise<Activity> {
    const current = await this.activities.findByIdForUser(id, userId);
    if (!current) throw notFound("Activity not found");
    if (!current.cancelledAt) return current;
    const state = { ...stateOf(current), cancelledAt: null };
    const saved = await this.activities.update(id, userId, {
      ...state,
      labels: labelsFor(state, await this.settings.getGracePeriods()),
    });
    if (!saved) throw notFound("Activity not found");
    return saved;
  }
}
