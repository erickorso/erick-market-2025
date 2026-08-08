import React, { useEffect, useId, useRef } from "react";
import { useStockContext } from "../../context/StockContext";
import { useI18n } from "../../context/I18nContext";
import { formatMarketCap } from "../../services/detailService";
import { useStockDetail } from "../../hooks/useStockDetail";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useInertBackground } from "../../hooks/useInertBackground";
import Price from "../atoms/Price";
import ChangePercent from "../atoms/ChangePercent";
import ChartPanel from "../molecules/ChartPanel";
import StatCard from "../molecules/StatCard";
import TagList from "../molecules/TagList";
import DetailSkeleton from "../molecules/DetailSkeleton";
import TradePanel from "../molecules/TradePanel";

const StockDetailModal: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const titleId = useId();
  const { detail, liveQuote, tradeStock, loading, error } = useStockDetail(
    state.detailSymbol,
    state.allStocks,
  );

  const open = Boolean(state.detailSymbol);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  useInertBackground(open, overlayRef);

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
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      // Only a click on the backdrop itself dismisses. Testing the target
      // beats stopPropagation on the dialog, which would have meant putting a
      // click handler on a non-interactive element. Keyboard dismissal is
      // Escape, handled above.
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch({ type: "CLOSE_DETAIL" });
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-[61] grid max-h-[94vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-700 bg-gray-900 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-400">
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
            {loading && !detail && (
              <DetailSkeleton label={t("loadingDetail")} />
            )}
            {error && (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
            {detail && q && (
              <>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Price
                      value={q.price}
                      className="block text-3xl font-bold text-gray-50"
                    />
                    <p
                      className={`text-sm font-medium ${
                        up
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {up ? "+" : ""}
                      {q.change.toFixed(2)} (
                      <ChangePercent value={q.changePercent} />)
                    </p>
                  </div>
                  <span className="rounded-md bg-gray-800 px-2 py-1 text-[11px] text-slate-600 dark:text-gray-400">
                    {t("quote")} · {detail.source}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      [t("open"), q.open],
                      [t("high"), q.high],
                      [t("low"), q.low],
                      [t("prevClose"), q.previousClose],
                    ] as [string, number | null][]
                  ).map(([label, value]) => (
                    <StatCard key={label} label={label} value={value} />
                  ))}
                </dl>

                <ChartPanel
                  title={t("priceHistory")}
                  sourceLabel={chartLabel}
                  simulated={detail.chartSource === "simulated"}
                  data={detail.chart}
                  errorLabel={t("chartUnavailable")}
                />

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-200">
                    {t("company")}
                  </h3>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {[
                      [t("exchange"), detail.profile.exchange ?? "—"],
                      [t("industry"), detail.profile.industry ?? "—"],
                      [
                        t("marketCap"),
                        formatMarketCap(detail.profile.marketCap),
                      ],
                      [t("ipo"), detail.profile.ipo ?? "—"],
                      [t("country"), detail.profile.country ?? "—"],
                      [t("currency"), detail.profile.currency ?? "—"],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex justify-between gap-2 border-b border-gray-800 py-1.5"
                      >
                        <dt className="text-slate-600 dark:text-gray-400">
                          {label}
                        </dt>
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
                          className="text-sm text-teal-700 dark:text-teal-400 hover:text-teal-300"
                        >
                          {t("companyWebsite")}
                        </a>
                      )}
                      <TagList tags={detail.tags} />
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
