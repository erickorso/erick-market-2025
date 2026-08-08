import React, { useState } from "react";
import { useI18n } from "../../context/I18nContext";

/** Collapsible "not financial advice" note at the foot of the hot sidebar. */
const DisclaimerNote: React.FC = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mt-4 hidden border-t border-gray-800 pt-3 lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded text-teal-500/90 hover:text-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-expanded={open}
        aria-controls="hot-disclaimer"
        title={t("disclaimer")}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Info
        </span>
      </button>
      {open && (
        <p
          id="hot-disclaimer"
          role="note"
          className="mt-2 text-[10px] leading-relaxed text-gray-500"
        >
          {t("disclaimer")}
        </p>
      )}
    </div>
  );
};

export default DisclaimerNote;
