import { useEffect, useState } from "react";
import { LIVE_POLL_MS } from "../constants";
import { fetchQuotes, type DataSource } from "../services/stockService";
import { symbolFromStock } from "../services/symbols";
import type { EnrichedStock } from "../types";

type Loaded = {
  /** The symbol list these quotes were fetched for. */
  key: string;
  quotes: Map<string, EnrichedStock>;
  source: DataSource;
};

const NONE = new Map<string, EnrichedStock>();

/**
 * Live quotes for the watchlist, refreshed on the catalog's live cadence.
 *
 * The result is stored with the list it answers, so "loading" is derived
 * rather than set: a new list is loading until its own answer lands, while
 * the previous quotes stay on screen instead of flashing empty.
 */
export function useWatchlistQuotes(symbols: string[]): {
  quotes: Map<string, EnrichedStock>;
  loading: boolean;
  source?: DataSource;
} {
  const key = symbols.join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = async () => {
      const result = await fetchQuotes(key.split(","));
      if (cancelled) return;
      setLoaded({
        key,
        quotes: new Map(result.stocks.map((s) => [symbolFromStock(s), s])),
        source: result.source,
      });
    };
    void load();
    const id = window.setInterval(() => void load(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [key]);

  if (!key) return { quotes: NONE, loading: false };
  return {
    quotes: loaded?.quotes ?? NONE,
    loading: loaded?.key !== key,
    source: loaded?.source,
  };
}
