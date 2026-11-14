"use client";

import { focusLabel } from "@/features/activities/meta";
import { parseDateKey } from "@/lib/dates";
import { CATEGORY_COLOR, VIZ } from "../colors";
import { ChartCard } from "../components/chart-card";
import { TipRow } from "../components/chart-tooltip";
import { ColumnChart } from "../components/column-chart";
import { ShareDonut } from "../components/share-donut";
import { ChartGrid, Section, StatTile, StatTiles, TrackerShell, useTrackerRange } from "../components/tracker-shell";
import {
  averagedOver,
  dayLong,
  dayShort,
  formatDuration,
  formatKcal,
  formatNumber,
  formatSignedKcal,
  perDay,
  plural,
  tickKcal,
  tickMinutes,
} from "../format";
import { useStats } from "../hooks";
import { daysOf } from "../range";

const SECTIONS = [
  { id: "workout", label: "Workout", color: CATEGORY_COLOR.workout },
  { id: "meals", label: "Meals", color: CATEGORY_COLOR.meals },
  { id: "diet", label: "Diet", color: CATEGORY_COLOR.meals },
];
const notCounted = (n: number, what: string) =>
  n ? `${plural(n, what)} in this range ${n === 1 ? "has" : "have"} no actual end, so ${n === 1 ? "it isn't" : "they aren't"} counted.` : "";

