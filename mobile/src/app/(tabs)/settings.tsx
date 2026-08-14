import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";

import {
  isNotificationsAvailable,
  requestNotificationsPermission,
} from "@/utils/notifications";

import { hasToken, logout } from "@/api/client";
import { seedCacheFirstPage, seedCacheRemainingPages } from "@/db/database";
import { getNudgePref, setNudgePref } from "@/utils/prefs";
import {
  Space,
  Type,
  useThemeColors,
  useThemePrefs,
  type ThemePref,
} from "@/theme";
import { Button, Card, Chip, SectionHeader } from "@/components/ui";

const THEME_OPTIONS: { pref: ThemePref; label: string }[] = [
  { pref: "system", label: "System" },
  { pref: "light", label: "Light" },
  { pref: "dark", label: "Dark" },
];

/**
 * The Settings tab: theme preference, cooking-nudge notifications, account
 * sign-in / sign-out, offline library re-sync, and about info. All sections
 * are theme-aware (light + warm dark) via useThemeColors().
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { pref: themePref, setPref: setThemePref } = useThemePrefs();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [nudgeOn, setNudgeOn] = useState(true);
  const [nudgeBlocked, setNudgeBlocked] = useState(false);
  const [nudgeUnavailable, setNudgeUnavailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          padding: Space.lg,
          gap: Space.lg,
        },
        section: {
          gap: Space.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.md,
        },
        rowText: {
          flex: 1,
          gap: 2,
        },
        rowLabel: {
          ...Type.title,
          color: colors.ink,
        },
        rowCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        themeRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
          marginTop: Space.xs,
        },
        blockedCaption: {
          ...Type.caption,
          color: colors.danger,
        },
        doneCaption: {
          ...Type.caption,
          color: colors.success,
        },
        appName: {
          ...Type.h2,
          color: colors.ink,
        },
      }),
    [colors],
  );

  // Refresh auth + the nudge preference whenever the screen gains focus, so
  // the account row updates after returning from /login (sign-in / sign-out).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [ok, nudge] = await Promise.all([hasToken(), getNudgePref()]);
        if (cancelled) return;
        setAuthed(ok);
        setNudgeOn(nudge === "on");
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const refreshAuth = useCallback(async () => {
    setAuthed(await hasToken());
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // logout() clears the stored token in its finally block; ignore errors.
    }
    await refreshAuth();
  }, [refreshAuth]);

  const handleNudgeToggle = useCallback(async (value: boolean) => {
    setNudgeOn(value);
    setNudgeBlocked(false);
    setNudgeUnavailable(false);
    await setNudgePref(value ? "on" : "off");
    if (!value) return;
    // expo-notifications cannot load in Expo Go on Android — surface that
    // instead of failing silently. Otherwise best-effort permission request;
    // if the system denies/blocks, hint at the system setting instead.
    if (!(await isNotificationsAvailable())) {
      setNudgeUnavailable(true);
      return;
    }
    setNudgeBlocked(!(await requestNotificationsPermission()));
  }, []);

  const handleResync = useCallback(async () => {
    setSyncing(true);
    setSyncDone(false);
    try {
      await seedCacheFirstPage();
      await seedCacheRemainingPages();
      setSyncDone(true);
    } catch (error) {
      console.warn("[RecipeReal] library re-sync failed:", error);
    } finally {
      setSyncing(false);
    }
  }, []);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Space.xxl },
      ]}
    >
      {/* Appearance */}
      <Card style={styles.section}>
        <SectionHeader title="Appearance" />
        <Text style={styles.rowLabel}>Theme</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(({ pref: option, label }) => (
            <Pressable key={option} onPress={() => setThemePref(option)}>
              <Chip
                label={label}
                tone={themePref === option ? "accent" : "neutral"}
              />
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Notifications */}
      <Card style={styles.section}>
        <SectionHeader title="Notifications" />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Cooking nudges</Text>
            <Text style={styles.rowCaption}>
              Get a nudge when a hands-off step is usually done
            </Text>
          </View>
          <Switch
            value={nudgeOn}
            onValueChange={handleNudgeToggle}
            trackColor={{ false: colors.hairline, true: colors.accent }}
            thumbColor={colors.surface}
          />
        </View>
        {nudgeBlocked ? (
          <Text style={styles.blockedCaption}>
            Notifications are blocked for this app — enable them in system
            settings.
          </Text>
        ) : null}
        {nudgeUnavailable ? (
          <Text style={styles.blockedCaption}>
            Nudges need the full app build — notifications aren't available in
            Expo Go.
          </Text>
        ) : null}
      </Card>

      {/* Account */}
      <Card style={styles.section}>
        <SectionHeader title="Account" />
        {authed === false ? (
          <Button title="Sign in" onPress={() => router.push("/login")} />
        ) : (
          <Button
            title="Sign out"
            variant="ghost"
            onPress={handleSignOut}
            disabled={authed === null}
          />
        )}
      </Card>

      {/* Data */}
      <Card style={styles.section}>
        <SectionHeader title="Data" />
        <Text style={styles.rowLabel}>Offline library</Text>
        <Button
          title={syncing ? "Syncing…" : "Re-sync recipe library"}
          variant="ghost"
          onPress={handleResync}
          disabled={syncing}
        />
        {syncDone ? (
          <Text style={styles.doneCaption}>Library re-synced ✓</Text>
        ) : null}
      </Card>

      {/* About */}
      <Card style={styles.section}>
        <SectionHeader title="About" />
        <Text style={styles.appName}>RecipeReal</Text>
        <Text style={styles.rowCaption}>Version {version}</Text>
        <Text style={styles.rowCaption}>Backend: recipe-real.softland.tech</Text>
      </Card>
    </ScrollView>
  );
}
