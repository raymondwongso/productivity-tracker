import type { ActivitySeries } from "@productivitytracker/shared";
import { notFound } from "../errors.js";
import type { ActivitySeriesRepository } from "../repositories/postgres/activity-series.repository.js";

export class GetActivitySeriesService {
  constructor(private readonly series: Pick<ActivitySeriesRepository, "findByIdForUser">) {}

  async execute(userId: number, id: number): Promise<ActivitySeries> {
    const s = await this.series.findByIdForUser(id, userId);
    if (!s) throw notFound("Series not found");
    return s;
  }
}
