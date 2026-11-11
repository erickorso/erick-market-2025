import React from "react";
import { useI18n } from "../../context/I18nContext";
/**
 * A placeholder block. Not the shared Skeleton: that one is gray-800 in dark
 * mode, which vanishes on a gray-800 card, and a second dark:bg class on the
 * same element would leave the winner to CSS order.
 */
const Block: React.FC<{ className: string }> = ({ className }) => (
  <div className={`rounded bg-slate-200 dark:bg-gray-700 ${className}`} />
);

/** One card's shape, block for block (~545px, a loaded card without badges). */
const CardSkeleton: React.FC = () => (
  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-transparent dark:bg-gray-800 dark:shadow-2xl">
    <div>
      {/* title, price, day change */}
      <Block className="mb-1 h-7 w-3/4" />
      <Block className="mb-1 h-8 w-1/3" />
      <Block className="mb-2 h-5 w-1/4" />
      {/* tags, then where the history comes from */}
      <Block className="mb-2 h-5 w-2/3" />
      <Block className="mb-1 h-4 w-1/2" />
      {/* the chart's own box */}
      <Block className="mb-4 h-48 w-full rounded-lg" />
      <Block className="mb-4 h-4 w-24" />
    </div>
    {/* quantity, total, buy */}
    <div className="mt-auto">
      <Block className="mb-3 h-8 w-full" />
      <Block className="mb-3 h-5 w-1/3" />
      <Block className="h-10 w-full rounded-lg" />
    </div>
  </div>
);

/**
 * Stands in for the market grid while a page of quotes loads. The page used
 * to swap everything — heading and category filter included — for a spinner
 * on every search and category change: the page flashed, the filter button
 * just clicked was unmounted (keyboard focus fell back to the body), and the
 * heading, the page's LCP element, waited on the API. Now only the grid waits.
 */
const StockGridSkeleton: React.FC<{ cards?: number }> = ({ cards = 6 }) => {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="grid gap-6 motion-safe:animate-pulse [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]"
    >
      {Array.from({ length: cards }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};

export default StockGridSkeleton;
