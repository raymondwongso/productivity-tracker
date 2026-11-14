"use client";

import { useCallback, useState } from "react";

/** Width of an element, kept current with a ResizeObserver; `fallback` until it is measured. */
export function useWidth<T extends HTMLElement>(fallback = 700) {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width || fallback] as const;
}
