import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "expo-router";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import "@/global.css";
import { track } from "@/analytics";
import { initDatabase } from "@/db/database";
import {
  DarkColors,
  LightColors,
  ThemePrefProvider,
  useThemePrefs,
} from "@/theme";

/**
 * Root layout. Initializes the offline SQLite cache on mount and provides the
 * SafeAreaProvider + theme for the whole app. Theme wrapping is split in two:
 * ThemePrefProvider (our persisted light/dark/system preference) sits above
 * the navigation ThemeProvider, which is derived from the resolved scheme.
 */
export default function RootLayout() {
  useEffect(() => {
    initDatabase().catch((error) => {
      // Cache failures are non-fatal: screens fall back to the network.
      console.warn("[RecipeReal] initDatabase failed:", error);
    });
    // Fire-and-forget analytics. Runs once on app mount.
    track("app_open");
  }, []);

  return (
    <ThemePrefProvider>
      <NavigationFrame />
    </ThemePrefProvider>
  );
}

/** Maps the resolved scheme onto warm navigation themes + the Stack. */
function NavigationFrame() {
  const { scheme, colors } = useThemePrefs();

  const navigationTheme: Theme =
    scheme === "dark"
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: DarkColors.canvas,
            card: DarkColors.surface,
            primary: DarkColors.accent,
            text: DarkColors.ink,
            border: DarkColors.hairline,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: LightColors.canvas,
            card: LightColors.surface,
            primary: LightColors.accent,
            text: LightColors.ink,
            border: LightColors.hairline,
          },
        };

  return (
    <ThemeProvider value={navigationTheme}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: true }}>
          {/*
            The (tabs) group provides bottom-tab navigation for the five
            top-level destinations. Its own screens manage headers: home and
            browse render their own headers (title / title + search bar) with a
            manual status-bar inset, so the Stack header is hidden for the whole
            group to avoid a double-counted gap.
          */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/*
            Premium upsell. Formerly a tab; now a plain stack screen at
            /upgrade (src/app/upgrade.tsx) so pushes from pace.tsx and
            recipe/[id].tsx keep resolving.
          */}
          <Stack.Screen
            name="upgrade"
            options={{
              title: "Premium",
              headerShown: true,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              title: "Sign in",
              headerShown: true,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
            }}
          />
          <Stack.Screen
            name="recipe/[id]"
            options={{ title: "Recipe", headerShown: false }}
          />
          <Stack.Screen
            name="cook/[id]"
            options={{ title: "Cook Mode", headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
