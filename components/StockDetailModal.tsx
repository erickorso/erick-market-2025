import React, { useEffect, useId, useMemo, useState } from "react";
import { useStockContext } from "../context/StockContext";
import { useUser } from "../context/UserContext";
import { useI18n } from "../context/I18nContext";
import {
  fetchStockDetail,
  formatMarketCap,
  type StockDetail,
} from "../services/detailService";
import type { EnrichedStock } from "../types";
import StockChart from "./Chart";
import ComicTooltip from "./ComicTooltip";
import { WATCHLIST } from "../server/watchlist";

function extractSymbol(
  detailSymbol: string,
  allCompanies: { company: string; symbol?: string }[],
) {
  const upper = detailSymbol.toUpperCase();
  const fromList = allCompanies.find(
    (s) => s.symbol === upper || s.company.includes(`(${upper})`),
  );
  if (fromList?.symbol) return fromList.symbol;
  const watch = WATCHLIST.find((w) => w.symbol === upper);
  return watch?.symbol ?? upper;
}

type DetailBuyPanelProps = {
  tipId: string;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  totalPrice: number;
  locked: boolean;
  canAfford: boolean;
  busy: boolean;
  onBuy: () => void;
  onLogin: () => void;
  className?: string;
};

const DetailBuyPanel: React.FC<DetailBuyPanelProps> = ({
  tipId,
  quantity,
  setQuantity,
  totalPrice,
  locked,
  canAfford,
  busy,
  onBuy,
  onLogin,
  className = "",
}) => {
  const { t } = useI18n();
  return (
    <div
      className={`flex w-full max-w-[14rem] flex-col items-stretch gap-2 ${className}`}
    >
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-400">{t("quantity")}</span>
        <div className="flex items-center">
          <button
            type="button"
            disabled={locked}
            onClick={() => setQuantity((p) => Math.max(1, p - 1))}
            aria-label={t("decAria")}
            className="rounded-l bg-red-600 px-2 py-0.5 text-sm font-bold text-white transition duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            -
          </button>
          <span className="min-w-[2rem] bg-gray-700 px-2 py-0.5 text-center text-sm text-gray-100">
            {quantity}
          </span>
          <button
            type="button"
            disabled={locked}
            onClick={() => setQuantity((p) => p + 1)}
            aria-label={t("incAria")}
            className="rounded-r bg-green-600 px-2 py-0.5 text-sm font-bold text-white transition duration-150 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <p className="text-right text-xs text-gray-300">
        {t("total")} ${totalPrice.toFixed(2)}
      </p>
      <div className="group relative">
        <button
          type="button"
          onClick={() => {
            if (locked) {
              onLogin();
              return;
            }
            onBuy();
          }}
          disabled={busy || (!locked && (!canAfford || quantity <= 0))}
          aria-describedby={tipId}
          className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition duration-300 ${
            !locked && canAfford && quantity > 0 && !busy
              ? "bg-teal-500 text-white hover:bg-teal-600"
              : locked
                ? "cursor-pointer bg-gray-600 text-gray-200 hover:bg-gray-500"
                : "cursor-not-allowed bg-gray-600 text-gray-400"
          }`}
        >
          {t("buy")} {!locked && !canAfford ? t("insufficientFunds") : ""}
        </button>
        <ComicTooltip id={tipId}>
          {locked
            ? t("buyTooltipGuest")
            : !canAfford
              ? t("buyTooltipFunds")
              : t("buyTooltipOk")}
        </ComicTooltip>
      </div>
      {locked && (
        <p className="text-right text-[10px] text-amber-300/90">
          <button
            type="button"
            onClick={onLogin}
            className="font-semibold text-teal-400 underline hover:text-teal-300"
          >
            {t("login")}
          </button>
        </p>
      )}
    </div>
  );
};

const StockDetailModal: React.FC = () => {
  const { state, dispatch, buyStock } = useStockContext();
  const { isAuthenticated, login } = useUser();
  const { t } = useI18n();
  const titleId = useId();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const open = Boolean(state.detailSymbol);

  useEffect(() => {
    setQuantity(1);
  }, [state.detailSymbol]);

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
    })
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setLoading(false);
      })
      .catch((e) => {
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

  const tradeStock = useMemo((): EnrichedStock | null => {
    if (!detail) return null;
    const fromList = state.allStocks.find(
      (s) =>
        s.symbol === detail.symbol ||
        s.company.includes(`(${detail.symbol})`),
    );
    if (fromList) {
      return { ...fromList, price: detail.quote.price };
    }
    return {
      id: detail.symbol.toLowerCase(),
      company: `${detail.company} (${detail.symbol})`,
      price: detail.quote.price,
      symbol: detail.symbol,
      chartData: detail.chart,
      chartSource:
        detail.chartSource === "yahoo" || detail.chartSource === "finnhub"
          ? detail.chartSource
          : "simulated",
      tags: detail.tags,
      change: detail.quote.change,
      changePercent: detail.quote.changePercent,
    };
  }, [detail, state.allStocks]);

  if (!open) return null;

  const q = detail?.quote;
  const up = (q?.changePercent ?? 0) >= 0;
  const chartLabel =
    detail?.chartSource === "finnhub"
      ? t("chartFinnhub")
      : detail?.chartSource === "yahoo"
        ? t("chartYahoo")
        : t("chartSimDetail");
  const locked = !isAuthenticated;
  const totalPrice = tradeStock ? tradeStock.price * quantity : 0;
  const canAfford = state.fund >= totalPrice;
  const symbol = detail?.symbol ?? state.detailSymbol ?? "stock";

  const handleBuy = async () => {
    if (!tradeStock || !isAuthenticated || busy) return;
    setBusy(true);
    try {
      await buyStock(tradeStock, quantity);
    } finally {
      setBusy(false);
    }
  };

  const buyProps = {
    quantity,
    setQuantity,
    totalPrice,
    locked,
    canAfford,
    busy,
    onBuy: () => {
      void handleBuy();
    },
    onLogin: login,
  };

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
        className="relative z-[61] grid max-h-[92vh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl sm:rounded-2xl"
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

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-5">
            {loading && (
              <div
                className="flex justify-center py-12"
                role="status"
                aria-label={t("loadingDetail")}
              >
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
                  <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                          <dt className="text-gray-500">{t("exchange")}</dt>
                          <dd className="text-gray-200">
                            {detail.profile.exchange ?? "—"}
                          </dd>
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
                          <dd className="text-gray-200">
                            {detail.profile.ipo ?? "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                          <dt className="text-gray-500">{t("country")}</dt>
                          <dd className="text-gray-200">
                            {detail.profile.country ?? "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-gray-800 py-1.5">
                          <dt className="text-gray-500">{t("currency")}</dt>
                          <dd className="text-gray-200">
                            {detail.profile.currency ?? "—"}
                          </dd>
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
                    {tradeStock && (
                      <DetailBuyPanel
                        {...buyProps}
                        tipId={`buy-tip-detail-${symbol}`}
                        className="justify-self-end sm:self-end"
                      />
                    )}
                  </div>
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
    </div>
  );
};

export default StockDetailModal;
