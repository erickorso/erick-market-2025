import { useEffect, useMemo, useRef, useState } from "react";
import type { EnrichedStock } from "../types";
import { fetchStockDetail, type StockDetail } from "../services/detailService";
import { findBySymbol, resolveDetailSymbol } from "../services/symbols";

/**
 * Loads the detail payload for the open symbol.
 *
 * The catalog is polled every few seconds in live mode, so it is read through
 * a ref: including it in the effect deps would blank the modal and refetch on
 * every tick. Fresh prices arrive instead through `liveQuote`, which overlays
 * the polled quote on the loaded payload without remounting the chart.
 */
export function useStockDetail(
  detailSymbol: string | null,
  catalog: EnrichedStock[],
) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  useEffect(() => {
    if (!detailSymbol) {
      setDetail(null);
      setError(null);
      return;
    }
    const stocks = catalogRef.current;
    const symbol = resolveDetailSymbol(detailSymbol, stocks);
    const seed = findBySymbol(stocks, symbol);
    let cancelled = false;

    setLoading(true);
    setDetail(null);
    setError(null);
    void fetchStockDetail(symbol, {
      company: seed?.company.replace(/\s*\([^)]+\)\s*$/, "") ?? undefined,
      tags: seed?.tags,
      quote: seed
        ? {
            price: seed.price,
            change: seed.change ?? 0,
            changePercent: seed.changePercent ?? 0,
            high: null,
            low: null,
            open: null,
            previousClose: null,
          }
        : undefined,
    })
      .then((loaded) => {
        if (cancelled) return;
        setDetail(loaded);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "detail load failed");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailSymbol]);

  const listed = useMemo(
    () => (detail ? findBySymbol(catalog, detail.symbol) : undefined),
    [detail, catalog],
  );

  const liveQuote = useMemo(() => {
    if (!detail) return null;
    if (!listed) return detail.quote;
    return {
      ...detail.quote,
      price: listed.price,
      change: listed.change ?? detail.quote.change,
      changePercent: listed.changePercent ?? detail.quote.changePercent,
    };
  }, [detail, listed]);

  const tradeStock = useMemo((): EnrichedStock | null => {
    if (!detail || !liveQuote) return null;
    if (listed) return { ...listed, price: liveQuote.price };
    return {
      id: detail.symbol.toLowerCase(),
      company: `${detail.company} (${detail.symbol})`,
      price: liveQuote.price,
      symbol: detail.symbol,
      chartData: detail.chart,
      chartSource:
        detail.chartSource === "yahoo" || detail.chartSource === "finnhub"
          ? detail.chartSource
          : "simulated",
      tags: detail.tags,
      change: liveQuote.change,
      changePercent: liveQuote.changePercent,
    };
  }, [detail, listed, liveQuote]);

  return { detail, liveQuote, tradeStock, loading, error };
}
