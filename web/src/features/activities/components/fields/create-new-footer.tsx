"use client";

import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

interface Props {
  placeholder: string;
  /** Extra inputs next to the name, e.g. the movie/series kind. */
  extra?: ReactNode;
  pending: boolean;
  onCreate: (name: string) => Promise<void>;
}

/** The "+ Create new" row at the bottom of a dropdown list. */
export function CreateNewFooter({ placeholder, extra, pending, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    if (!name.trim()) return;
    setError("");
    try {
      await onCreate(name.trim());
      setName("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create it.");
    }
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 border-t-2 border-line px-3.5 py-2.5 font-semibold text-primary hover:bg-surface-hover">
        <Plus size={16} />
        Create new
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 border-t-2 border-line p-2">
      <div className="flex gap-1.5">
        <input
          autoFocus
          aria-label={placeholder}
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-w-0 flex-1 border-2 border-ink bg-bg px-2.5 py-2 text-sm placeholder:text-muted focus:border-primary"
        />
        {extra}
        <button type="button" disabled={pending} onClick={() => void submit()} className="bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60">
          Add
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
    </div>
  );
}
