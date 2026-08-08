import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

type Listener = (e: { matches: boolean }) => void;

function stubMatchMedia({
  matches = false,
  legacy = false,
}: { matches?: boolean; legacy?: boolean } = {}) {
  const listeners: Listener[] = [];
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: legacy
      ? undefined
      : (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: legacy
      ? undefined
      : (_: string, fn: Listener) => {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        },
    addListener: (fn: Listener) => listeners.push(fn),
    removeListener: (fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return { listeners, mql };
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
});

describe("useReducedMotion", () => {
  it("is false when the visitor has expressed no preference", () => {
    stubMatchMedia({ matches: false });
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("is true when the OS asks for reduced motion", () => {
    stubMatchMedia({ matches: true });
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("reacts to the setting changing, without a reload", () => {
    const { listeners } = stubMatchMedia({ matches: false });
    const { result } = renderHook(() => useReducedMotion());

    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(result.current).toBe(true);

    act(() => listeners.forEach((fn) => fn({ matches: false })));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const { listeners } = stubMatchMedia();
    const { unmount } = renderHook(() => useReducedMotion());

    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });

  it("falls back to the legacy listener API for older Safari", () => {
    const { listeners } = stubMatchMedia({ matches: false, legacy: true });
    const { result, unmount } = renderHook(() => useReducedMotion());

    expect(listeners).toHaveLength(1);
    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(result.current).toBe(true);

    unmount();
    expect(listeners).toHaveLength(0);
  });

  it("assumes motion is fine where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });
});
