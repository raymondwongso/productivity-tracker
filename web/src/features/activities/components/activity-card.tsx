import type { Activity, Category } from "@productivitytracker/shared";
import { Repeat } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { formatHm } from "@/lib/dates";
import { focusLabel } from "../meta";
import { LabelChips } from "./label-chip";

interface Props {
  activity: Activity;
  category: Category | undefined;
  /** Header only, with the start time: for very short cards. */
  compact?: boolean;
  /** The piece shown in this column started the day before. */
  continued?: boolean;
  style?: CSSProperties;
  onOpen: (a: Activity) => void;
}

const time = (iso: string | null) => formatHm(iso ? new Date(iso) : null);

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 px-[7px] py-px text-[11.5px] leading-[15px]">
      <span className="w-[46px] shrink-0 text-[10px] font-semibold tracking-[.06em] text-muted uppercase @max-[170px]:hidden">{k}</span>
      {children}
    </div>
  );
}

const Value = ({ children }: { children: ReactNode }) => <span className="min-w-0 truncate font-semibold">{children}</span>;

/** Card anatomy from the design: colored header, then rows in the order each category defines. */
export function ActivityCard({ activity: a, category, compact, continued, style, onOpen }: Props) {
  const planned = (
    <Row k="Planned">
      <span className="font-semibold whitespace-nowrap">
        {time(a.plannedStart)} → {time(a.plannedEnd)}
      </span>
    </Row>
  );
  const actual = (
    <Row k="Actual">
      <span className={`whitespace-nowrap ${a.actualStart ? "text-ink-soft" : "text-muted"}`}>
        {time(a.actualStart)} → {time(a.actualEnd)}
      </span>
      <LabelChips labels={a.labels} />
    </Row>
  );
  const notes = (
    <div className="rich-notes mx-[7px] mt-[5px] mb-1.5 min-h-0 flex-auto overflow-hidden border border-line bg-bg px-1.5 py-1 text-[11.5px] leading-[15px] text-ink-soft">
      {a.notes ? (
        // Notes are sanitized by the API (allow-listed tags, no attributes) before they are stored.
        <div dangerouslySetInnerHTML={{ __html: a.notes }} />
      ) : (
        <span className="text-muted italic">No notes</span>
      )}
    </div>
  );

  let rows: ReactNode;
  switch (a.category) {
    case "workout":
      rows = (
        <>
          <Row k="Focus"><Value>{focusLabel(a.focus) ?? "No focus"}</Value></Row>
          <Row k="Burn"><Value>{a.caloriesBurned ?? "—"} kcal burned</Value></Row>
          {planned}
          {actual}
          {notes}
        </>
      );
      break;
    case "meals":
      rows = (
        <>
          <Row k="Intake"><Value>{a.totalCalories ?? "—"} kcal</Value></Row>
          {planned}
          {actual}
          {notes}
          {a.items.length > 0 && (
            <ul className="mx-[7px] mb-1.5 shrink-0 text-[11.5px] leading-[15px]">
              {a.items.map((i, n) => (
                <li key={n} className="flex justify-between gap-1.5 border-t border-dashed border-line py-px">
                  <span className="truncate">{i.name}</span>
                  <span className="whitespace-nowrap text-muted">{i.calories} kcal</span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
      break;
    case "work":
      rows = (
        <>
          <Row k="Project"><Value>{a.project?.name ?? "No project"}</Value></Row>
          {planned}
          {actual}
          {notes}
        </>
      );
      break;
    case "watch":
      rows = (
        <>
          <Row k={a.title?.kind === "movie" ? "Movie" : "Series"}><Value>{a.title?.name ?? "Not set"}</Value></Row>
          {planned}
          {actual}
          {notes}
        </>
      );
      break;
    case "gaming":
      rows = (
        <>
          <Row k="Game"><Value>{a.game?.name ?? "No game"}</Value></Row>
          {planned}
          {actual}
          {notes}
        </>
      );
      break;
    default:
      rows = (
        <>
          {planned}
          {actual}
          {notes}
        </>
      );
  }

  const cancelled = a.cancelledAt !== null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${category?.name ?? a.category}: ${a.name}, ${time(a.plannedStart)} to ${time(a.plannedEnd)}, ${a.labels.join(", ") || "in progress"}${a.seriesId !== null ? ", repeats" : ""}`}
      onClick={() => onOpen(a)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(a);
        }
      }}
      style={{ ...style, "--cat": category?.color ?? "#8fb0aa" } as CSSProperties}
      className={`@container absolute z-[2] flex cursor-pointer flex-col overflow-hidden border-2 border-ink text-left hover:z-[7] hover:shadow-[4px_4px_0_var(--cat)] focus-visible:z-[7] ${cancelled ? "bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_6px,#19353e_6px_12px)]" : "bg-surface"}`}
    >
      <div
        className={`flex shrink-0 items-baseline gap-1.5 overflow-hidden px-[7px] leading-[15px] whitespace-nowrap ${compact ? "py-px" : "py-[3px]"} ${cancelled ? "bg-line text-ink-soft" : "bg-(--cat) text-on-cat"}`}
      >
        <span className="text-[10.5px] font-extrabold tracking-[.07em] uppercase">{category?.name ?? a.category}</span>
        <span className={`truncate text-xs font-semibold ${cancelled ? "line-through" : ""}`}>
          {continued ? "↳ " : ""}
          {a.name}
        </span>
        {a.seriesId !== null && <Repeat size={11} strokeWidth={2.5} aria-hidden="true" data-testid="repeat-icon" className="shrink-0 self-center" />}
        {compact && <span className="ml-auto text-[11px] font-semibold">{time(a.plannedStart)}</span>}
      </div>
      {!compact && <div className="flex min-h-0 flex-1 flex-col pt-[3px]">{rows}</div>}
    </div>
  );
}
