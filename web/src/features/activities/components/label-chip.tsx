import type { ActivityLabel } from "@productivitytracker/shared";

const COLORS: Record<ActivityLabel, string> = {
  pending: "text-label-pending",
  late: "text-label-late",
  premature: "text-label-premature",
  overrun: "text-label-overrun",
  done: "text-label-done",
  cancelled: "text-label-cancelled",
};

/** Status chip. The text carries the meaning; color only reinforces it. */
export function LabelChip({ label, large }: { label: ActivityLabel; large?: boolean }) {
  return (
    <span
      className={`inline-block border-[1.5px] border-current bg-bg font-extrabold tracking-[.06em] whitespace-nowrap uppercase ${COLORS[label]} ${large ? "px-1.5 py-px text-[11px] leading-4" : "px-1 text-[9.5px] leading-[14px]"}`}
    >
      {label}
    </span>
  );
}

export function LabelChips({ labels, large }: { labels: ActivityLabel[]; large?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {labels.map((l) => (
        <LabelChip key={l} label={l} large={large} />
      ))}
    </span>
  );
}
