"use client";

import type { CinemaStats, FitnessStats, GamingStats, SleepStats, WorkStats } from "@productivitytracker/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet, withQuery } from "@/lib/api-client";
import { toDateKey } from "@/lib/dates";
import { browserTimeZone, type TrackerRange } from "./range";

interface StatsByKind {
  sleep: SleepStats;
  fitness: FitnessStats;
  work: WorkStats;
  cinema: CinemaStats;
  gaming: GamingStats;
}
export type StatsKind = keyof StatsByKind;

/** One stats request per page. A new range keeps showing the previous numbers until it lands. */
export function useStats<K extends StatsKind>(kind: K, range: TrackerRange) {
  const q = { from: toDateKey(range.from), to: toDateKey(range.to), tz: browserTimeZone() };
  return useQuery({
    queryKey: ["stats", kind, q.from, q.to, q.tz],
    queryFn: () => apiGet<StatsByKind[K]>(withQuery(`/stats/${kind}`, q)),
    placeholderData: keepPreviousData,
  });
}
