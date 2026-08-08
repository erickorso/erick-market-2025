import React, { useEffect, useId, useRef } from "react";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { useI18n } from "../../context/I18nContext";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useInertBackground } from "../../hooks/useInertBackground";

/**
 * Asks before leaving for Auth0. Same dialog mechanics as the detail modal:
 * focus is trapped and restored, Escape and the backdrop dismiss, and the page
 * behind is inert while it is up.
 */
const AuthPromptModal: React.FC = () => {
  const { reason, confirm, dismiss } = useAuthPrompt();
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();

  const open = reason !== null;
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  useInertBackground(open, overlayRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  const expired = reason === "sessionExpired";
  const body = expired
    ? t("sessionExpiredBody")
    : reason === "league"
      ? t("authPromptLeagueBody")
      : t("authPromptTradeBody");

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center shadow-2xl outline-none"
      >
        <h2 id={titleId} className="mb-2 text-lg font-semibold text-gray-100">
          {expired ? t("sessionExpiredTitle") : t("loginRequiredTitle")}
        </h2>
        <p id={bodyId} className="mb-5 text-sm text-slate-300">
          {body}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white"
          >
            {t("notNow")}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {expired ? t("signInAgain") : t("login")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPromptModal;
