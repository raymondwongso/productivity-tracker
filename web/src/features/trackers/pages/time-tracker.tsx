"use client";

import type { Activity, CinemaStats, TimeStats, WorkActivity } from "@productivitytracker/shared";
import { useState } from "react";
import { ActivityModal } from "@/features/activities/components/activity-modal";
import { useActivities, useCategories } from "@/features/activities/hooks";
import { addDays, parseDateKey } from "@/lib/dates";
import { CATEGORY_COLOR, VIZ } from "../colors";
import { ChartCard } from "../components/chart-card";
import { ColumnChart } from "../components/column-chart";
import { ShareDonut } from "../components/share-donut";
import { ChartGrid, StatTile, StatTiles, TrackerShell, useTrackerRange } from "../components/tracker-shell";
import { WorkBoard } from "../components/work-board";
import { averagedOver, dayLong, dayShort, formatDuration, formatHours, formatNumber, perDay, plural, tickHours } from "../format";
import { useStats } from "../hooks";
import { daysOf, type TrackerRange } from "../range";

interface Config {
  kind: "work" | "cinema" | "gaming";
  title: string;
  color: string;
  bar: string;
  totalLabel: string;
  countLabel: string;
  noun: string;
  shareTitle: string;
  shareSub: string;
  dayTitle: string;
  empty: string;
}

const CONFIGS: Record<Config["kind"], Config> = {
  work: {
    kind: "work", title: "Work Tracker", color: CATEGORY_COLOR.work, bar: VIZ.work, totalLabel: "Time working", countLabel: "Projects",
    noun: "work activity", shareTitle: "Time by project", shareSub: "Share of hours worked", dayTitle: "Hours working per day", empty: "No finished work in this range.",
  },
  cinema: {
    kind: "cinema", title: "Cinema", color: CATEGORY_COLOR.watch, bar: VIZ.watch, totalLabel: "Time watching", countLabel: "Titles",
    noun: "watch activity", shareTitle: "Time by movie or series", shareSub: "Share of hours watched", dayTitle: "Hours watching per day", empty: "Nothing watched in this range.",
  },
  gaming: {
    kind: "gaming", title: "Gaming Tracker", color: CATEGORY_COLOR.gaming, bar: VIZ.gaming, totalLabel: "Time playing", countLabel: "Games",
    noun: "gaming session", shareTitle: "Time by game", shareSub: "Share of hours played", dayTitle: "Hours playing per day", empty: "No finished gaming sessions in this range.",
  },
};
const notCounted = (n: number, what: string) =>
  n ? `${plural(n, what)} in this range ${n === 1 ? "has" : "have"} no actual end, so ${n === 1 ? "it isn't" : "they aren't"} counted.` : "";
const isCinema = (s: TimeStats | CinemaStats): s is CinemaStats => s.parts.some((p) => "kind" in p);

/** Hours by project, title or game, plus hours per day. Work also lists its board. */
export function TimeTracker({ kind }: { kind: Config["kind"] }) {
  const c = CONFIGS[kind];
  const { range, setPreset, setCustom } = useTrackerRange();
  const { data, isPlaceholderData, error, isPending } = useStats(kind, range);
  const days = data ? data.days.map((d) => parseDateKey(d.date)!) : daysOf(range.from, range.to);
  const span = `${dayShort(days[0]!)} to ${dayShort(days[days.length - 1]!)}`;
  const dur = (v: number) => (v ? formatDuration(v) : "0 min");

  let body = <p className="text-muted">Loading…</p>;
  if (!isPending && data) {
    const n = data.averagedDays;
    const top = data.parts[0];
    const kindOf = (id: number | null) => (isCinema(data) ? data.parts.find((p) => p.id === id)?.kind : null);
    body = (
      <>
        <StatTiles>
          <StatTile label={c.totalLabel} value={formatDuration(data.minutes)} sub={notCounted(data.notCounted, c.noun) || plural(data.sessions, "session")} />
          <StatTile label="Per day" value={formatDuration(perDay(data.minutes, n))} sub={averagedOver(days, n)} />
          <StatTile label={c.countLabel} value={formatNumber(data.parts.length)} sub={top ? `most: ${top.name}` : ""} />
          <StatTile label="Sessions" value={formatNumber(data.sessions)} sub={data.sessions ? `${formatDuration(data.minutes / data.sessions)} on average` : ""} />
        </StatTiles>
        <ChartGrid>
          <ChartCard title={c.shareTitle} sub={c.shareSub} empty={data.parts.length ? null : c.empty}>
            <ShareDonut
              parts={data.parts.map((p) => {
                const k = kindOf(p.id);
                return { key: String(p.id), name: p.name, sub: k ? (k === "movie" ? "Movie" : "Series") : undefined, value: p.minutes, extra: plural(p.sessions, "session") };
              })}
              format={formatHours}
              center={[formatHours(data.minutes), "in total"]}
              label={c.shareTitle}
            />
          </ChartCard>
          <ChartCard
            title={c.dayTitle}
            sub="Actual start to actual end, on the day it was planned"
            empty={data.minutes ? null : c.empty}
            table={{ head: ["Day", "Time"], rows: data.days.map((d, i) => [dayLong(days[i]!), dur(d.minutes)]) }}
          >
            <ColumnChart
              days={days}
              series={[{ name: "Time", color: c.bar, values: data.days.map((d) => d.minutes) }]}
              tick={tickHours}
              format={dur}
              label={`${c.dayTitle}, ${span}. Daily values are in the table.`}
            />
          </ChartCard>
        </ChartGrid>
        {kind === "work" && <WorkBoardSection range={range} />}
      </>
    );
  }

  return (
    <TrackerShell title={c.title} color={c.color} range={range} onPreset={setPreset} onCustom={setCustom} stale={isPlaceholderData} error={error ? error.message : null}>
      {body}
    </TrackerShell>
  );
}

/** Work planned to start in the range; a card opens the same modal as the calendar. */
function WorkBoardSection({ range }: { range: TrackerRange }) {
  const end = addDays(range.to, 1);
  const { data: activities = [] } = useActivities(range.from, end, "work");
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState<Activity | null>(null);
  const work = activities.filter((a): a is WorkActivity => {
    const s = new Date(a.plannedStart);
    return a.category === "work" && s >= range.from && s < end;
  });
  const category = open ? categories.find((x) => x.id === open.categoryId) : undefined;
  return (
    <>
      <WorkBoard activities={work} onOpen={setOpen} />
      {open && category && <ActivityModal key={open.id} target={{ kind: "edit", activity: open }} category={category} onClose={() => setOpen(null)} />}
    </>
  );
}
