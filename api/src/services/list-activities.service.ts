import type { Activity, CategorySlug } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { parseTime } from "../lib/activities.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";

/** Matches the trackers' longest range (the Work board lists up to 92 days); a month view needs 42. */
export const MAX_RANGE_DAYS = 92;

export class ListActivitiesService {
  constructor(private readonly activities: Pick<ActivityRepository, "listInRange">) {}

  async execute(userId: number, fromIso: string, toIso: string, category: CategorySlug | null = null): Promise<Activity[]> {
    const from = parseTime(fromIso, "from");
    const to = parseTime(toIso, "to");
    if (to <= from) throw badRequest('"to" must be after "from"');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
      throw badRequest(`The range can be at most ${MAX_RANGE_DAYS} days`);
    }
    return this.activities.listInRange(userId, from, to, category);
  }
}
