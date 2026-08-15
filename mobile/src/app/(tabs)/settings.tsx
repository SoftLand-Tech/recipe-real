import { useCallback, useMemo, useState } from "react";
import {
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
import { clearPaceCache } from "./pace";
import { useT } from "@/i18n";
import type { LangPref } from "@/i18n";
import {
  Space,
  Type,
  useThemeColors,
  useThemePrefs,
  type ThemePref,
} from "@/theme";
import {
  Button,
  Card,
  Chip,
  IconPressable,
  ScreenHeader,
  SectionHeader,
} from "@/components/ui";

const THEME_OPTIONS: { pref: ThemePref; labelKey: string }[] = [
  { pref: "system", labelKey: "theme.system" },
  { pref: "light", labelKey: "theme.light" },
  { pref: "dark", labelKey: "theme.dark" },
];

const LANG_OPTIONS: { pref: LangPref; labelKey: string }[] = [
  { pref: "system", labelKey: "lang.system" },
  { pref: "en", labelKey: "lang.english" },
  { pref: "ar", labelKey: "lang.arabic" },
];

/**
 * The Settings tab: theme preference, cooking-nudge notifications, offline
 * library re-sync, account sign-in / sign-out, and a compact about row. All
 * sections are theme-aware (light + warm dark) via useThemeColors().
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { pref: themePref, setPref: setThemePref, langPref, setLangPref } =
    useThemePrefs();

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
          paddingHorizontal: Space.lg,
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
        signedInCaption: {
          ...Type.caption,
          color: colors.inkSecondary,
        },
        aboutText: {
          ...Type.caption,
          color: colors.inkFaint,
          textAlign: "center",
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
    // Also clear the Pace tab's remount cache so the next signed-in user
    // never sees the previous account's pace data flash on remount.
    clearPaceCache();
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
      <ScreenHeader title={t("tabs.settings")} />

      {/* Appearance */}
      <Card style={styles.section}>
        <SectionHeader title={t("settings.appearance")} />
        <Text style={styles.rowLabel}>{t("settings.theme")}</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(({ pref: option, labelKey }) => (
            <IconPressable key={option} onPress={() => setThemePref(option)}>
              <Chip
                label={t(labelKey)}
                tone={themePref === option ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </Card>

      {/* Language */}
      <Card style={styles.section}>
        <SectionHeader
          title={t("settings.language")}
          subtitle={t("settings.languageCaption")}
        />
        <View style={styles.themeRow}>
          {LANG_OPTIONS.map(({ pref: option, labelKey }) => (
            <IconPressable key={option} onPress={() => setLangPref(option)}>
              <Chip
                label={t(labelKey)}
                tone={langPref === option ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </Card>

      {/* Notifications */}
      <Card style={styles.section}>
        <SectionHeader title={t("settings.notifications")} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t("settings.nudges")}</Text>
            <Text style={styles.rowCaption}>
              {t("settings.nudgesCaption")}
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
            {t("settings.nudgesBlocked")}
          </Text>
        ) : null}
        {nudgeUnavailable ? (
          <Text style={styles.blockedCaption}>
            {t("settings.nudgesUnavailable")}
          </Text>
        ) : null}
      </Card>

      {/* Data & storage */}
      <Card style={styles.section}>
        <SectionHeader title={t("settings.dataStorage")} />
        <Text style={styles.rowLabel}>{t("settings.offlineLibrary")}</Text>
        <Button
          title={syncing ? t("settings.syncing") : t("settings.resync")}
          variant="ghost"
          onPress={handleResync}
          disabled={syncing}
        />
        {syncDone ? (
          <Text style={styles.doneCaption}>{t("settings.syncDone")}</Text>
        ) : null}
      </Card>

      {/* Account */}
      <Card style={styles.section}>
        <SectionHeader title={t("settings.account")} />
        {authed === false ? (
          <Button
            title={t("common.signIn")}
            onPress={() => router.push("/login")}
          />
        ) : (
          <>
            {authed === true ? (
              <Text style={styles.signedInCaption}>
                {t("settings.signedIn")}
              </Text>
            ) : null}
            <Button
              title={t("common.signOut")}
              variant="ghost"
              onPress={handleSignOut}
              disabled={authed === null}
            />
          </>
        )}
      </Card>

      {/* About — one compact centered row. */}
      <Card padding={Space.md}>
        <Text style={styles.aboutText}>{t("settings.about", { version })}</Text>
      </Card>
    </ScrollView>
  );
}
