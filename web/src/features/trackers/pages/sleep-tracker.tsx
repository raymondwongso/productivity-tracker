"use client";

import { LabelChip, LabelChips } from "@/features/activities/components/label-chip";
import { formatHm, parseDateKey } from "@/lib/dates";
import { CATEGORY_COLOR, VIZ, VIZ_LATE, VIZ_PREMATURE } from "../colors";
import { ChartCard } from "../components/chart-card";
import { TipRow } from "../components/chart-tooltip";
import { ColumnChart } from "../components/column-chart";
import { SleepScheduleChart } from "../components/sleep-schedule-chart";
import { ChartGrid, StatTile, StatTiles, TrackerShell, useTrackerRange } from "../components/tracker-shell";
import { averagedOver, dayLong, dayShort, formatDuration, perDay, plural, tickHours, tickMinutes } from "../format";
import { useStats } from "../hooks";
import { daysOf } from "../range";

const at = (iso: string | null) => (iso ? new Date(iso) : null);
const dur = (v: number) => (v ? formatDuration(v) : "0 min");

export function SleepTracker() {
  const { range, setPreset, setCustom } = useTrackerRange();
  const { data, isPlaceholderData, error, isPending } = useStats("sleep", range);
  const days = data ? data.days.map((d) => parseDateKey(d.date)!) : daysOf(range.from, range.to);
  const s = data?.summary;
  const of = s ? `of ${plural(s.trackedDays, "tracked day")}` : "";
  const span = `${dayShort(days[0]!)} to ${dayShort(days[days.length - 1]!)}`;

  return (
    <TrackerShell
      title="Sleep Tracker"
      color={CATEGORY_COLOR.sleep}
      range={range}
      onPreset={setPreset}
      onCustom={setCustom}
      stale={isPlaceholderData}
      error={error ? error.message : null}
    >
      {isPending || !data || !s ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <StatTiles>
            <StatTile label={<><LabelChip label="done" /> On schedule</>} value={plural(s.onScheduleDays, "day")} sub={of} />
            <StatTile label={<><LabelChip label="late" /> Slept late</>} value={plural(s.lateDays, "day")} sub={of} />
            <StatTile label={<><LabelChip label="premature" /> Premature</>} value={plural(s.prematureDays, "day")} sub={`${of} · woke or got up early`} />
            <StatTile label={<><LabelChip label="overrun" /> Overslept</>} value={plural(s.overrunDays, "day")} sub={of} />
            <StatTile
              hero
              label="Time lost to late and premature sleep"
              value={formatDuration(s.lateMinutes + s.prematureMinutes)}
              sub={`late ${formatDuration(s.lateMinutes)} · premature ${formatDuration(s.prematureMinutes)}`}
            />
            <StatTile label="Sleep per day" value={formatDuration(perDay(s.sleptMinutes, s.averagedDays))} sub={averagedOver(days, s.averagedDays)} />
          </StatTiles>
          <ChartGrid>
            <ChartCard
              span
              title="Bedtime and wake-up"
              sub="Each day's main sleep. Later times are lower, like the calendar."
              legend={[{ name: "Planned", color: "", kind: "box" }, { name: "Actual", color: VIZ.sleep }]}
              note={s.unloggedDays ? `${plural(s.unloggedDays, "day")} with a sleep that was never logged ${s.unloggedDays === 1 ? "is" : "are"} not counted.` : undefined}
              empty={data.days.some((d) => d.main) ? null : "No sleep planned in this range."}
              table={{
                head: ["Day", "Planned", "Actual", "Labels", "Slept", "Late", "Premature"],
                rows: data.days.map((d, i) => [
                  dayLong(days[i]!),
                  d.main ? `${formatHm(at(d.main.plannedStart))} → ${formatHm(at(d.main.plannedEnd))}` : "—",
                  d.main ? `${formatHm(at(d.main.actualStart))} → ${formatHm(at(d.main.actualEnd))}` : "—",
                  d.main ? <LabelChips labels={d.main.labels} /> : "",
                  d.sleptMinutes ? formatDuration(d.sleptMinutes) : "—",
                  d.lateMinutes ? formatDuration(d.lateMinutes) : "—",
                  d.prematureMinutes ? formatDuration(d.prematureMinutes) : "—",
                ]),
              }}
            >
              <SleepScheduleChart days={days} items={data.days.map((d) => d.main)} label={`Planned and actual sleep per day, ${span}. Times are in the table.`} />
            </ChartCard>
            <ChartCard
              span
              title="Hours slept per day"
              sub="Actual start to actual end, all on the day the sleep started"
              empty={s.sleptMinutes ? null : "No finished sleep in this range."}
              table={{ head: ["Day", "Slept"], rows: data.days.map((d, i) => [dayLong(days[i]!), dur(d.sleptMinutes)]) }}
            >
              <ColumnChart
                days={days}
                series={[{ name: "Slept", color: VIZ.sleep, values: data.days.map((d) => d.sleptMinutes) }]}
                tick={tickHours}
                format={dur}
                label={`Hours slept per day, ${span}. Daily values are in the table.`}
              />
            </ChartCard>
            <ChartCard
              span
              title="Time lost per day"
              sub="Minutes after the planned bedtime (late) plus minutes before the planned wake-up (premature)"
              legend={[{ name: "Late", color: VIZ_LATE }, { name: "Premature", color: VIZ_PREMATURE }]}
              empty={s.lateMinutes + s.prematureMinutes ? null : "No time lost in this range. Every tracked sleep started and ended within the grace periods."}
              table={{
                head: ["Day", "Late", "Premature"],
                rows: data.days.map((d, i) => [dayLong(days[i]!), dur(d.lateMinutes), dur(d.prematureMinutes)]),
              }}
            >
              <ColumnChart
                mode="stack"
                days={days}
                series={[
                  { name: "Late", color: VIZ_LATE, values: data.days.map((d) => d.lateMinutes) },
                  { name: "Premature", color: VIZ_PREMATURE, values: data.days.map((d) => d.prematureMinutes) },
                ]}
                tick={tickMinutes}
                format={dur}
                extraTip={(i) => {
                  const d = data.days[i]!;
                  return d.lateMinutes && d.prematureMinutes ? <TipRow sum value={formatDuration(d.lateMinutes + d.prematureMinutes)} name="Total" /> : null;
                }}
                label={`Time lost per day, ${span}, late and premature stacked. Daily values are in the table.`}
              />
            </ChartCard>
          </ChartGrid>
        </>
      )}
    </TrackerShell>
  );
}
