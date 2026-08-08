import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LANG_KEY,
  dictionaries,
  formatMsg,
  type Lang,
  type MsgKey,
} from "../i18n/locales";

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "es" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(() => readLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "es" : "en");
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: MsgKey, vars?: Record<string, string | number>) =>
      formatMsg(dictionaries[lang][key] ?? dictionaries.en[key] ?? key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
