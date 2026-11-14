import type { WorkStats, StatsQuery } from "@productivitytracker/shared";
import { buildTimeStats } from "../lib/stats.js";
import { parseStatsRange } from "../lib/stats-range.js";
import type { StatsRepository } from "../repositories/postgres/stats.repository.js";

export class GetWorkStatsService {
  constructor(
    private readonly stats: Pick<StatsRepository, "listForStats">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: number, q: StatsQuery): Promise<WorkStats> {
    const now = this.now();
    const range = parseStatsRange(q, now);
    const rows = await this.stats.listForStats(userId, "work", range.from, range.to, range.tz);
    return buildTimeStats(range, rows, now, "No project");
  }
}
