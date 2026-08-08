import React from "react";

type ComicTooltipProps = {
  id?: string;
  children: React.ReactNode;
  /** Shown above the trigger (default) */
  open?: boolean;
};

/**
 * Speech-bubble tooltip with a comic-style triangle pointer.
 * Parent must use `group` class; shows on hover/focus-within.
 */
export const ComicTooltip: React.FC<ComicTooltipProps> = ({
  id,
  children,
}) => (
  <div
    id={id}
    role="tooltip"
    className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-60 -translate-x-1/2 scale-95 opacity-0 transition duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
  >
    <div className="relative rounded-xl border border-teal-500/40 bg-gradient-to-b from-gray-800 to-gray-950 px-3 py-2.5 text-left text-[11px] leading-snug text-gray-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      {children}
      {/* Outer triangle (border / outline) */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-[9px] border-transparent border-t-teal-500/40"
      />
      {/* Inner triangle */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-gray-950"
      />
    </div>
  </div>
);

export default ComicTooltip;
