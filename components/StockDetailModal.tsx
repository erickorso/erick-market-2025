import React, { useEffect, useId } from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";
import { formatMarketCap } from "../services/detailService";
import { useStockDetail } from "../hooks/useStockDetail";
import StockChart from "./Chart";
import DetailSkeleton from "./DetailSkeleton";
import TradePanel from "./TradePanel";

const StockDetailModal: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const titleId = useId();
  const { detail, liveQuote, tradeStock, loading, error } = useStockDetail(
    state.detailSymbol,
    state.allStocks,
  );

  const open = Boolean(state.detailSymbol);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "CLOSE_DETAIL" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dispatch]);

  if (!open) return null;

  const q = liveQuote;
  const up = (q?.changePercent ?? 0) >= 0;
  const chartLabel =
    detail?.chartSource === "finnhub"
      ? t("chartFinnhub")
      : detail?.chartSource === "yahoo"
        ? t("chartYahoo")
        : t("chartSimDetail");
  const symbol = detail?.symbol ?? state.detailSymbol ?? "stock";

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
        className="relative z-[61] grid max-h-[94vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-700 bg-gray-900 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-400">
              {detail?.symbol ?? state.detailSymbol}
            </p>
            <h2
              id={titleId}
              className="truncate text-xl font-semibold text-gray-100"
            >
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

        <div className="min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="min-w-0 space-y-5">
            {loading && !detail && <DetailSkeleton label={t("loadingDetail")} />}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            {detail && q && (
              <>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-3xl font-bold text-gray-50">
                      ${q.price.toFixed(2)}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        up ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {up ? "+" : ""}
                      {q.change.toFixed(2)} ({up ? "+" : ""}
                      {q.changePercent.toFixed(2)}%)
                    </p>
                  </div>
                  <span className="rounded-md bg-gray-800 px-2 py-1 text-[11px] text-gray-400">
                    {t("quote")} · {detail.source}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    [t("open"), q.open],
                    [t("high"), q.high],
                    [t("low"), q.low],
                    [t("prevClose"), q.previousClose],
                  ].map(([label, val]) => (
                    <div
                      key={String(label)}
                      className="rounded-md border border-gray-700 bg-gray-800/50 p-2.5"
                    >
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
                        detail.chartSource === "simulated"
                          ? "#2dd4bf"
                          : "#34d399"
                      }
                      height={220}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-200">
                    {t("company")}
                  </h3>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {[
                      [t("exchange"), detail.profile.exchange ?? "—"],
                      [t("industry"), detail.profile.industry ?? "—"],
                      [t("marketCap"), formatMarketCap(detail.profile.marketCap)],
                      [t("ipo"), detail.profile.ipo ?? "—"],
                      [t("country"), detail.profile.country ?? "—"],
                      [t("currency"), detail.profile.currency ?? "—"],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between gap-2 border-b border-gray-800 py-1.5"
                      >
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="text-right text-gray-200">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      {detail.profile.weburl && (
                        <a
                          href={detail.profile.weburl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-teal-400 hover:text-teal-300"
                        >
                          {t("companyWebsite")}
                        </a>
                      )}
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
                    </div>
                    {tradeStock && (
                      <TradePanel
                        stock={tradeStock}
                        tipId={`buy-tip-detail-${symbol}`}
                        size="sm"
                        resetKey={state.detailSymbol}
                        tooltipAlign="right"
                        className="ml-auto shrink-0"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDetailModal;