/** Workout, then Meals, then Diet, on one page under one date range. Every chart takes the full width. */
export function FitnessTracker() {
  const { range, setPreset, setCustom } = useTrackerRange();
  const { data, isPlaceholderData, error, isPending } = useStats("fitness", range);
  const days = data ? data.workout.days.map((d) => parseDateKey(d.date)!) : daysOf(range.from, range.to);
  const span = `${dayShort(days[0]!)} to ${dayShort(days[days.length - 1]!)}`;

  const jump = (
    <nav aria-label="Sections" className="mt-2.5 flex flex-wrap gap-1.5">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          className="inline-flex items-center gap-1.5 border-2 border-line px-2.5 py-1 text-[13px] font-semibold hover:border-ink"
        >
          <i aria-hidden="true" className="inline-block h-2 w-2" style={{ background: s.color }} />
          {s.label}
        </button>
      ))}
    </nav>
  );

  let body = <p className="text-muted">Loading…</p>;
  if (!isPending && data) {
    const { workout: w, meals: m, diet, averagedDays: n } = data;
    const avg = averagedOver(days, n);
    const best = m.days.reduce((bi, d, i) => (d.calories > m.days[bi]!.calories ? i : bi), 0);
    const top = w.focus[0];
    const focusName = (f: (typeof w.focus)[number]["focus"]) => focusLabel(f) ?? "No focus";
    const net = m.calories - w.caloriesBurned;
    const minutes = (v: number) => (v ? formatDuration(v) : "0 min");
    body = (
      <>
        <Section id="workout" title="Workout" color={CATEGORY_COLOR.workout} sub={plural(w.sessions, "finished workout")}>
          <StatTiles>
            <StatTile label="Sessions" value={formatNumber(w.sessions)} sub={notCounted(w.notCounted, "workout") || "all planned workouts finished"} />
            <StatTile label="Time working out" value={formatDuration(w.minutes)} sub={`${formatDuration(perDay(w.minutes, n))} a day, ${avg}`} />
            <StatTile label="Calories burned" value={formatKcal(w.caloriesBurned)} sub={`${formatKcal(perDay(w.caloriesBurned, n))} a day, ${avg}`} />
            <StatTile label="Top focus" value={top ? focusName(top.focus) : "—"} sub={top ? plural(top.sessions, "session") : ""} />
          </StatTiles>
          <ChartGrid>
            <ChartCard span title="Focus" sub="Share of finished workouts by focus" empty={w.focus.length ? null : "No finished workouts in this range."}>
              <ShareDonut
                // The API sends the focus split largest first.
                parts={w.focus.map((f) => ({ key: f.focus ?? "none", name: focusName(f.focus), sub: formatDuration(f.minutes), value: f.sessions, extra: `${formatDuration(f.minutes)} in total` }))}
                format={(v) => plural(v, "session")}
                center={[String(w.sessions), w.sessions === 1 ? "session" : "sessions"]}
                label="Focus"
              />
            </ChartCard>
            <ChartCard
              span
              title="Calories burned per day"
              sub="Sum of calorie burn on finished workouts"
              empty={w.caloriesBurned ? null : "No calories burned in this range."}
              table={{ head: ["Day", "Burned"], rows: w.days.map((d, i) => [dayLong(days[i]!), formatKcal(d.caloriesBurned)]) }}
            >
              <ColumnChart
                days={days}
                series={[{ name: "Burned", color: VIZ.workout, values: w.days.map((d) => d.caloriesBurned) }]}
                tick={tickKcal}
                format={formatKcal}
                label={`Calories burned per day, ${span}. Daily values are in the table.`}
              />
            </ChartCard>
            <ChartCard
              span
              title="Minutes working out per day"
              sub="Actual start to actual end of finished workouts"
              empty={w.minutes ? null : "No finished workouts in this range."}
              table={{ head: ["Day", "Minutes"], rows: w.days.map((d, i) => [dayLong(days[i]!), minutes(d.minutes)]) }}
            >
              <ColumnChart
                days={days}
                series={[{ name: "Minutes", color: VIZ.workout, values: w.days.map((d) => d.minutes) }]}
                tick={tickMinutes}
                format={minutes}
                label={`Minutes working out per day, ${span}. Daily values are in the table.`}
              />
            </ChartCard>
          </ChartGrid>
        </Section>

        <Section id="meals" title="Meals" color={CATEGORY_COLOR.meals} sub={plural(m.meals, "finished meal")}>
          <StatTiles>
            <StatTile label="Calories consumed" value={formatKcal(m.calories)} sub={notCounted(m.notCounted, "meal")} />
            <StatTile label="Per day" value={formatKcal(perDay(m.calories, n))} sub={avg} />
            <StatTile label="Meals" value={formatNumber(m.meals)} sub={`${perDay(m.meals, n).toFixed(1)} a day`} />
            <StatTile label="Highest day" value={m.calories ? formatKcal(m.days[best]!.calories) : "—"} sub={m.calories ? dayLong(days[best]!) : ""} />
          </StatTiles>
          <ChartGrid>
            <ChartCard
              span
              title="Calories consumed per day"
              sub="Total calories of finished meals"
              empty={m.calories ? null : "No finished meals in this range."}
              table={{ head: ["Day", "Consumed"], rows: m.days.map((d, i) => [dayLong(days[i]!), formatKcal(d.calories)]) }}
            >
              <ColumnChart
                days={days}
                series={[{ name: "Consumed", color: VIZ.meals, values: m.days.map((d) => d.calories) }]}
                tick={tickKcal}
                format={formatKcal}
                label={`Calories consumed per day, ${span}. Daily values are in the table.`}
              />
            </ChartCard>
          </ChartGrid>
        </Section>

        <Section id="diet" title="Diet" color={CATEGORY_COLOR.meals} sub="calories in against calories burned, per day">
          <StatTiles>
            <StatTile label="Consumed per day" value={formatKcal(perDay(m.calories, n))} sub={`from meals, ${avg}`} />
            <StatTile label="Burned per day" value={formatKcal(perDay(w.caloriesBurned, n))} sub={`from workouts only, ${avg}`} />
            <StatTile hero label="Net per day" value={formatSignedKcal(perDay(net, n))} sub="consumed minus burned" />
          </StatTiles>
          <ChartGrid>
            <ChartCard
              span
              title="Consumed and burned per day"
              sub="Meals against workouts on the same day"
              legend={[{ name: "Consumed", color: VIZ.meals }, { name: "Burned", color: VIZ.workout }]}
              note="Burned counts the calorie burn you enter on workouts. It doesn't include resting energy, so net is not a weight forecast."
              empty={m.calories || w.caloriesBurned ? null : "No finished meals or workouts in this range."}
              table={{
                head: ["Day", "Consumed", "Burned", "Net"],
                rows: diet.days.map((d, i) => [dayLong(days[i]!), formatKcal(d.consumed), formatKcal(d.burned), formatSignedKcal(d.net)]),
              }}
            >
              <ColumnChart
                mode="group"
                height={230}
                days={days}
                series={[
                  { name: "Consumed", color: VIZ.meals, values: diet.days.map((d) => d.consumed) },
                  { name: "Burned", color: VIZ.workout, values: diet.days.map((d) => d.burned) },
                ]}
                tick={tickKcal}
                format={formatKcal}
                extraTip={(i) => <TipRow sum value={formatSignedKcal(diet.days[i]!.net)} name="Net" />}
                label={`Calories consumed and burned per day, ${span}. Daily values and net are in the table.`}
              />
            </ChartCard>
          </ChartGrid>
        </Section>
      </>
    );
  }

  return (
    <TrackerShell
      title="Fitness Tracker"
      color={`linear-gradient(90deg, ${CATEGORY_COLOR.workout} 50%, ${CATEGORY_COLOR.meals} 50%)`}
      range={range}
      onPreset={setPreset}
      onCustom={setCustom}
      extra={jump}
      stale={isPlaceholderData}
      error={error ? error.message : null}
    >
      {body}
    </TrackerShell>
  );
}
