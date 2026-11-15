"use client";

import type { Activity, Category, EditScope } from "@productivitytracker/shared";
import { ArrowRight, Ban, CopyCheck, Repeat, Trash2, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  draftFromActivity,
  newDraft,
  previewLabels,
  toCreateRequest,
  toCreateSeriesRequest,
  toUpdateRequest,
  validateDraft,
  type Draft,
  type DraftErrors,
} from "../draft";
import {
  useActivitySeries,
  useCancelActivity,
  useCreateActivity,
  useCreateActivitySeries,
  useDeleteActivity,
  useGracePeriods,
  useRestoreActivity,
  useUpdateActivity,
} from "../hooks";
import { NAME_PLACEHOLDERS } from "../meta";
import { describeRepeat } from "../repeat";
import { MealItemsEditor, MealTopFields } from "./fields/meal-fields";
import { GamingTopFields, WatchTopFields, WorkTopFields } from "./fields/reference-fields";
import { RepeatFields } from "./fields/repeat-fields";
import { WorkoutItemsEditor, WorkoutTopFields } from "./fields/workout-fields";
import { LabelChips } from "./label-chip";
import { RichText } from "./rich-text";

export type ModalTarget = { kind: "edit"; activity: Activity } | { kind: "new"; category: Category; start: Date };

interface Props {
  target: ModalTarget;
  category: Category;
  onClose: () => void;
}

const dangerBtn = "inline-flex items-center gap-2 border-2 border-danger-text px-3 py-2 font-semibold text-danger-text hover:bg-danger-tint disabled:opacity-60";
const lineBtn = "inline-flex items-center gap-2 border-2 border-ink px-3 py-2 font-semibold hover:bg-ink hover:text-bg disabled:opacity-60";

function TimePair({ legend, ids, values, onChange, action, error }: {
  legend: string;
  ids: [string, string];
  values: [string, string];
  onChange: (i: 0 | 1, v: string) => void;
  /** Shown at the end of the row, e.g. "Use planned times". */
  action?: ReactNode;
  error?: string;
}) {
  const input = (i: 0 | 1, label: string) => (
    <div className="flex min-w-0 flex-[1_1_220px]">
      <input id={ids[i]} type="datetime-local" aria-label={label} className={`${inputClass} min-w-0 py-2.5`} value={values[i]} onChange={(e) => onChange(i, e.target.value)} />
    </div>
  );
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        {input(0, `${legend} start`)}
        <span className="font-extrabold text-muted" aria-hidden="true">→</span>
        {input(1, `${legend} end`)}
        {action}
      </div>
      {error && <p role="alert" className="text-[13px] text-danger-text">{error}</p>}
    </fieldset>
  );
}

