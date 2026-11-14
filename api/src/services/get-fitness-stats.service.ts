import type { FitnessStats, StatsQuery } from "@productivitytracker/shared";
import { buildFitnessStats } from "../lib/stats.js";
import { parseStatsRange } from "../lib/stats-range.js";
import type { StatsRepository } from "../repositories/postgres/stats.repository.js";

/** Workout, meals and diet in one response: the Fitness page shows all three. */
export class GetFitnessStatsService {
  constructor(
    private readonly stats: Pick<StatsRepository, "listForStats">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: number, q: StatsQuery): Promise<FitnessStats> {
    const now = this.now();
    const range = parseStatsRange(q, now);
    const [workouts, meals] = await Promise.all([
      this.stats.listForStats(userId, "workout", range.from, range.to, range.tz),
      this.stats.listForStats(userId, "meals", range.from, range.to, range.tz),
    ]);
    return buildFitnessStats(range, workouts, meals, now);
  }
}
