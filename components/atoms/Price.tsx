import React from "react";

/** USD amount. `digits={0}` is used where space is tight, like the rank rows. */
const Price: React.FC<{
  value: number;
  digits?: number;
  className?: string;
}> = ({ value, digits = 2, className = "" }) => (
  <span className={className}>${value.toFixed(digits)}</span>
);

export default Price;
