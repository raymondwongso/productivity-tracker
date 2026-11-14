"use client";

import type { Category } from "@productivitytracker/shared";
import type { CSSProperties } from "react";
import { Modal } from "@/components/ui/modal";
import { formatSlot } from "@/lib/dates";
import { CATEGORY_HINTS, CATEGORY_ICONS } from "../meta";

interface Props {
  start: Date;
  categories: Category[];
  onPick: (c: Category) => void;
  onClose: () => void;
}

export function CategoryPicker({ start, categories, onPick, onClose }: Props) {
  return (
    <Modal title="New activity" subtitle={`${formatSlot(start)}. Choose a category.`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {categories.map((c) => {
          const Icon = CATEGORY_ICONS[c.slug];
          return (
            <button
              key={c.id}
              type="button"
              autoFocus={c === categories[0]}
              onClick={() => onPick(c)}
              style={{ "--cat": c.color } as CSSProperties}
              className="flex items-center gap-3.5 border-2 border-ink px-3.5 py-3 text-left hover:bg-surface hover:shadow-[4px_4px_0_var(--cat)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-(--cat) text-on-cat">
                <Icon size={16} />
              </span>
              <span>
                <b className="block">{c.name}</b>
                <span className="text-[13px] text-muted">{CATEGORY_HINTS[c.slug]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
