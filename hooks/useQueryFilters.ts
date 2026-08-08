import { useEffect } from "react";
import type { CategoryId } from "../types";
import { parseCategory } from "../services/stockService";

/** Reads the shareable filters off the current URL. Safe outside the browser. */
export function readQueryFilters(): { q: string; category: CategoryId } {
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      q: sp.get("q")?.trim() ?? "",
      category: parseCategory(sp.get("category")),
    };
  } catch {
    return { q: "", category: "all" };
  }
}

/** Mirrors the filters back into the URL without pushing a history entry. */
export function writeQueryFilters(q: string, category: CategoryId) {
  try {
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    if (category && category !== "all") {
      url.searchParams.set("category", category);
    } else {
      url.searchParams.delete("category");
    }
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* history unavailable — filters simply stay out of the URL */
  }
}

/** Keeps the address bar in sync so the current view is linkable. */
export function useQueryFilters(searchTerm: string, category: CategoryId) {
  useEffect(() => {
    writeQueryFilters(searchTerm, category);
  }, [searchTerm, category]);
}
