"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Phones: below Tailwind's `md` breakpoint (48rem), the exact complement of `md:`. */
export const NARROW = "(width < 48rem)";

const media = (query: string): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query) : null;

/** Whether `query` matches, kept current; `false` on the server and where `matchMedia` is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = media(query);
      if (!mq) return () => {};
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => media(query)?.matches ?? false, () => false);
}
