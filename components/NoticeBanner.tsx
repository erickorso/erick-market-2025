import React from "react";
import { useStockContext } from "../context/StockContext";

const NoticeBanner: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const notice = state.notice;
  if (!notice) return null;

  const colors =
    notice.type === "success"
      ? "border-teal-500/60 bg-teal-900/40 text-teal-100"
      : notice.type === "error"
        ? "border-rose-500/60 bg-rose-900/40 text-rose-100"
        : "border-slate-500/60 bg-slate-800/80 text-slate-100";

  return (
    <div
      role="status"
      className={`relative z-30 border-b px-4 py-2.5 ${colors}`}
    >
      <div className="container mx-auto flex max-w-5xl items-start gap-3 text-sm">
        <p className="flex-1">{notice.message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 opacity-80 hover:opacity-100"
          onClick={() => dispatch({ type: "CLEAR_NOTICE" })}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NoticeBanner;
