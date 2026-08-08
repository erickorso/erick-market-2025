import React from "react";

/**
 * Placeholder block. Sizing comes from the caller so a skeleton can mirror the
 * real layout it stands in for.
 */
const Skeleton: React.FC<{ className?: string; bordered?: boolean }> = ({
  className = "",
  bordered = false,
}) => (
  <div
    className={`${
      bordered
        ? "rounded-md border border-gray-700 bg-gray-800/60"
        : "rounded bg-gray-800"
    } ${className}`}
  />
);

export default Skeleton;
