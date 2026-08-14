import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { DarkColors, LightColors, type ThemeColors } from "./colors";

/** User-facing theme preference. "system" follows the OS color scheme. */
export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "recipereal.themePref";

interface ThemeContextValue {
  /** Persisted preference (defaults to "system" until loaded). */
  pref: ThemePref;
  /** Set and persist a new preference. */
  setPref: (pref: ThemePref) => void;
  /** Preference resolved against the OS scheme. */
  scheme: "light" | "dark";
  /** Palette for the resolved scheme. */
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides the app-wide theme preference (persisted in AsyncStorage) and the
 * resolved palette. Must wrap everything that calls `useThemeColors()`.
 */
export function ThemePrefProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  const systemScheme = useColorScheme();

  // Load the stored preference once on mount. Read failures (e.g. storage
  // unavailable) are non-fatal: we keep the "system" default.
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
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory preference still applies.
    });
  }, []);

  const scheme: "light" | "dark" =
    pref === "system" ? (systemScheme === "dark" ? "dark" : "light") : pref;
  const colors = scheme === "dark" ? DarkColors : LightColors;

  const value = useMemo(
    () => ({ pref, setPref, scheme, colors }),
    [pref, setPref, scheme, colors],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
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
 * Full theme controls — preference, setter, resolved scheme, and palette.
 * Intended for the Settings screen.
 */
export function useThemePrefs(): ThemeContextValue {
  return useThemeContext();
}
