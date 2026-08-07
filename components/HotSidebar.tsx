import React from "react";
import { useHotStocks } from "../hooks/useHotStocks";
import { useStockContext } from "../context/StockContext";
import { UI } from "../constants";

function formatAgo(at: number | null): string {
  if (!at) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

const HotSidebar: React.FC = () => {
  const { stocks, mode, updatedAt, error, refreshMs } = useHotStocks();
  const { dispatch } = useStockContext();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const modeLabel =
    mode === "socket" ? "WS · live" : mode === "poll" ? "Poll · 5m" : "Connecting…";

  return (
    <aside
      className="relative z-20 w-full shrink-0 border-b border-gray-700 bg-gray-900 lg:w-56 lg:border-b-0 lg:border-r lg:border-gray-700"
      aria-label="Hottest stocks today"
    >
      <div className="sticky top-16 p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-400">
            Hot now
          </h2>
          <span
            className={`text-[10px] font-medium ${
              mode === "socket" ? "text-emerald-400" : "text-gray-500"
            }`}
            title={`Refresh every ${Math.round(refreshMs / 60000)} min`}
          >
            {modeLabel}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-gray-500">
          Top day gainers · updated {formatAgo(updatedAt)}
        </p>
        {error && (
          <p className="mb-2 text-[11px] text-amber-500/90" role="status">
            {error}
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
                className="w-full rounded-md border border-gray-700/80 bg-gray-800/60 px-2.5 py-2 text-left transition hover:border-teal-600 hover:bg-gray-800 lg:rounded-none lg:border-0 lg:border-b lg:border-gray-700/60 lg:bg-transparent lg:px-0 lg:py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{i + 1}.</span>
                  <span className="flex-1 truncate text-sm font-semibold text-gray-100">
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
            <li className="py-4 text-xs text-gray-500">Loading movers…</li>
          )}
        </ol>
        <p
          className="mt-4 hidden border-t border-gray-800 pt-3 text-[10px] leading-relaxed text-gray-500 lg:block"
          role="note"
        >
          {UI.MARKET_DISCLAIMER}
        </p>
      </div>
    </aside>
  );
};

export default HotSidebar;
