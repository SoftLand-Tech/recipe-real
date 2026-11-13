import { useEffect, useMemo } from "react";
import { router, Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "expo-router";
import {
  I18nManager,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";

import "@/global.css";
import { AI_IMPORT_ENABLED } from "@/config";
import { reportAppLaunch } from "@/analytics";
import { ActiveCookBanner } from "@/components/ActiveCookBanner";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import {
  FirstRunConsent,
  hasAnalyticsConsent,
} from "@/components/FirstRunConsent";
import { NotificationSetup } from "@/components/NotificationSetup";
import { Button } from "@/components/ui";
import { initDatabase } from "@/db/database";
import { useLang, useT } from "@/i18n";
import {
  DarkColors,
  LightColors,
  ThemePrefProvider,
  useThemePrefs,
} from "@/theme";

// Hold the native (plain canvas) splash until the AnimatedSplash overlay is
// laid out — it opens on the same canvas color, plays the reveal sequence,
// and is the ONLY caller of hideAsync(). Without this, the app would flash
// before the overlay's first paint.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented or unavailable (dev web) — fine.
});

// Release-only global error breadcrumb: keep a line in the device log for
// every fatal crash so it is at least diagnosable from logcat. Skipped in
// dev — the redbox already surfaces everything, and replacing the default
// handler would hide it. __DEV__ / ErrorUtils are untyped RN globals on
// globalThis, hence the narrow casts.
if (!(globalThis as { __DEV__?: boolean }).__DEV__) {
  (globalThis as {
    ErrorUtils?: {
      setGlobalHandler?: (
        handler: (error: unknown, isFatal: boolean) => void,
      ) => void;
    };
  }).ErrorUtils?.setGlobalHandler?.((_error, isFatal) => {
    console.warn("[RecipeReal] global error, fatal:", isFatal);
  });
}

/**
 * ROOT ERROR BOUNDARY (expo-router convention): without this, an uncaught
 * render error in a release build dies silently — no red screen, just a
 * blank app. This renders a themed "something went wrong" surface with a
 * retry (remount) and a home escape hatch. Never throws of its own.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const colors = useThemePrefs().colors;
  const t = useT();
  return (
    <View style={ebStyles.screen}>
      <Text style={[ebStyles.title, { color: colors.ink }]}>
        {t("common.somethingWentWrong")}
      </Text>
      <Text style={[ebStyles.message, { color: colors.inkSecondary }]} numberOfLines={3}>
        {error.message || t("common.couldNotLoadRecipe")}
      </Text>
      <View style={ebStyles.actions}>
        <Button title={t("common.retry")} onPress={retry} />
        <Button
          title={t("common.goHome")}
          variant="ghost"
          onPress={() => router.replace("/")}
        />
      </View>
    </View>
  );
}

const ebStyles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#FAF8F5", padding: 24 },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 13, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
});

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
    // Defer the fire-and-forget install heartbeat + analytics until after
    // interactions settle + a short delay so it never competes with initial
    // Home requests, and ONLY when the user opted in on first run.
    let cancelled = false;
    let launchTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      launchTimer = setTimeout(() => {
        if (cancelled) return;
        void hasAnalyticsConsent().then((accepted) => {
          if (!cancelled && accepted) void reportAppLaunch();
        });
      }, 1500);
    });
    return () => {
      cancelled = true;
      interactionTask.cancel();
      if (launchTimer != null) clearTimeout(launchTimer);
    };
  }, []);

  return (
    // Keyboard handling lives at the very top: with edge-to-edge on Android
    // the window no longer resizes for the keyboard, so screens must avoid
    // it themselves — this provider feeds accurate keyboard metrics to the
    // KeyboardAvoidingView / KeyboardAwareScrollView wrappers on every
    // screen, on both platforms (and inside RN Modals).
    <KeyboardProvider>
      <ThemePrefProvider>
        <RtlDirection />
        <NavigationFrame />
        {/*
          Animated splash reveal, above everything. Mirrors the native splash's
          first frame, plays the lines → splash → logo sequence, fades out and
          unmounts itself once per cold start.
        */}
        <AnimatedSplash />
        {/*
          First-run analytics consent (AsyncStorage 'consent.v1'). Renders
          nothing once an answer is stored; Accept re-runs the launch report.
        */}
        <FirstRunConsent onAccepted={() => void reportAppLaunch()} />
      </ThemePrefProvider>
    </KeyboardProvider>
  );
}

