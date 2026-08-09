import React, { useEffect, useState } from "react";
import { useLeague } from "../../context/LeagueContext";
import { useI18n } from "../../context/I18nContext";
import RankListItem from "../molecules/RankListItem";
import ProtectedLink from "../molecules/ProtectedLink";

const COLLAPSE_KEY = "erick-market.rank-sidebar.collapsed";

const RankSidebar: React.FC = () => {
  const { entries, month, player, previousWinner, refresh, unpriced } =
    useLeague();
  const { t } = useI18n();
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
        className="relative z-20 flex w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2 lg:h-full lg:w-10 lg:flex-col lg:justify-start lg:gap-3 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-slate-200 lg:px-1 lg:py-4 dark:border-gray-700 dark:bg-gray-900"
        aria-label={t("top10")}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 hover:bg-gray-800 hover:text-amber-700 dark:text-amber-300 lg:[writing-mode:vertical-rl] lg:rotate-180"
          aria-expanded={false}
          title={t("expandTop10")}
        >
          {t("top10")}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-slate-600 dark:text-gray-400 hover:text-teal-300"
          aria-label={t("expandTop10")}
        >
          «
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="relative z-20 w-full shrink-0 border-b border-slate-200 bg-white lg:flex lg:h-full lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-slate-200 dark:border-gray-700 dark:bg-gray-900 lg:dark:border-gray-700"
      aria-label={t("top10")}
    >
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {t("top10")}
          </h2>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded px-1 py-0.5 text-lg leading-none text-slate-600 hover:bg-gray-800 hover:text-gray-300 dark:text-gray-400"
            aria-expanded={true}
            aria-label={t("collapse")}
            title={t("collapse")}
          >
            {/* Icon only — the label lives in aria-label and the tooltip, so
                screen readers and hover still get the full word. */}
            <span aria-hidden>»</span>
          </button>
        </div>
        <p className="mb-3 text-[11px] text-slate-600 dark:text-gray-400">
          {t("monthEquity", { month })}
        </p>

        {/* The server refuses to publish a rank it cannot price. Saying so is
            the other half of that: a rank that quietly stops moving reads as a
            broken app, or gets believed. */}
        {unpriced.length > 0 && (
          <p
            role="status"
            className="mb-3 rounded border border-amber-500/30 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-800 dark:text-amber-200/90"
          >
            {t("rankStale", { symbols: unpriced.join(", ") })}
          </p>
        )}

        {previousWinner && (
          <p className="mb-3 rounded border border-amber-500/30 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-200/90">
            {t("lastWinner")}{" "}
            <span className="font-semibold">{previousWinner.name}</span>
          </p>
        )}

        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
          {top10.map((e, i) => (
            <li key={e.playerId} className="min-w-[9.5rem] lg:min-w-0">
              <RankListItem
                rank={i + 1}
                name={e.name}
                equity={e.equity}
                pnlPercent={e.pnlPercent}
                mine={player?.id === e.playerId}
              />
            </li>
          ))}
          {top10.length === 0 && (
            <li className="py-3 text-xs text-slate-600 dark:text-gray-400">
              {t("noScoresYet")}{" "}
              <ProtectedLink
                to="/league"
                reason="league"
                className="text-teal-700 dark:text-teal-400 hover:text-teal-300"
              >
                {t("joinPlay")}
              </ProtectedLink>
            </li>
          )}
        </ol>

        <ProtectedLink
          to="/league"
          reason="league"
          className="mt-4 inline-block text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:text-teal-300"
        >
          {t("fullLeague")}
        </ProtectedLink>
      </div>
    </aside>
  );
};

export default RankSidebar;