export function ActivityModal({ target, category, onClose }: Props) {
  const toast = useToast();
  const { data: grace } = useGracePeriods();
  const [original, setOriginal] = useState<Activity | null>(target.kind === "edit" ? target.activity : null);
  const [draft, setDraft] = useState<Draft>(() =>
    target.kind === "edit" ? draftFromActivity(target.activity) : newDraft(target.category.slug, target.start),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState("");
  const [armDelete, setArmDelete] = useState(false);
  /** An occurrence of a series asks which occurrences a save or delete applies to. */
  const [askScope, setAskScope] = useState<"save" | "delete" | null>(null);

  const create = useCreateActivity();
  const createSeries = useCreateActivitySeries();
  const update = useUpdateActivity();
  const remove = useDeleteActivity();
  const cancel = useCancelActivity();
  const restore = useRestoreActivity();
  const busy = create.isPending || createSeries.isPending || update.isPending || remove.isPending || cancel.isPending || restore.isPending;
  const inSeries = original !== null && original.seriesId !== null;
  const { data: series } = useActivitySeries(original?.seriesId ?? null);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerError("");
  };
  const labels = previewLabels(draft, original, grace);
  const fail = (e: unknown) => setServerError(e instanceof Error ? e.message : "Something went wrong. Try again.");

  async function save(scope?: EditScope) {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (inSeries && !scope) return setAskScope("save");
    setAskScope(null);
    try {
      if (original) {
        await update.mutateAsync({ id: original.id, req: toUpdateRequest(draft), scope });
        toast(scope === "following" ? "Changes saved to this and following" : "Changes saved");
      } else {
        const seriesReq = toCreateSeriesRequest(draft);
        if (seriesReq) {
          const res = await createSeries.mutateAsync(seriesReq);
          toast(`${res.activities.length} ${res.activities.length === 1 ? "activity" : "activities"} created`);
        } else {
          await create.mutateAsync(toCreateRequest(draft));
          toast("Activity created");
        }
      }
      onClose();
    } catch (e) {
      fail(e);
    }
  }

  async function toggleCancelled() {
    if (!original) return;
    try {
      const a = await (original.cancelledAt ? restore : cancel).mutateAsync(original.id);
      if (a) {
        setOriginal(a);
        set({ cancelled: a.cancelledAt !== null });
        toast(a.cancelledAt ? "Activity cancelled" : "Activity restored");
      }
    } catch (e) {
      fail(e);
    }
  }

  /** A one-off asks twice; an occurrence asks which occurrences, which is the second step. */
  async function onDelete(scope?: EditScope) {
    if (!original) return;
    if (inSeries && !scope) return setAskScope("delete");
    if (!inSeries && !armDelete) return setArmDelete(true);
    setAskScope(null);
    try {
      await remove.mutateAsync({ id: original.id, scope });
      toast(scope === "following" ? "This and following deleted" : "Activity deleted");
      onClose();
    } catch (e) {
      fail(e);
    }
  }

  let topFields: ReactNode = null;
  let bottomFields: ReactNode = null;
  if (draft.category === "workout") {
    topFields = <WorkoutTopFields draft={draft} set={set} />;
    bottomFields = <WorkoutItemsEditor draft={draft} set={set} />;
  } else if (draft.category === "meals") {
    topFields = <MealTopFields draft={draft} set={set} />;
    bottomFields = <MealItemsEditor draft={draft} set={set} />;
  } else if (draft.category === "work") {
    topFields = <WorkTopFields draft={draft} set={set} current={original?.category === "work" ? original.project : null} />;
  } else if (draft.category === "watch") {
    topFields = <WatchTopFields draft={draft} set={set} />;
  } else if (draft.category === "gaming") {
    topFields = <GamingTopFields draft={draft} set={set} />;
  }

  const scopeFooter = askScope && (
    <div className="flex w-full flex-wrap items-center gap-2.5" role="group" aria-label={askScope === "save" ? "Save changes to" : "Delete"}>
      <span className="text-[13px] font-semibold">{askScope === "save" ? "Save changes to" : "Delete"}</span>
      <button type="button" className={askScope === "delete" ? dangerBtn : lineBtn} disabled={busy} onClick={() => void (askScope === "save" ? save("this") : onDelete("this"))}>
        This activity
      </button>
      <button type="button" className={askScope === "delete" ? dangerBtn : lineBtn} disabled={busy} onClick={() => void (askScope === "save" ? save("following") : onDelete("following"))}>
        This and following
      </button>
      <button type="button" className={`${lineBtn} ml-auto`} onClick={() => setAskScope(null)}>
        Back
      </button>
    </div>
  );

  const footer = scopeFooter || (
    <>
      <div className="flex flex-wrap gap-2.5">
        {original && (
          <button type="button" className={`${dangerBtn} ${armDelete ? "bg-danger-tint" : ""}`} onClick={() => void onDelete()} disabled={busy}>
            <Trash2 size={16} />
            {armDelete ? "Click again to delete" : "Delete"}
          </button>
        )}
        {original && (
          <button type="button" className={lineBtn} onClick={() => void toggleCancelled()} disabled={busy}>
            {original.cancelledAt ? <Undo2 size={16} /> : <Ban size={16} />}
            {original.cancelledAt ? "Restore activity" : "Cancel activity"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className={lineBtn} onClick={onClose}>
          Close
        </button>
        <PrimaryButton type="submit" form="activity-form" icon={<ArrowRight size={18} />} disabled={busy} className="py-2.5">
          {original ? "Save changes" : "Create activity"}
        </PrimaryButton>
      </div>
    </>
  );

  return (
    <Modal
      wide
      accent={category.color}
      eyebrow={category.name}
      title={original ? original.name : "New activity"}
      headerExtra={labels && labels.length > 0 ? <LabelChips labels={labels} large /> : undefined}
      footer={footer}
      onClose={onClose}
    >
      <form
        id="activity-form"
        noValidate
        className="flex flex-col gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {inSeries && (
          <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <Repeat size={15} aria-hidden="true" />
            {series ? describeRepeat(series) : "Part of a series"}
          </p>
        )}
        <Field label="Name" htmlFor="f-name" error={errors.name}>
          <input id="f-name" autoFocus={!original} className={inputClass} placeholder={`e.g. ${NAME_PLACEHOLDERS[draft.category]}`} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {topFields}
        <TimePair
          legend="Planned"
          ids={["f-ps", "f-pe"]}
          values={[draft.plannedStart, draft.plannedEnd]}
          onChange={(i, v) => set(i === 0 ? { plannedStart: v } : { plannedEnd: v })}
          error={errors.planned}
        />
        <div className="flex flex-col gap-1.5">
          <TimePair
            legend="Actual"
            ids={["f-as", "f-ae"]}
            values={[draft.actualStart, draft.actualEnd]}
            onChange={(i, v) => set(i === 0 ? { actualStart: v } : { actualEnd: v })}
            action={
              // The common case: it happened as planned. One click fills both actual times.
              <button
                type="button"
                disabled={!draft.plannedStart || !draft.plannedEnd}
                onClick={() => set({ actualStart: draft.plannedStart, actualEnd: draft.plannedEnd })}
                className="inline-flex items-center gap-2 self-stretch border-2 border-ink bg-surface px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-ink hover:text-bg disabled:opacity-60"
              >
                <CopyCheck size={16} />
                Use planned times
              </button>
            }
            error={errors.actual}
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted" aria-live="polite">
            <span>Labels</span>
            {labels === null ? <span>shown once the times are set</span> : labels.length ? <LabelChips labels={labels} /> : <span className="text-ink-soft">none yet (in progress)</span>}
            {grace && (
              <span>
                · late after {grace.lateMinutes} min, premature when {grace.prematureMinutes} min early, overrun after {grace.overrunMinutes} min
              </span>
            )}
            {(draft.actualStart || draft.actualEnd) && (
              <button type="button" onClick={() => set({ actualStart: "", actualEnd: "" })} className="font-semibold underline hover:text-ink">
                Clear actual times
              </button>
            )}
          </div>
        </div>
        {!original && <RepeatFields draft={draft} set={set} error={errors.repeat} />}
        <div className="flex flex-col gap-1.5">
          <span id="notes-label" className="text-[13px] font-semibold">Notes</span>
          <RichText labelledBy="notes-label" value={draft.notes} onChange={(notes) => set({ notes })} />
        </div>
        {bottomFields}
        {(errors.numbers || serverError) && (
          <p role="alert" className="border-l-4 border-danger-text bg-danger-tint px-3 py-2 text-[13px] text-danger-text">
            {errors.numbers ?? serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
