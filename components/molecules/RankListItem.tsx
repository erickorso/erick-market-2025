import React from "react";
import ChangePercent from "../atoms/ChangePercent";
import Price from "../atoms/Price";

/** One row of the monthly league board. Highlighted when it is the viewer. */
const RankListItem: React.FC<{
  rank: number;
  name: string;
  equity: number;
  pnlPercent: number;
  mine: boolean;
}> = ({ rank, name, equity, pnlPercent, mine }) => (
  <div
    className={`rounded-md border px-2.5 py-2 lg:rounded-none lg:border-0 lg:border-b lg:border-slate-200 lg:px-0 lg:py-2 dark:lg:border-gray-700/60 ${
      mine
        ? "border-teal-500/50 bg-teal-50 dark:border-teal-600/50 dark:bg-teal-950/40"
        : "border-slate-200 bg-slate-50 lg:bg-transparent dark:border-gray-700/80 dark:bg-gray-800/60"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400 dark:text-gray-500">{rank}.</span>
      <span className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-gray-100">
        {name}
      </span>
      <ChangePercent
        value={pnlPercent}
        digits={1}
        className="text-xs font-medium"
      />
    </div>
    <div className="mt-0.5 text-right text-[11px] text-gray-500">
      <Price value={equity} digits={0} />
    </div>
  </div>
);

export default RankListItem;
