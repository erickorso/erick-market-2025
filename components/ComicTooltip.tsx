import React from "react";

type ComicTooltipProps = {
  id?: string;
  children: React.ReactNode;
  /** Shown above the trigger (default) */
  open?: boolean;
  /**
   * Horizontal anchor. Use "right" when the trigger sits against the right edge
   * of a scroll container — a centered bubble would spill out and add an x
   * scrollbar.
   */
  align?: "center" | "right";
};

/**
 * Speech-bubble tooltip with a comic-style triangle pointer.
 * Parent must use `group` class; shows on hover/focus-within.
 */
export const ComicTooltip: React.FC<ComicTooltipProps> = ({
  id,
  children,
  align = "center",
}) => (
  <div
    id={id}
    role="tooltip"
    className={`pointer-events-none absolute bottom-[calc(100%+10px)] z-30 w-60 max-w-[min(15rem,calc(100vw-2rem))] scale-95 opacity-0 transition duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 ${
      align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
    }`}
  >
    <div className="relative rounded-xl border border-teal-500/40 bg-gradient-to-b from-gray-800 to-gray-950 px-3 py-2.5 text-left text-[11px] leading-snug text-gray-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      {children}
      {/* Outer triangle (border / outline) */}
      <span
        aria-hidden
        className={`absolute top-full -mt-px border-[9px] border-transparent border-t-teal-500/40 ${
          align === "right" ? "right-6" : "left-1/2 -translate-x-1/2"
        }`}
      />
      {/* Inner triangle */}
      <span
        aria-hidden
        className={`absolute top-full border-8 border-transparent border-t-gray-950 ${
          align === "right" ? "right-[1.5625rem]" : "left-1/2 -translate-x-1/2"
        }`}
      />
    </div>
  </div>
);

export default ComicTooltip;
