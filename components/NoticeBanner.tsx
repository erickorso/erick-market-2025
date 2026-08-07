import React from "react";
import { useStockContext } from "../context/StockContext";

const NoticeBanner: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const notice = state.notice;
  if (!notice) return null;

  const colors =
    notice.type === "success"
      ? "bg-teal-600/95 border-teal-400"
      : notice.type === "error"
        ? "bg-red-700/95 border-red-400"
        : "bg-slate-700/95 border-slate-400";

  return (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm text-white shadow-lg ${colors}`}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1">{notice.message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          className="opacity-80 hover:opacity-100"
          onClick={() => dispatch({ type: "CLEAR_NOTICE" })}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NoticeBanner;
