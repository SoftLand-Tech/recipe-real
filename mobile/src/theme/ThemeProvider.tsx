import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import * as Updates from "expo-updates";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, I18nManager, useColorScheme } from "react-native";

import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { DarkColors, LightColors, type ThemeColors } from "./colors";

/** User-facing theme preference. "system" follows the OS color scheme. */
export type ThemePref = "system" | "light" | "dark";

/** User-facing language preference. "system" follows the device locale. */
export type LangPref = "system" | "en" | "ar";

/** Resolved UI language. */
export type Lang = "en" | "ar";

/** Resolved layout direction. */
export type LangDir = "ltr" | "rtl";

const STORAGE_KEY = "recipereal.themePref";
/** Exported for the root layout's pre-splash RTL bootstrap. */
export const LANG_STORAGE_KEY = "recipereal.langPref";

interface ThemeContextValue {
  /** Persisted preference (defaults to "system" until loaded). */
  pref: ThemePref;
  /** Set and persist a new preference. */
  setPref: (pref: ThemePref) => void;
  /** Preference resolved against the OS scheme. */
  scheme: "light" | "dark";
  /** Palette for the resolved scheme. */
  colors: ThemeColors;
  /** Persisted language preference (defaults to "system" until loaded). */
  langPref: LangPref;
  /**
   * Set and persist the language preference. When the RESOLVED direction
   * changes (en↔ar), flips the native RTL flag and reloads the app
   * immediately (seamless — no dialog) — layout direction only takes
   * effect after a JS reload.
   */
  setLangPref: (pref: LangPref) => void;
  /** Language resolved from the preference (system → device locale). */
  lang: Lang;
  /** Layout direction for the resolved language. */
  dir: LangDir;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Resolve the device locale to a supported language (ar_* → ar, else en). */
function resolveSystemLang(): Lang {
  try {
    const locale = Localization.getLocales()[0];
    const code = (locale?.languageCode ?? locale?.languageTag ?? "").toLowerCase();
    if (code.startsWith("ar")) return "ar";
  } catch {
    // Localization unavailable: fall back to English.
  }
  return "en";
}

/**
 * Seamlessly apply a layout-direction flip: native RTL only takes effect
 * after a JS reload, so reload the app IMMEDIATELY (no dialog, no user
 * action — the reload completes in ~1-2s and IS the UX). When expo-updates
 * can't reload (e.g. Expo Go), fall back to instructing a manual restart,
 * shown in the language just switched TO.
 */
function reloadForDirectionChange(nextLang: Lang): void {
  Updates.reloadAsync().catch(() => {
    const dict = nextLang === "ar" ? ar : en;
    Alert.alert(dict["restart.manualTitle"], dict["restart.manualMessage"]);
  });
}

/**
 * Provides the app-wide theme + language preferences (both persisted in
 * AsyncStorage) and the resolved palette / language / direction. Must wrap
 * everything that calls `useThemeColors()` / `useT()` / `useLang()`.
 */
export function ThemePrefProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [langPref, setLangPrefState] = useState<LangPref>("system");
  const systemScheme = useColorScheme();

  // The device locale is stable for a session; read it once.
  const systemLang = useMemo(resolveSystemLang, []);

  // Load the stored preferences once on mount. Read failures (e.g. storage
  // unavailable) are non-fatal: we keep the "system" defaults.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "system" || stored === "light" || stored === "dark") {
          setPrefState(stored);
        }
      })
      .catch(() => {
        // Ignore; fall back to "system".
      });
    AsyncStorage.getItem(LANG_STORAGE_KEY)
      .then((stored) => {
        if (stored === "system" || stored === "en" || stored === "ar") {
          setLangPrefState(stored);
        }
      })
      .catch(() => {
        // Ignore; fall back to "system".
      });
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory preference still applies.
    });
  }, []);

  const setLangPref = useCallback(
    (next: LangPref) => {
      const prevLang: Lang = langPref === "system" ? systemLang : langPref;
      const nextLang: Lang = next === "system" ? systemLang : next;
      setLangPrefState(next);
      // Pure en→system→en changes (no direction flip) apply instantly; an
      // actual en↔ar flip needs a JS reload to re-layout the whole app.
      const prevDir = prevLang === "ar" ? "rtl" : "ltr";
      const nextDir = nextLang === "ar" ? "rtl" : "ltr";
      if (prevDir === nextDir) {
        AsyncStorage.setItem(LANG_STORAGE_KEY, next).catch(() => {
          // Persistence is best-effort; the in-memory preference still applies.
        });
        return;
      }
      // Direction flip: PERSIST FIRST, THEN reload. The old fire-and-forget
      // write raced Updates.reloadAsync() — the restart then read the OLD
      // stored preference and the language appeared unchanged.
      AsyncStorage.setItem(LANG_STORAGE_KEY, next)
        .catch(() => {
          // Storage failing is non-fatal for the reload decision.
        })
        .finally(() => {
          try {
            I18nManager.forceRTL(nextDir === "rtl");
          } catch {
            // Best-effort native flag; the reload still applies strings.
          }
          // Small extra settle so the native side picks up forceRTL before
          // the JS context is torn down.
          setTimeout(() => reloadForDirectionChange(nextLang), 300);
        });
    },
    [langPref, systemLang],
  );

  const scheme: "light" | "dark" =
    pref === "system" ? (systemScheme === "dark" ? "dark" : "light") : pref;
  const colors = scheme === "dark" ? DarkColors : LightColors;

  const lang: Lang = langPref === "system" ? systemLang : langPref;
  const dir: LangDir = lang === "ar" ? "rtl" : "ltr";

  const value = useMemo(
    () => ({
      pref,
      setPref,
      scheme,
      colors,
      langPref,
      setLangPref,
      lang,
      dir,
    }),
    [pref, setPref, scheme, colors, langPref, setLangPref, lang, dir],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("Theme hooks must be used within a ThemePrefProvider");
  }
  return context;
}

/** Scheme-resolved palette for styling the current screen/component. */
export function useThemeColors(): ThemeColors {
  return useThemeContext().colors;
}

/**
 * Full theme controls — preference, setter, resolved scheme, palette, and the
 * language preference / resolved lang + dir. Intended for the Settings screen
 * and the i18n hooks.
 */
export function useThemePrefs(): ThemeContextValue {
  return useThemeContext();
}
