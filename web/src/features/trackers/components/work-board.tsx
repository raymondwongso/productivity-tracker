"use client";

import type { WorkActivity } from "@productivitytracker/shared";
import { useState } from "react";
import { LabelChips } from "@/features/activities/components/label-chip";
import { formatHm } from "@/lib/dates";
import { CATEGORY_COLOR } from "../colors";
import { dayLong } from "../format";

const NO_PROJECT = 0;
const projectOf = (a: WorkActivity) => a.project?.id ?? NO_PROJECT;

interface Props {
  /** Work activities planned in the range. */
  activities: WorkActivity[];
  onOpen: (a: WorkActivity) => void;
  now?: Date;
}

/**
 * Pending and done work, as a read-only list: a card's column follows its actual times, which are
 * changed in the activity modal. The project filter scopes only the board.
 */
export function WorkBoard({ activities, onOpen, now = new Date() }: Props) {
  const live = activities.filter((a) => !a.cancelledAt);
  const projects = new Map<number, string>();
  for (const a of live) projects.set(projectOf(a), a.project?.name ?? "No project");
  const options = [...projects].sort((x, y) => (x[0] === NO_PROJECT ? 1 : y[0] === NO_PROJECT ? -1 : x[1].localeCompare(y[1])));
  const [picked, setPicked] = useState<number | null>(null);
  // A project with no work left in the range falls back to All projects.
  const project = picked !== null && projects.has(picked) ? picked : null;
  const shown = project === null ? live : live.filter((a) => projectOf(a) === project);
  const byStart = (x: WorkActivity, y: WorkActivity) => x.plannedStart.localeCompare(y.plannedStart);
  const pending = shown.filter((a) => !a.actualEnd).sort(byStart);
  const done = shown.filter((a) => a.actualEnd).sort((x, y) => byStart(y, x));
  const count = (id: number) => live.filter((a) => projectOf(a) === id).length;

  const column = (title: string, hint: string, list: WorkActivity[], empty: string) => (
    <section aria-label={title} className="flex min-w-0 flex-col border-2 border-ink bg-bar">
      <h3 className="flex items-center gap-2 border-b-2 border-ink px-3 py-2.5 text-sm font-extrabold">
        {title}
        <span className="font-normal text-muted">{hint}</span>
        <b className="ml-auto text-xs text-muted">{list.length}</b>
      </h3>
      <div className="flex max-h-[560px] min-h-[120px] flex-col gap-2 overflow-y-auto p-2.5">
        {list.length ? list.map((a) => <BoardCard key={a.id} a={a} now={now} onOpen={onOpen} />) : <p className="border border-dashed border-line p-3 text-[13px] text-muted">{empty}</p>}
      </div>
    </section>
  );

  return (
    <section aria-label="Board" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <h2 className="flex flex-wrap items-center gap-2.5 text-xl font-extrabold">
          <i aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: CATEGORY_COLOR.work }} />
          Board
          <small className="text-[13px] font-normal text-muted">work activities in this range · click one to open it</small>
        </h2>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          Project
          <select
            value={project ?? ""}
            onChange={(e) => setPicked(e.target.value === "" ? null : Number(e.target.value))}
            className="min-w-[200px] border-2 border-ink bg-surface px-2.5 py-[7px] text-sm"
          >
            <option value="">All projects ({live.length})</option>
            {options.map(([id, name]) => (
              <option key={id} value={id}>
                {name} ({count(id)})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {column("Pending", "not finished", pending, "Nothing left to start in this range.")}
        {column("Done", "finished", done, "Nothing finished in this range yet.")}
      </div>
    </section>
  );
}

function BoardCard({ a, now, onOpen }: { a: WorkActivity; now: Date; onOpen: (a: WorkActivity) => void }) {
  const ps = new Date(a.plannedStart);
  const overdue = !a.actualStart && new Date(a.plannedEnd) < now;
  const running = !!a.actualStart && !a.actualEnd;
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      className="flex w-full flex-col border-2 border-ink bg-surface text-left hover:shadow-[4px_4px_0_var(--cat)] focus-visible:shadow-[4px_4px_0_var(--cat)]"
      style={{ ["--cat" as string]: CATEGORY_COLOR.work }}
    >
      <span className="flex items-baseline gap-1.5 overflow-hidden bg-(--cat) px-2 py-[3px] leading-[15px] whitespace-nowrap text-on-cat">
        <span className="text-[10.5px] font-extrabold tracking-[.07em] uppercase">Work</span>
        <span className="truncate text-xs font-semibold">{a.project?.name ?? "No project"}</span>
      </span>
      <span className="flex flex-col gap-[3px] px-2 pt-1.5 pb-2 text-[12.5px]">
        <span className="text-sm font-semibold">{a.name}</span>
        <span className="text-ink-soft">
          {dayLong(ps)} · {formatHm(ps)} → {formatHm(new Date(a.plannedEnd))}
        </span>
        {a.actualStart && (
          <span className="text-ink-soft">
            <span className="text-muted">Actual </span>
            {formatHm(new Date(a.actualStart))} → {formatHm(a.actualEnd ? new Date(a.actualEnd) : null)}
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          <LabelChips labels={a.labels} />
          {overdue && <span className="font-semibold text-label-late">overdue</span>}
          {running && <span className="text-muted">in progress</span>}
        </span>
      </span>
    </button>
  );
}
