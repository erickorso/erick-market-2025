import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import {
  dictionaries,
  formatMsg,
  type Lang,
  type MsgKey,
} from "../../i18n/locales";

export type ThemeMode = "system" | "light" | "dark";

const LANG_STORE = "erick-market.lang";
const THEME_STORE = "erick-market.theme-mode";

type PrefsValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
  themeMode: ThemeMode;
  setThemeMode: (next: ThemeMode) => void;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
  /** False until storage has answered, so nothing renders in the wrong language. */
  ready: boolean;
};

const PrefsContext = createContext<PrefsValue | null>(null);

/** The phone's language, if it is one this app speaks. */
function deviceLang(): Lang {
  const tag = getLocales()[0]?.languageCode ?? "en";
  return tag === "es" ? "es" : "en";
}

/**
 * Language and theme, persisted.
 *
 * The web keeps both in localStorage and the mobile app had neither — the
 * theme followed the OS with no way to override it, and every string was
 * hardcoded English. The translations come from the same dictionary the web
 * uses: two translation files is how the two clients end up saying different
 * things in Spanish.
 */
export const PrefsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(deviceLang);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedLang, storedTheme] = await AsyncStorage.multiGet([
        LANG_STORE,
        THEME_STORE,
      ]);
      if (cancelled) return;
      if (storedLang[1] === "en" || storedLang[1] === "es") {
        setLangState(storedLang[1]);
      }
      const theme = storedTheme[1];
      if (theme === "light" || theme === "dark" || theme === "system") {
        setThemeModeState(theme);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void AsyncStorage.setItem(LANG_STORE, next);
  }, []);

  const toggleLang = useCallback(
    () => setLang(lang === "en" ? "es" : "en"),
    [lang, setLang],
  );

  const setThemeMode = useCallback((next: ThemeMode) => {
    setThemeModeState(next);
    void AsyncStorage.setItem(THEME_STORE, next);
  }, []);

  const t = useCallback(
    (key: MsgKey, vars?: Record<string, string | number>) =>
      // Falls through to English rather than showing a raw key: a missing
      // translation should read as untranslated, not as broken.
      formatMsg(dictionaries[lang][key] ?? dictionaries.en[key] ?? key, vars),
    [lang],
  );

  const value = useMemo<PrefsValue>(
    () => ({ lang, setLang, toggleLang, themeMode, setThemeMode, t, ready }),
    [lang, setLang, toggleLang, themeMode, setThemeMode, t, ready],
  );

  return (
    <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
  );
};

export const usePrefs = () => {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
};

/** Convenience for the common case of only needing the translator. */
export const useT = () => usePrefs().t;
