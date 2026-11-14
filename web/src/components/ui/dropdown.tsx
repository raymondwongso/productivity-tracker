"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Option<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
}

interface Props<V extends string | number> {
  id?: string;
  value: V | null;
  options: Option<V>[];
  placeholder: string;
  onChange: (value: V) => void;
  /** Rendered as the last row inside the list (e.g. "+ Create new"). */
  footer?: (close: () => void) => ReactNode;
  "aria-labelledby"?: string;
}

export function Dropdown<V extends string | number>({ id, value, options, placeholder, onChange, footer, ...aria }: Props<V>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        // Name = the field label plus the current choice, e.g. "Focus Strength".
        aria-labelledby={aria["aria-labelledby"] && id ? `${aria["aria-labelledby"]} ${id}` : aria["aria-labelledby"]}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-2 border-ink bg-surface px-3.5 py-3 text-left hover:bg-surface-hover"
      >
        <span className={selected ? "" : "text-muted"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="absolute z-10 mt-0.5 max-h-64 w-full overflow-y-auto border-2 border-ink bg-surface">
          <ul role="listbox">
            {options.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover ${o.value === value ? "bg-surface-hover" : ""}`}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="text-[13px] text-muted">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
          {footer?.(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
