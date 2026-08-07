import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";

const COLLAPSE_KEY = "erick-market.rank-sidebar.collapsed";

const RankSidebar: React.FC = () => {
  const { entries, month, player, previousWinner, refresh } = useLeague();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const top10 = entries.slice(0, 10);

  if (collapsed) {
    return (
      <aside
        className="relative z-20 flex w-full shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-3 py-2 lg:w-10 lg:flex-col lg:justify-start lg:gap-3 lg:border-b-0 lg:border-l lg:px-1 lg:py-4"
        aria-label="Top 10 ranking collapsed"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400 hover:bg-gray-800 hover:text-amber-300 lg:writing-mode-vertical lg:[writing-mode:vertical-rl] lg:rotate-180"
          aria-expanded={false}
          title="Expand Top 10"
        >
          Top 10
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-gray-400 hover:text-teal-300"
          aria-label="Expand ranking sidebar"
        >
          «
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="relative z-20 w-full shrink-0 border-b border-gray-700 bg-gray-900 lg:w-56 lg:border-b-0 lg:border-l lg:border-gray-700"
      aria-label="Top 10 monthly ranking"
    >
      <div className="sticky top-16 p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">
            Top 10
          </h2>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            aria-expanded={true}
            aria-label="Collapse ranking sidebar"
          >
            Collapse »
          </button>
        </div>
        <p className="mb-3 text-[11px] text-gray-500">
          Month {month} · equity rank
        </p>

        {previousWinner && (
          <p className="mb-3 rounded border border-amber-500/30 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-200/90">
            Last winner: <span className="font-semibold">{previousWinner.name}</span>
          </p>
        )}

        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
          {top10.map((e, i) => {
            const mine = player?.id === e.playerId;
            return (
              <li key={e.playerId} className="min-w-[9.5rem] lg:min-w-0">
                <div
                  className={`rounded-md border px-2.5 py-2 lg:rounded-none lg:border-0 lg:border-b lg:border-gray-700/60 lg:px-0 lg:py-2 ${
                    mine
                      ? "border-teal-600/50 bg-teal-950/40"
                      : "border-gray-700/80 bg-gray-800/60 lg:bg-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{i + 1}.</span>
                    <span className="flex-1 truncate text-sm font-semibold text-gray-100">
                      {e.name}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        e.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {e.pnlPercent >= 0 ? "+" : ""}
                      {e.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-0.5 text-right text-[11px] text-gray-500">
                    ${e.equity.toFixed(0)}
                  </div>
                </div>
              </li>
            );
          })}
          {top10.length === 0 && (
            <li className="py-3 text-xs text-gray-500">
              No scores yet.{" "}
              <Link to="/league" className="text-teal-400 hover:text-teal-300">
                Join Play
              </Link>
            </li>
          )}
        </ol>

        <Link
          to="/league"
          className="mt-4 inline-block text-[11px] font-medium text-teal-400 hover:text-teal-300"
        >
          Full league →
        </Link>
      </div>
    </aside>
  );
};

export default RankSidebar;
