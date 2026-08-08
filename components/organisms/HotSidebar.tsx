import React from "react";
import { useHotStocks } from "../../hooks/useHotStocks";
import { useStockContext } from "../../context/StockContext";
import { useI18n } from "../../context/I18nContext";
import DisclaimerNote from "../molecules/DisclaimerNote";
import HotListItem from "../molecules/HotListItem";

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

  // Re-render on a timer so the "updated Ns ago" label keeps counting.
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
      className="relative z-20 w-full shrink-0 border-b border-slate-200 bg-white lg:flex lg:h-full lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-slate-200 dark:border-gray-700 dark:bg-gray-900 lg:dark:border-gray-700"
      aria-label={t("hotNow")}
    >
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
            {t("hotNow")}
          </h2>
          <span
            className={`text-[10px] font-medium ${
              mode === "socket"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-600 dark:text-gray-400"
            }`}
            title={`${Math.round(refreshMs / 60000)}m`}
          >
            {modeLabel}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-slate-600 dark:text-gray-400">
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
              <HotListItem
                rank={i + 1}
                symbol={s.symbol}
                company={s.company}
                price={s.price}
                changePercent={s.changePercent}
                onOpen={() =>
                  dispatch({ type: "OPEN_DETAIL", payload: s.symbol })
                }
              />
            </li>
          ))}
          {stocks.length === 0 && (
            <li className="py-4 text-xs text-slate-600 dark:text-gray-400">
              {t("hotLoading")}
            </li>
          )}
        </ol>
        <DisclaimerNote />
      </div>
    </aside>
  );
};

export default HotSidebar;
