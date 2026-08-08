import React from "react";

type Variant = "outline" | "warning" | "live" | "muted";
type Size = "xs" | "sm";

const variants: Record<Variant, string> = {
  outline: "rounded border border-gray-600 text-slate-600 dark:text-gray-400",
  warning:
    "rounded border border-amber-500/40 bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-300",
  // The tinted pills need a dark foreground on a light background: teal-300 on
  // a light teal tint measures 1.14:1.
  live: "rounded-full bg-teal-700/15 font-medium text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
  muted:
    "rounded-full bg-slate-500/20 font-medium text-slate-700 dark:text-slate-300",
};

const sizes: Record<Size, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-[10px]",
};

/** Small pill used for style tags, data-source labels and quote warnings. */
const Badge: React.FC<{
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}> = ({ variant = "outline", size = "sm", className = "", children }) => (
  <span
    className={`inline-flex uppercase tracking-wide ${variants[variant]} ${sizes[size]} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
