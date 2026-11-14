"use client";

import { Plus, X } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { mealTotal, type Draft } from "../../draft";

type Set = (patch: Partial<Draft>) => void;
const small = "w-full border-2 border-ink bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-muted focus:border-primary";

/** Calories taken: rendered under the header. Read-only while items exist. */
export function MealTopFields({ draft, set }: { draft: Draft; set: Set }) {
  const fromItems = draft.mealItems.length > 0;
  return (
    <Field label="Total calories (kcal)" htmlFor="f-total">
      <input
        id="f-total"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        readOnly={fromItems}
        className={`${inputClass} read-only:bg-bg read-only:text-ink-soft`}
        placeholder="0"
        value={fromItems ? String(mealTotal(draft) ?? 0) : draft.totalCalories}
        onChange={(e) => set({ totalCalories: e.target.value })}
      />
      <p className="text-xs text-muted">{fromItems ? "Calculated from the meal items below." : "No items yet, so type the total yourself."}</p>
    </Field>
  );
}

export function MealItemsEditor({ draft, set }: { draft: Draft; set: Set }) {
  const items = draft.mealItems;
  const update = (i: number, patch: Partial<Draft["mealItems"][number]>) =>
    set({ mealItems: items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">Meal items</span>
        <span className="text-xs text-muted">Name · calories</span>
      </div>
      {items.length === 0 && (
        <p className="border border-dashed border-line px-3 py-2.5 text-[13px] text-muted">No meal items yet. Add items, or type the total calories above.</p>
      )}
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_40px] items-center gap-2 md:grid-cols-[minmax(0,1fr)_120px_40px]">
          <input aria-label={`Item ${i + 1} name`} className={small} placeholder="Food or drink" value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
          <input aria-label={`Item ${i + 1} calories (kcal)`} type="number" min={0} step={1} className={small} value={it.calories} onChange={(e) => update(i, { calories: e.target.value })} />
          <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => set({ mealItems: items.filter((_, n) => n !== i) })} className="flex h-10 items-center justify-center border-2 border-line text-muted hover:border-danger-text hover:text-danger-text">
            <X size={16} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set({ mealItems: [...items, { name: "", calories: "0" }] })} className="inline-flex items-center gap-1.5 self-start py-1 text-sm font-semibold text-primary hover:underline">
        <Plus size={16} />
        Add meal item
      </button>
      {items.length > 0 && (
        <div className="flex justify-end gap-2 border-t-2 border-line pt-2 text-sm">
          Total <b className="font-extrabold">{mealTotal(draft)} kcal</b>
        </div>
      )}
    </div>
  );
}
