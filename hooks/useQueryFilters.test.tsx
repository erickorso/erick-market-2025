import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readQueryFilters,
  useQueryFilters,
  writeQueryFilters,
} from "./useQueryFilters";
import type { CategoryId } from "../types";

function setUrl(search: string) {
  window.history.replaceState({}, "", `/${search}`);
}

beforeEach(() => {
  setUrl("");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readQueryFilters", () => {
  it("defaults to an empty search and all categories", () => {
    expect(readQueryFilters()).toEqual({ q: "", category: "all" });
  });

  it("reads both filters off the URL", () => {
    setUrl("?q=AAPL&category=growth");
    expect(readQueryFilters()).toEqual({ q: "AAPL", category: "growth" });
  });

  it("trims the search term", () => {
    setUrl("?q=%20%20AAPL%20%20");
    expect(readQueryFilters().q).toBe("AAPL");
  });

  it("falls back to all for an unknown category", () => {
    setUrl("?category=nonsense");
    expect(readQueryFilters().category).toBe("all");
  });
});

describe("writeQueryFilters", () => {
  it("writes both filters", () => {
    writeQueryFilters("AAPL", "growth");
    expect(window.location.search).toBe("?q=AAPL&category=growth");
  });

  it("omits an empty search", () => {
    writeQueryFilters("", "growth");
    expect(window.location.search).toBe("?category=growth");
  });

  it("omits the default category", () => {
    writeQueryFilters("AAPL", "all");
    expect(window.location.search).toBe("?q=AAPL");
  });

  it("clears the URL when nothing is filtered", () => {
    setUrl("?q=AAPL&category=growth");
    writeQueryFilters("", "all");
    expect(window.location.search).toBe("");
  });

  it("replaces rather than pushes, so Back does not walk filters", () => {
    const push = vi.spyOn(window.history, "pushState");
    writeQueryFilters("AAPL", "all");
    expect(push).not.toHaveBeenCalled();
  });

  it("swallows a history failure instead of breaking the render", () => {
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => writeQueryFilters("AAPL", "growth")).not.toThrow();
  });
});

describe("useQueryFilters", () => {
  it("mirrors the current filters into the URL", () => {
    renderHook(() => useQueryFilters("MSFT", "dividend"));
    expect(window.location.search).toBe("?q=MSFT&category=dividend");
  });

  it("updates the URL when the filters change", () => {
    const { rerender } = renderHook(
      ({ q, c }: { q: string; c: CategoryId }) => useQueryFilters(q, c),
      { initialProps: { q: "MSFT", c: "dividend" as CategoryId } },
    );

    rerender({ q: "NVDA", c: "growth" });
    expect(window.location.search).toBe("?q=NVDA&category=growth");
  });
});
