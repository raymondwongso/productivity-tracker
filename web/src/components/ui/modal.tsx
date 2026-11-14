"use client";

import { X } from "lucide-react";
import { useEffect, type CSSProperties, type ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  /** Small uppercase line above the title (e.g. the category). */
  eyebrow?: string;
  /** Header background, e.g. the category color; text switches to dark ink on it. */
  accent?: string;
  /** Extra header content under the title (e.g. label chips). */
  headerExtra?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

export function Modal({ title, subtitle, eyebrow, accent, headerExtra, footer, onClose, wide, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start overflow-y-auto bg-black/70"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`mt-auto w-full border-2 border-ink bg-bg shadow-[0_24px_60px_rgba(0,0,0,.5)] md:m-auto md:p-0 ${wide ? "md:max-w-[880px]" : "md:max-w-[480px]"}`}
      >
        <div
          style={accent ? ({ "--cat": accent } as CSSProperties) : undefined}
          className={`flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-4 ${accent ? "bg-(--cat) text-on-cat" : ""}`}
        >
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-extrabold tracking-[.08em] uppercase">{eyebrow}</p>}
            <h2 className="truncate text-xl font-extrabold">{title}</h2>
            {subtitle && <p className={`text-[13px] ${accent ? "" : "text-muted"}`}>{subtitle}</p>}
            {headerExtra && <div className="mt-1.5">{headerExtra}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-current hover:border-ink hover:bg-ink hover:text-bg"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-[18px] p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-between gap-2.5 border-t-2 border-ink px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
