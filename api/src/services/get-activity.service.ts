import type { Activity } from "@productivitytracker/shared";
import { notFound } from "../errors.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";

export class GetActivityService {
  constructor(private readonly activities: Pick<ActivityRepository, "findByIdForUser">) {}

  async execute(userId: number, id: number): Promise<Activity> {
    const a = await this.activities.findByIdForUser(id, userId);
    if (!a) throw notFound("Activity not found");
    return a;
  }
}
