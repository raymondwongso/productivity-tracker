import type { CinemaStats, StatsQuery } from "@productivitytracker/shared";
import { buildCinemaStats } from "../lib/stats.js";
import { parseStatsRange } from "../lib/stats-range.js";
import type { StatsRepository } from "../repositories/postgres/stats.repository.js";

export class GetCinemaStatsService {
  constructor(
    private readonly stats: Pick<StatsRepository, "listForStats">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: number, q: StatsQuery): Promise<CinemaStats> {
    const now = this.now();
    const range = parseStatsRange(q, now);
    const rows = await this.stats.listForStats(userId, "watch", range.from, range.to, range.tz);
    return buildCinemaStats(range, rows, now);
  }
}
