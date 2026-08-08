import React from "react";
import { useHotStocks } from "../hooks/useHotStocks";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";

function formatAgo(at: number | null): string {
  if (!at) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m`;
}

const HotSidebar: React.FC = () => {
  const { stocks, mode, updatedAt, error, refreshMs } = useHotStocks();
  const { dispatch } = useStockContext();
  const { t } = useI18n();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const modeLabel =
    mode === "socket"
      ? "WS · live"
      : mode === "poll"
        ? "Poll · 5m"
        : t("connecting");

  return (
    <aside
      className="relative z-20 w-full shrink-0 border-b border-slate-200 bg-white lg:w-56 lg:border-b-0 lg:border-r lg:border-slate-200 dark:border-gray-700 dark:bg-gray-900 lg:dark:border-gray-700"
      aria-label={t("hotNow")}
    >
      <div className="sticky top-16 p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-400">
            {t("hotNow")}
          </h2>
          <span
            className={`text-[10px] font-medium ${
              mode === "socket" ? "text-emerald-400" : "text-gray-500"
            }`}
            title={`${Math.round(refreshMs / 60000)}m`}
          >
            {modeLabel}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-gray-500">
          {t("hotSub")} {formatAgo(updatedAt)}
        </p>
        {error && (
          <p className="mb-2 text-[11px] text-amber-500/90" role="status">
            {t("hotOffline")}
          </p>
        )}
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
          {stocks.map((s, i) => (
            <li key={s.symbol} className="min-w-[9.5rem] lg:min-w-0">
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "OPEN_DETAIL", payload: s.symbol })
                }
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-teal-500 hover:bg-teal-50 lg:rounded-none lg:border-0 lg:border-b lg:border-slate-200 lg:bg-transparent lg:px-0 lg:py-2.5 dark:border-gray-700/80 dark:bg-gray-800/60 dark:hover:border-teal-600 dark:hover:bg-gray-800 lg:dark:border-gray-700/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 dark:text-gray-500">{i + 1}.</span>
                  <span className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-gray-100">
                    {s.symbol}
                  </span>
                  <span className="text-xs font-medium text-emerald-400">
                    +{s.changePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-0.5 flex justify-between gap-2 text-[11px] text-gray-500">
                  <span className="truncate">{s.company}</span>
                  <span>${s.price.toFixed(2)}</span>
                </div>
              </button>
            </li>
          ))}
          {stocks.length === 0 && (
            <li className="py-4 text-xs text-gray-500">{t("hotLoading")}</li>
          )}
        </ol>
        <DisclaimerNote />
      </div>
    </aside>
  );
};

function DisclaimerNote() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative mt-4 hidden border-t border-gray-800 pt-3 lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded text-teal-500/90 hover:text-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-expanded={open}
        aria-controls="hot-disclaimer"
        title={t("disclaimer")}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Info
        </span>
      </button>
      {open && (
        <p
          id="hot-disclaimer"
          role="note"
          className="mt-2 text-[10px] leading-relaxed text-gray-500"
        >
          {t("disclaimer")}
        </p>
      )}
    </div>
  );
}

export default HotSidebar;
