import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "expo-router";
import { I18nManager } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";

import "@/global.css";
import { track } from "@/analytics";
import { initDatabase } from "@/db/database";
import { useLang, useT } from "@/i18n";
import {
  DarkColors,
  LightColors,
  ThemePrefProvider,
  LANG_STORAGE_KEY,
  useThemePrefs,
} from "@/theme";

// Hold the native splash until the persisted language preference has been
// read and the RTL flags applied — otherwise the app boots in the wrong
// direction for a frame and a SECOND reload is needed to fix the layout.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented or unavailable (dev web) — fine.
});

/**
 * Root layout. Initializes the offline SQLite cache on mount and provides the
 * SafeAreaProvider + theme for the whole app. Theme wrapping is split in two:
 * ThemePrefProvider (our persisted light/dark/system preference) sits above
 * the navigation ThemeProvider, which is derived from the resolved scheme.
 */
export default function RootLayout() {
  useEffect(() => {
    // Apply the stored language's RTL flags BEFORE revealing the UI, then
    // release the splash. The provider's own state load covers strings.
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        const isAr = stored === "ar";
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(isAr);
      } catch {
        // Preference unreadable — boot as-is.
      } finally {
        // Give the provider one tick to commit its loaded state, then show.
        setTimeout(() => {
          SplashScreen.hideAsync().catch(() => {
            // Splash already hidden — fine.
          });
        }, 80);
      }
    })();
    initDatabase().catch((error) => {
      // Cache failures are non-fatal: screens fall back to the network.
      console.warn("[RecipeReal] initDatabase failed:", error);
    });
    // Fire-and-forget analytics. Runs once on app mount.
    track("app_open");
  }, []);

  return (
    <ThemePrefProvider>
      <RtlDirection />
      <NavigationFrame />
    </ThemePrefProvider>
  );
}

/**
 * Keeps the native RTL flags in sync with the resolved language:
 * `allowRTL(true)` always, and `forceRTL` for Arabic layout. Direction
 * changes only take effect after a JS reload — the language setter in the
 * theme provider triggers that restart flow whenever the resolved dir flips.
 */
function RtlDirection() {
  const { dir } = useLang();
  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(dir === "rtl");
  }, [dir]);
  return null;
}

/** Maps the resolved scheme onto warm navigation themes + the Stack. */
function NavigationFrame() {
  const { scheme, colors } = useThemePrefs();
  const t = useT();

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
              title: t("stack.premium"),
              headerShown: true,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              title: t("stack.signIn"),
              headerShown: true,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
            }}
          />
          {/*
            The signed-in user's profile (avatar, editable display name,
            counters, own recipes). Pushed from the Community header button
            and the Settings account section; renders its own header.
          */}
          <Stack.Screen
            name="profile"
            options={{ title: t("stack.profile"), headerShown: false }}
          />
          {/*
            Pace (personal pace calibrations + cook history). Formerly a tab;
            now a plain stack screen at /pace (src/app/pace.tsx) so pushes
            from profile.tsx, settings.tsx and login.tsx keep resolving. It
            renders its own header with a close affordance.
          */}
          <Stack.Screen
            name="pace"
            options={{ title: t("tabs.pace"), headerShown: false }}
          />
          <Stack.Screen
            name="recipe/[id]"
            options={{ title: t("stack.recipe"), headerShown: false }}
          />
          {/*
            Recipe composer (create/edit a user-submitted recipe). The header
            title ("New recipe" / "Edit recipe") is finalized by the screen
            itself via its own <Stack.Screen options> once it knows the mode.
          */}
          <Stack.Screen
            name="recipe-composer"
            options={{
              title: t("stack.newRecipe"),
              headerShown: true,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
            }}
          />
          <Stack.Screen
            name="cook/[id]"
            options={{ title: t("stack.cookMode"), headerShown: false }}
          />
          {/*
            Post detail: full post body + image grid + comments thread.
            Pushed from the community feed when a post card is tapped.
          */}
          <Stack.Screen
            name="post/[id]"
            options={{ title: t("community.postDetail"), headerShown: false }}
          />
          {/*
            Post composer: full compose screen extracted from the community tab.
            Renders its own header bar; the Stack header is hidden to avoid
            a double-header gap.
          */}
          <Stack.Screen
            name="post-composer"
            options={{ title: t("community.composeTitle"), headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
