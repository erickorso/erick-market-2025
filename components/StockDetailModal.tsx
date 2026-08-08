import React, { useEffect, useId, useState } from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import { fetchStockDetail, formatMarketCap, type StockDetail } from "../services/detailService";
import StockChart from "./Chart";
import { WATCHLIST } from "../server/watchlist";

function extractSymbol(detailSymbol: string, allCompanies: { company: string; symbol?: string }[]) {
  const upper = detailSymbol.toUpperCase();
  const fromList = allCompanies.find(
    (s) => s.symbol === upper || s.company.includes(`(${upper})`),
  );
  if (fromList?.symbol) return fromList.symbol;
  const watch = WATCHLIST.find((w) => w.symbol === upper);
  return watch?.symbol ?? upper;
}

const StockDetailModal: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const titleId = useId();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = Boolean(state.detailSymbol);

  useEffect(() => {
    if (!state.detailSymbol) {
      setDetail(null);
      setErr(null);
      return;
    }
    const symbol = extractSymbol(state.detailSymbol, state.allStocks);
    const seedStock = state.allStocks.find(
      (s) => s.symbol === symbol || s.company.includes(`(${symbol})`),
    );
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void fetchStockDetail(symbol, {
      company: seedStock?.company.replace(/\s*\([^)]+\)\s*$/, "") ?? undefined,
      tags: seedStock?.tags,
      quote: seedStock
        ? {
            price: seedStock.price,
            change: seedStock.change ?? 0,
            changePercent: seedStock.changePercent ?? 0,
            high: null,
            low: null,
            open: null,
            previousClose: null,
          }
        : undefined,
    }).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setErr(e instanceof Error ? e.message : t("detailLoadFailed"));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [state.detailSymbol, state.allStocks, t]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "CLOSE_DETAIL" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dispatch]);

  if (!open) return null;

  const q = detail?.quote;
  const up = (q?.changePercent ?? 0) >= 0;
  const chartLabel =
    detail?.chartSource === "finnhub"
      ? t("chartFinnhub")
      : detail?.chartSource === "yahoo"
        ? t("chartYahoo")
        : t("chartSimDetail");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => dispatch({ type: "CLOSE_DETAIL" })}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[61] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-700 bg-gray-900/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-400">
              {detail?.symbol ?? state.detailSymbol}
            </p>
            <h2 id={titleId} className="truncate text-xl font-semibold text-gray-100">
              {detail?.company ?? t("stockDetail")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "CLOSE_DETAIL" })}
            className="rounded-md border border-gray-600 px-2.5 py-1 text-sm text-gray-300 hover:border-teal-500 hover:text-teal-300"
            aria-label={t("closeDetail")}
          >
            {t("close")}
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {loading && (
            <div className="flex justify-center py-12" role="status" aria-label={t("loadingDetail")}>
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
            </div>
          )}
          {err && <p className="text-sm text-rose-400">{err}</p>}
          {!loading && detail && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-3xl font-bold text-gray-50">
                    ${detail.quote.price.toFixed(2)}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      up ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {up ? "+" : ""}
                    {detail.quote.change.toFixed(2)} ({up ? "+" : ""}
                    {detail.quote.changePercent.toFixed(2)}%)
                  </p>
                </div>
                <span className="rounded-md bg-gray-800 px-2 py-1 text-[11px] text-gray-400">
                  {t("quote")} · {detail.source}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t("open"), detail.quote.open],
                  [t("high"), detail.quote.high],
                  [t("low"), detail.quote.low],
                  [t("prevClose"), detail.quote.previousClose],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-md border border-gray-700 bg-gray-800/50 p-2.5">
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                      {label}
                    </dt>
                    <dd className="text-sm font-semibold text-gray-100">
                      {typeof val === "number" ? `$${val.toFixed(2)}` : "—"}
                    </dd>
                  </div>
                ))}
              </dl>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-200">
                    {t("priceHistory")}
                  </h3>
                  <span
                    className={`text-[11px] ${
                      detail.chartSource === "simulated"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {chartLabel}
                  </span>
                </div>
                <div className="h-56">
                  <StockChart
                    data={detail.chart}
                    lineColor={
                      detail.chartSource === "simulated" ? "#2dd4bf" : "#34d399"
                    }
                    height={220}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-200">{t("company")}</h3>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("exchange")}</dt>
                    <dd className="text-gray-200">{detail.profile.exchange ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("industry")}</dt>
                    <dd className="text-right text-gray-200">
                      {detail.profile.industry ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("marketCap")}</dt>
                    <dd className="text-gray-200">
                      {formatMarketCap(detail.profile.marketCap)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("ipo")}</dt>
                    <dd className="text-gray-200">{detail.profile.ipo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("country")}</dt>
                    <dd className="text-gray-200">{detail.profile.country ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                    <dt className="text-gray-500">{t("currency")}</dt>
                    <dd className="text-gray-200">{detail.profile.currency ?? "—"}</dd>
                  </div>
                </dl>
                {detail.profile.weburl && (
                  <a
                    href={detail.profile.weburl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-teal-400 hover:text-teal-300"
                  >
                    {t("companyWebsite")}
                  </a>
                )}
              </div>

              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-gray-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetailModal;