/**
 * Keeps the native RTL flags in sync with the resolved language:
 * `allowRTL(true)` always, and `forceRTL` for Arabic layout. Direction
 * changes only take effect after a JS reload — the language setter in the
 * theme provider triggers that restart flow whenever the resolved dir flips.
 *
 * ⚠️ NO boot-time reload here. An earlier version auto-reloaded when the
 * persisted dir didn't match a fresh install's first session (cosmetic:
 * one LTR-layout session with Arabic strings). In the shipped release
 * build the reload fired before its own guard-flag flushed to disk, so
 * EVERY cold start looked "mismatched" and reloaded again — an invisible
 * boot loop the user experiences as a permanent black screen. A slightly
 * unmirrored first session is infinitely better than that; it self-heals
 * on the next natural restart (or the explicit language flip, which has
 * its own battle-tested reload in ThemeProvider).
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
  const { scheme } = useThemePrefs();
  const t = useT();

  const navigationTheme: Theme = useMemo(
    () =>
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
          },
    [scheme],
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        {/*
          Headless notification plumbing (tap-to-open, sticky cook re-post)
          + the app-wide active-cook banner. Both render nothing when idle;
          the banner pins above every screen while a cook session is live.
        */}
        <NotificationSetup />
        <ActiveCookBanner />
        <Stack screenOptions={{ headerShown: true, freezeOnBlur: true }}>
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
            recipe/[id].tsx keep resolving. Own PinnedHeaderBar.
          */}
          <Stack.Screen
            name="upgrade"
            options={{ title: t("stack.premium"), headerShown: false }}
          />
          {/*
            Sign-in. Own PinnedHeaderBar (native stack headers double-count
            the status-bar inset on this device/SDK — the app-wide custom
            headers pad correctly from the top).
          */}
          <Stack.Screen
            name="login"
            options={{ title: t("stack.signIn"), headerShown: false }}
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
            Recipe composer (create/edit a user-submitted recipe). Own
            PinnedHeaderBar; the title ("New recipe" / "Edit recipe")
            depends on the mode, set by the screen itself.
          */}
          <Stack.Screen
            name="recipe-composer"
            options={{ title: t("stack.newRecipe"), headerShown: false }}
          />
          {/* AI recipe import — hidden behind AI_IMPORT_ENABLED while the
              first self-updating build ships. The file stays so an OTA
              update can restore the whole flow with no native changes. */}
          {AI_IMPORT_ENABLED ? (
            <Stack.Screen
              name="recipe-import"
              options={{ title: t("stack.aiImport"), headerShown: false }}
            />
          ) : null}
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
          {/*
            Notification center: likes/comments on the signed-in user's
            posts. Pushed from the Community tab bell; renders its own
            header with the close affordance.
          */}
          <Stack.Screen
            name="notifications"
            options={{ title: t("notif.title"), headerShown: false }}
          />
          {/*
            Public profile of another user (avatar, bio, follow button,
            counters). Renders its own PinnedHeaderBar — the native header
            is hidden. Declared explicitly so expo-router doesn't auto-mount
            a default native header above the custom one.
          */}
          <Stack.Screen
            name="user/[id]"
            options={{ headerShown: false }}
          />
          {/* Followers/Following list — own pinned header, native off. */}
          <Stack.Screen
            name="follow-list"
            options={{ headerShown: false }}
          />
          {/*
            Deep-link bridges (/r/:id, /p/:id): instant redirects with no
            chrome at all.
          */}
          <Stack.Screen name="r/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
          {/* Catch-all 404: silent bounce home, no chrome. */}
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
          {/*
            First-sign-in onboarding: complete profile details (name,
            gender, photo, bio) before continuing into the app. Renders
            its own centered welcome headline — the native header is hidden
            so the title starts at the top instead of below an empty bar.
          */}
          <Stack.Screen
            name="onboarding"
            options={{ title: t("stack.onboarding"), headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
