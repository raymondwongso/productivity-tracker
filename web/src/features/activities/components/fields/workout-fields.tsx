"use client";

import type { WorkoutUnit } from "@productivitytracker/shared";
import { Plus, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { Field, inputClass } from "@/components/ui/field";
import type { Draft } from "../../draft";
import { FOCUS_OPTIONS } from "../../meta";

type Set = (patch: Partial<Draft>) => void;
const small = "w-full border-2 border-ink bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-muted focus:border-primary";

/** Focus and calorie burn: rendered above the planned times, as on the card. */
export function WorkoutTopFields({ draft, set }: { draft: Draft; set: Set }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <span id="focus-label" className="text-[13px] font-semibold">Focus</span>
        <Dropdown id="f-focus" aria-labelledby="focus-label" value={draft.focus} options={FOCUS_OPTIONS} placeholder="Choose a focus" onChange={(focus) => set({ focus })} />
      </div>
      <Field label="Calorie burn (kcal)" htmlFor="f-burn">
        <input id="f-burn" type="number" min={0} step={1} inputMode="numeric" className={inputClass} placeholder="0" value={draft.caloriesBurned} onChange={(e) => set({ caloriesBurned: e.target.value })} />
      </Field>
    </div>
  );
}

export function WorkoutItemsEditor({ draft, set }: { draft: Draft; set: Set }) {
  const items = draft.workoutItems;
  const update = (i: number, patch: Partial<Draft["workoutItems"][number]>) =>
    set({ workoutItems: items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">Workout items</span>
        <span className="text-xs text-muted">Name · amount · unit</span>
      </div>
      {items.length === 0 && <p className="border border-dashed border-line px-3 py-2.5 text-[13px] text-muted">No workout items yet.</p>}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_76px_80px_40px] items-center gap-2 md:grid-cols-[minmax(0,1fr)_96px_92px_40px]">
          <input aria-label={`Item ${i + 1} name`} className={small} placeholder="Exercise" value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
          <input aria-label={`Item ${i + 1} amount`} type="number" min={0} step="any" className={small} value={it.amount} onChange={(e) => update(i, { amount: e.target.value })} />
          <select aria-label={`Item ${i + 1} unit`} className={small} value={it.unit} onChange={(e) => update(i, { unit: e.target.value as WorkoutUnit })}>
            <option value="x">x</option>
            <option value="mins">mins</option>
          </select>
          <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => set({ workoutItems: items.filter((_, n) => n !== i) })} className="flex h-10 items-center justify-center border-2 border-line text-muted hover:border-danger-text hover:text-danger-text">
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set({ workoutItems: [...items, { name: "", amount: "10", unit: "x" }] })} className="inline-flex items-center gap-1.5 self-start py-1 text-sm font-semibold text-primary hover:underline">
        <Plus size={16} />
        Add workout item
      </button>
    </div>
  );
}
