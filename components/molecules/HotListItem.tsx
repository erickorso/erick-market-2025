import React from "react";
import ChangePercent from "../atoms/ChangePercent";
import Price from "../atoms/Price";

/** One row of the top-gainers sidebar. Opens the detail modal on click. */
const HotListItem: React.FC<{
  rank: number;
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
  onOpen: () => void;
}> = ({ rank, symbol, company, price, changePercent, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-teal-500 hover:bg-teal-50 lg:rounded-none lg:border-0 lg:border-b lg:border-slate-200 lg:bg-transparent lg:px-[2px] lg:py-2.5 dark:border-gray-700/80 dark:bg-gray-800/60 dark:hover:border-teal-600 dark:hover:bg-gray-800 lg:dark:border-gray-700/60"
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400 dark:text-gray-500">{rank}.</span>
      <span className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-gray-100">
        {symbol}
      </span>
      <ChangePercent value={changePercent} className="text-xs font-medium" />
    </div>
    <div className="mt-0.5 flex justify-between gap-2 text-[11px] text-gray-500">
      <span className="truncate">{company}</span>
      <Price value={price} />
    </div>
  </button>
);

export default HotListItem;
