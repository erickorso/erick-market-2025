import React from "react";
import { useStockContext } from "../context/StockContext";
import { useI18n } from "../context/I18nContext";

const NoticeBanner: React.FC = () => {
  const { state, dispatch } = useStockContext();
  const { t } = useI18n();
  const notice = state.notice;
  if (!notice) return null;

  const colors =
    notice.type === "success"
      ? "border-teal-500/60 bg-teal-900/90 text-teal-100"
      : notice.type === "error"
        ? "border-rose-500/60 bg-rose-900/90 text-rose-100"
        : "border-slate-500/60 bg-slate-800/95 text-slate-100";

  return (
    <div
      role="status"
      className={`pointer-events-none absolute left-0 right-0 top-full z-40 px-3 pt-2 sm:px-4`}
    >
      <div
        className={`pointer-events-auto mx-auto flex max-w-5xl items-start gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm ${colors}`}
      >
        <p className="flex-1">{notice.message}</p>
        <button
          type="button"
          aria-label={t("dismiss")}
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
