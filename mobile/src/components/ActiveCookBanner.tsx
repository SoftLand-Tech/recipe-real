import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";

import { track } from "@/analytics";
import { useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { ActionSheet, Button, IconPressable } from "@/components/ui";
import {
  discardActiveCookSession,
  formatActiveSessionElapsed,
  readActiveCookSession,
  type ActiveCookSession,
  type ReadActiveCookSessionOptions,
} from "@/utils/cookSessionStatus";

/**
 * App-wide active-cook banner: whenever a live cook session exists (running
 * or paused) and the user is NOT on the cook screen, a banner pinned above
 * every screen shows the recipe, the live pause-adjusted elapsed and
 * Open / End actions.
 *
 * Why this exists alongside the sticky Android notification: the system row
 * can't exist on iOS or in Expo Go, dies on aggressive OEM force-stops, and
 * says nothing once its tap is a no-op — the banner is the always-visible,
 * always-actionable surface. It reads the same persisted snapshot the cook
 * screen writes on every change, so it survives kills and restarts.
 */
export function ActiveCookBanner() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const pathname = usePathname();
  const [session, setSession] = useState<ActiveCookSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const mountedRef = useRef(true);
  const sessionRef = useRef<ActiveCookSession | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const rescan = useCallback((opts?: ReadActiveCookSessionOptions) => {
    readActiveCookSession(opts)
      .then((found) => {
        if (mountedRef.current) setSession(found);
      })
      .catch(() => {
        // Best-effort: a failed read just keeps the last state.
      });
  }, []);

  // Sync on mount, when leaving a /cook screen (forced single-key refresh),
  // and on normal navigations (served from in-memory cache).
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (pathname.startsWith("/cook")) return;

    if (prev != null && prev.startsWith("/cook")) {
      const match = prev.match(/^\/cook\/(\d+)/);
      const hintRecipeId = match ? Number(match[1]) : undefined;
      rescan({ force: true, hintRecipeId });
      return;
    }
    rescan();
  }, [rescan, pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const active = sessionRef.current;
      if (active) {
        rescan({ force: true, hintRecipeId: active.recipeId });
      }
    });
    return () => sub.remove();
  }, [rescan]);

  // Live elapsed ticker (one small Text — cheap). The initial paint uses
  // the mount-time stamp; the interval takes over from there.
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  const openSession = useCallback(() => {
    if (!session) return;
    track("active_cook_opened", { recipe_id: session.recipeId });
    try {
      router.navigate(`/cook/${session.recipeId}`);
    } catch {
      // Navigation not ready — the banner stays; retry on next tap.
    }
  }, [session]);

  const endSession = useCallback(async () => {
    if (!session || ending) return;
    setEnding(true);
    try {
      await discardActiveCookSession(session);
      track("active_cook_discarded", { recipe_id: session.recipeId });
      if (mountedRef.current) {
        setSession(null);
        setConfirmEnd(false);
      }
    } finally {
      if (mountedRef.current) setEnding(false);
    }
  }, [session, ending]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
          paddingTop: insets.top + Space.xs,
          paddingBottom: Space.xs,
          paddingHorizontal: Space.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        iconDot: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        middle: {
          flex: 1,
          gap: 1,
        },
        title: {
          ...Type.bodySm,
          fontWeight: "700",
          color: colors.ink,
        },
        caption: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontVariant: ["tabular-nums"],
        },
        openBtn: {
          paddingVertical: Space.xs,
          paddingHorizontal: Space.md,
          borderRadius: Radius.pill,
        },
        endBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, insets.top],
  );

  // No live session, or already cooking on screen — no banner.
  if (!session || pathname.startsWith("/cook")) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.iconDot}>
        <Ionicons name="timer-outline" size={18} color={colors.accent} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title ?? t("cook.bannerFallback")}
        </Text>
        <Text style={styles.caption} numberOfLines={1}>
          {session.status === "paused"
            ? t("cook.bannerPaused")
            : t("cook.bannerCooking")}{" "}
          · {formatActiveSessionElapsed(session, now)}
        </Text>
      </View>
      <Button
        title={t("cook.bannerOpen")}
        onPress={openSession}
        style={styles.openBtn}
      />
      <IconPressable
        onPress={() => setConfirmEnd(true)}
        accessibilityLabel={t("cook.bannerEnd")}
        hitSlop={Space.xs}
        style={styles.endBtn}
      >
        <Ionicons name="close" size={16} color={colors.inkSecondary} />
      </IconPressable>
      <ActionSheet
        visible={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={t("cook.discardTitle")}
        message={t("cook.discardMessage")}
        actions={[
          {
            key: "end",
            label: ending ? t("cook.endingSession") : t("cook.discardBtn"),
            icon: "trash-outline",
            tone: "destructive",
            onPress: () => void endSession(),
          },
        ]}
      />
    </View>
  );
}
