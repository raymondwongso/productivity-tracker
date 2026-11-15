import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NARROW, useMediaQuery } from "./use-media-query";

/** A controllable `matchMedia` stub: `set` changes the match and notifies listeners. */
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_: "change", cb: () => void) => listeners.add(cb),
    removeEventListener: (_: "change", cb: () => void) => listeners.delete(cb),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    listeners,
    set(next: boolean) {
      matches = next;
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("is false where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery(NARROW));
    expect(result.current).toBe(false);
  });

  it("reads the current match for the query", () => {
    const mq = stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(NARROW));
    expect(result.current).toBe(true);
    expect(mq.matchMedia).toHaveBeenCalledWith("(width < 48rem)");
  });

  it("follows changes and unsubscribes on unmount", () => {
    const mq = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => useMediaQuery(NARROW));
    expect(result.current).toBe(false);
    act(() => mq.set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(mq.listeners.size).toBe(0);
  });
});
