import type { Activity } from "@productivitytracker/shared";
import { notFound } from "../errors.js";
import { stateOf } from "../lib/activities.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";

export class CancelActivityService {
  constructor(
    private readonly activities: Pick<ActivityRepository, "findByIdForUser" | "update">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Idempotent: cancelling a cancelled activity returns it unchanged. */
  async execute(userId: number, id: number): Promise<Activity> {
    const current = await this.activities.findByIdForUser(id, userId);
    if (!current) throw notFound("Activity not found");
    if (current.cancelledAt) return current;
    const saved = await this.activities.update(id, userId, {
      ...stateOf(current),
      cancelledAt: this.now(),
      labels: ["cancelled"],
    });
    if (!saved) throw notFound("Activity not found");
    return saved;
  }
}
