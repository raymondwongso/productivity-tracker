import type { SleepStats, StatsQuery } from "@productivitytracker/shared";
import { buildSleepStats } from "../lib/stats.js";
import { parseStatsRange } from "../lib/stats-range.js";
import type { StatsRepository } from "../repositories/postgres/stats.repository.js";

export class GetSleepStatsService {
  constructor(
    private readonly stats: Pick<StatsRepository, "listForStats">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: number, q: StatsQuery): Promise<SleepStats> {
    const now = this.now();
    const range = parseStatsRange(q, now);
    const rows = await this.stats.listForStats(userId, "sleep", range.from, range.to, range.tz);
    return buildSleepStats(range, rows, now);
  }
}
