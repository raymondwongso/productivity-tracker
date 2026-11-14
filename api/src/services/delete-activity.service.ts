import { notFound } from "../errors.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";

export class DeleteActivityService {
  constructor(private readonly activities: Pick<ActivityRepository, "delete">) {}

  async execute(userId: number, id: number): Promise<void> {
    if (!(await this.activities.delete(id, userId))) throw notFound("Activity not found");
  }
}
