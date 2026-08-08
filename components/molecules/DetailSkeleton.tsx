import React from "react";
import Skeleton from "../atoms/Skeleton";

/**
 * Mirrors the loaded detail layout block by block (price, stat cards, chart,
 * company rows, trade row) so the modal barely changes height when the data
 * lands.
 */
const DetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="space-y-5 motion-safe:animate-pulse" role="status" aria-label={label}>
    <div className="space-y-1">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <Skeleton key={item} bordered className="h-[3.625rem]" />
      ))}
    </div>
    <div>
      <Skeleton className="mb-2 h-5 w-28" />
      <Skeleton bordered className="h-56 rounded-lg" />
    </div>
    <div>
      <Skeleton className="mb-2 h-5 w-24" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="h-[2.0625rem] border-b border-gray-800 bg-gray-800/40"
          />
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[1.3125rem] w-40" />
        </div>
        <Skeleton className="h-[5.875rem] w-[13rem] bg-gray-800/60" />
      </div>
    </div>
  </div>
);

export default DetailSkeleton;
