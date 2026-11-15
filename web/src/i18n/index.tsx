/**
 * i18n facade (FOUNDATION OWNED — slices add keys ONLY in their own
 * dictionary files under src/i18n/dicts/, never here).
 *
 * Mirrors mobile/src/i18n/index.ts on web primitives:
 *   - flat Record<string, string> dictionaries with `{placeholder}`
 *     interpolation; values fall back en→key so a typo'd key renders the key
 *     itself instead of crashing.
 *   - the language preference is persisted in localStorage 'rr_lang'
 *     (default 'en'); switching also updates <html lang> and <html dir>
 *     ('rtl' for Arabic) so the whole layout — logical CSS properties,
 *     scrollbars, form controls — flips with the language.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ar as arAll, en as enAll } from "@/i18n/dicts";

export type Lang = "en" | "ar";
export type LangDir = "ltr" | "rtl";

/** localStorage key for the persisted language preference (contract). */
const LANG_KEY = "rr_lang";

/** Interpolation params for `{placeholder}` tokens in dictionary values. */
export type TParams = Record<string, string | number>;

/** `(key, params?) => string` translator. */
export type TranslateFn = (key: string, params?: TParams) => string;

function interpolate(template: string, params: TParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

/**
 * Translate `key` for `lang`. Falls back to the English string when the key
 * is missing from the Arabic dictionary, and to the key itself when it's
 * missing from both (never crashes on a typo'd key).
 */
export function translate(lang: Lang, key: string, params?: TParams): string {
  const raw = (lang === "ar" ? arAll[key] : undefined) ?? enAll[key] ?? key;
  return params ? interpolate(raw, params) : raw;
}

/** Layout direction for a language ('rtl' only for Arabic, per contract). */
export function dirFor(lang: Lang): LangDir {
  return lang === "ar" ? "rtl" : "ltr";
}

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

interface I18nContextValue {
  lang: Lang;
  dir: LangDir;
  /** Switch language (persists to localStorage + flips <html lang/dir>). */
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  // Keep <html lang/dir> in sync — index.html's inline script already set
  // the pre-paint direction from the same key, this maintains it thereafter.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Storage unavailable: the switch still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ lang, dir: dirFor(lang), setLang }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Resolved language + layout direction + setter. */
export function useLang(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useLang must be used inside <I18nProvider>");
  }
  return ctx;
}

/** Translation hook — re-renders (via context) when the language changes. */
export function useT(): TranslateFn {
  const { lang } = useLang();
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

// ---- Localized minute formatting ---------------------------------------------
// Shared here (like mobile) so both TimeBadge and future slice screens
// format "1h 5m" / "1س 5د" identically without an import cycle.

/** Format a minute count with explicit unit suffixes, e.g. "45m" / "1h 5m". */
export function formatMinutes(m: number, mUnit: string, hUnit: string): string {
  if (!Number.isFinite(m) || m <= 0) return `0${mUnit}`;
  if (m < 1) return `1${mUnit}`;
  if (m < 60) return `${Math.round(m)}${mUnit}`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}${hUnit}` : `${h}${hUnit} ${rem}${mUnit}`;
}

/** Locale-aware minute formatter hook ("45m" → "45 د" in Arabic). */
export function useFmtMinutes(): (m: number) => string {
  const t = useT();
  return useCallback(
    (m) => formatMinutes(m, t("common.min"), t("common.h")),
    [t],
  );
}
