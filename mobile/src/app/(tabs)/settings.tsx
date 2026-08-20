import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import {
  BigScreenTitle,
  PinnedHeaderBar,
  useChromeContentBottomPad,
  useCollapseScroll,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";

import {
  isNotificationsAvailable,
  requestNotificationsPermission,
} from "@/utils/notifications";

import { deleteAccount, hasToken, logout } from "@/api/client";
import {
  clearRecipeCache,
  countCachedRecipes,
  seedCacheFirstPage,
  seedCacheRemainingPages,
} from "@/db/database";
import { getNudgePref, setNudgePref } from "@/utils/prefs";
import { clearPaceCache } from "../pace";
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
  Toggle,
  useHeaderActionsRights,
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

interface SettingsRowProps {
  icon?: ComponentProps<typeof Ionicons>["name"];
  label: string;
  caption?: string;
  /** Extra content under the label (the theme/language chip rows). */
  below?: ReactNode;
  /** End-of-row control (Switch) — replaces the chevron. */
  end?: ReactNode;
  chevron?: boolean;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

/**
 * One grouped-list row: quiet monochrome glyph, label (+caption), trailing
 * control. Pressed feedback follows the Card pattern (opacity via state,
 * never a style function or background swap — Android paint rules).
 */
function SettingsRow({
  icon,
  label,
  caption,
  below,
  end,
  chevron = false,
  busy = false,
  danger = false,
  disabled = false,
  onPress,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          minHeight: 52,
          paddingHorizontal: Space.lg,
          paddingVertical: Space.sm,
        },
        rowPressed: { opacity: 0.6 },
        rowDisabled: { opacity: 0.5 },
        rowText: {
          flex: 1,
          gap: 2,
        },
        rowLabel: {
          ...Type.body,
          fontWeight: "600",
          color: colors.ink,
        },
        dangerLabel: {
          color: colors.danger,
        },
        rowCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        chipsBelow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
          marginTop: Space.xs,
        },
      }),
    [colors],
  );

  const body = (
    <>
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.inkSecondary} />
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.dangerLabel]}>
          {label}
        </Text>
        {caption ? (
          <Text style={styles.rowCaption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
        {below ? <View style={styles.chipsBelow}>{below}</View> : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : end ? (
        end
      ) : chevron && onPress ? (
        <Ionicons
          name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
          size={18}
          color={colors.inkFaint}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.row,
        pressed ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * The Settings tab as a grouped list: one card per section, icon rows with
 * hairline dividers, the control at the end of each row — the pattern every
 * phone user already knows. Sections: Appearance (theme + language),
 * Notifications (nudges), Data & storage (sync / clear), Account, and a
 * plain about footer.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const headerRights = useHeaderActionsRights();
  const { pref: themePref, setPref: setThemePref, langPref, setLangPref } =
    useThemePrefs();
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const barPad = usePinnedBarPad();
  const collapse = useCollapseScroll({ existingOnScroll: chrome.onScroll });

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [nudgeOn, setNudgeOn] = useState(false);
  const [nudgeBlocked, setNudgeBlocked] = useState(false);
  const [nudgeUnavailable, setNudgeUnavailable] = useState(false);
  /** Recipes in the local offline cache (null while the count loads). */
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  /** Which sync option is running (null = idle) — drives its busy spinner. */
  const [syncingOption, setSyncingOption] = useState<"quick" | "deep" | null>(
    null,
  );
  const [syncDone, setSyncDone] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  /** Account deletion in flight (disables the danger row). */
  const [deleting, setDeleting] = useState(false);
  /** Whether the last account-deletion attempt failed (inline caption). */
  const [deleteFailed, setDeleteFailed] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        scroll: {
          flex: 1,
        },
        content: {
          paddingHorizontal: 0,
          gap: Space.lg,
        },
        groupCaption: {
          ...Type.caption,
          color: colors.inkFaint,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: Space.xs,
        },
        group: {
          borderRadius: 0,
          // Card already clips to its radius; rows run edge to edge.
        },
        // Inset divider — starts at the row text so the icon column reads as
        // one solid rail down the group (16 padding + 20 glyph + 12 gap).
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.hairline,
          marginStart: 48,
        },
        statusPad: {
          paddingHorizontal: Space.lg,
          paddingVertical: Space.sm,
        },
        countText: {
          ...Type.bodySm,
          color: colors.inkFaint,
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
        },
        blockedCaption: {
          ...Type.caption,
          color: colors.danger,
        },
        doneCaption: {
          ...Type.caption,
          color: colors.success,
        },
        signInCard: {
          padding: Space.lg,
          gap: Space.sm,
        },
        aboutText: {
          ...Type.caption,
          color: colors.inkFaint,
          textAlign: "center",
        },
        pinnedBar: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        },
      }),
    [colors],
  );

  /** COUNT(*) over the recipes table — cheap enough to re-run after any
 *  cache mutation and on every focus. */
  const reloadCachedCount = useCallback(async () => {
    try {
      setCachedCount(await countCachedRecipes());
    } catch {
      // The count is informational; leave the last value on failure.
    }
  }, []);

  // Refresh auth + the nudge preference whenever the screen gains focus, so
  // the account rows update after returning from /login (sign-in / sign-out).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [ok, nudge] = await Promise.all([hasToken(), getNudgePref()]);
        if (cancelled) return;
        setAuthed(ok);
        setNudgeOn(nudge === "on");
      })();
      void reloadCachedCount();
      return () => {
        cancelled = true;
      };
    }, [reloadCachedCount]),
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
    // Also clear the Pace screen's remount cache so the next signed-in user
    // never sees the previous account's pace data flash on remount.
    clearPaceCache();
    await refreshAuth();
  }, [refreshAuth]);

  /** Delete the account server-side, then drop all local auth state. */
  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteAccount();
      clearPaceCache();
      await refreshAuth();
    } catch (error) {
      console.warn("[RecipeReal] account deletion failed:", error);
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  }, [deleting, refreshAuth]);

  /**
   * Single destructive confirmation for account deletion — Play requires
   * discoverability, not friction, so one confirm alert is enough.
   */
  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      t("settings.deleteConfirmTitle"),
      t("settings.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteConfirmBtn"),
          style: "destructive",
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  }, [t, handleDeleteAccount]);

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

  /**
   * Run a library sync capped at `maxRecipes` (counting the first page):
   * 200 → quick sync (top 200), 1000 → deep sync (the seed cap).
   */
  const handleSync = useCallback(
    async (maxRecipes: number) => {
      if (syncingOption != null) return;
      setSyncingOption(maxRecipes <= 200 ? "quick" : "deep");
      setSyncDone(false);
      try {
        await seedCacheFirstPage();
        await seedCacheRemainingPages({ maxRecipes });
        setSyncDone(true);
        await reloadCachedCount();
      } catch (error) {
        console.warn("[RecipeReal] library sync failed:", error);
      } finally {
        setSyncingOption(null);
      }
    },
    [syncingOption, reloadCachedCount],
  );

  /** Clear the offline recipe cache (favorites/notes are preserved). */
  const handleClearCache = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setClearDone(false);
    try {
      await clearRecipeCache();
      setClearDone(true);
      await reloadCachedCount();
    } catch (error) {
      console.warn("[RecipeReal] clear offline library failed:", error);
    } finally {
      setClearing(false);
    }
  }, [clearing, reloadCachedCount]);

  /** Destructive confirm before clearing the offline library. */
  const confirmClearCache = useCallback(() => {
    Alert.alert(t("settings.clearCache"), t("settings.clearCacheConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.clearCache"),
        style: "destructive",
        onPress: () => {
          void handleClearCache();
        },
      },
    ]);
  }, [t, handleClearCache]);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: barPad, paddingBottom: chromeBottomPad },
        ]}
        onScroll={collapse.onScroll}
        scrollEventThrottle={collapse.scrollEventThrottle}
      >
      <BigScreenTitle title={t("tabs.settings")} rights={headerRights} />
      {/* Appearance: theme + language as two rows of the same group. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.appearance")}</Text>
        <Card padding={0} style={styles.group}>
          <SettingsRow
            icon="contrast"
            label={t("settings.theme")}
            below={THEME_OPTIONS.map(({ pref: option, labelKey }) => (
              <IconPressable
                key={option}
                onPress={() => setThemePref(option)}
              >
                <Chip
                  label={t(labelKey)}
                  tone={themePref === option ? "accent" : "neutral"}
                />
              </IconPressable>
            ))}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="language"
            label={t("settings.language")}
            caption={t("settings.languageCaption")}
            below={LANG_OPTIONS.map(({ pref: option, labelKey }) => (
              <IconPressable key={option} onPress={() => setLangPref(option)}>
                <Chip
                  label={t(labelKey)}
                  tone={langPref === option ? "accent" : "neutral"}
                />
              </IconPressable>
            ))}
          />
        </Card>
      </View>

      {/* Notifications: the nudge switch. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.notifications")}</Text>
        <Card padding={0} style={styles.group}>
          <SettingsRow
            icon="notifications"
            label={t("settings.nudges")}
            caption={t("settings.nudgesCaption")}
            end={
              <Toggle
                value={nudgeOn}
                onValueChange={handleNudgeToggle}
              />
            }
          />
          {nudgeBlocked || nudgeUnavailable ? (
            <View style={styles.statusPad}>
              <Text style={styles.blockedCaption}>
                {nudgeUnavailable
                  ? t("settings.nudgesUnavailable")
                  : t("settings.nudgesBlocked")}
              </Text>
            </View>
          ) : null}
        </Card>
      </View>

      {/* Data & storage: how much is saved, sync options, clear. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.dataStorage")}</Text>
        <Card padding={0} style={styles.group}>
          <SettingsRow
            icon="library-outline"
            label={t("settings.offlineLibrary")}
            end={
              cachedCount != null ? (
                <Text style={styles.countText}>
                  {t("settings.recipesCached", { n: cachedCount })}
                </Text>
              ) : null
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download-outline"
            label={t("settings.syncTop200")}
            chevron
            busy={syncingOption === "quick"}
            disabled={syncingOption != null && syncingOption !== "quick"}
            onPress={() => handleSync(200)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download"
            label={t("settings.syncDeep")}
            chevron
            busy={syncingOption === "deep"}
            disabled={syncingOption != null && syncingOption !== "deep"}
            onPress={() => handleSync(1000)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            danger
            label={t("settings.clearCache")}
            chevron
            busy={clearing}
            disabled={syncingOption != null}
            onPress={confirmClearCache}
          />
          {syncDone || clearDone ? (
            <View style={styles.statusPad}>
              <Text style={styles.doneCaption}>
                {clearDone ? t("settings.clearDone") : t("settings.syncDone")}
              </Text>
            </View>
          ) : null}
        </Card>
      </View>

      {/* Account: sign-in card when signed out; grouped rows when in. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.account")}</Text>
        {authed === false ? (
          <Card padding={0} style={styles.signInCard}>
            <Button
              title={t("common.signIn")}
              onPress={() => router.push("/login")}
            />
          </Card>
        ) : (
          <Card padding={0} style={styles.group}>
            <SettingsRow
              icon="person-outline"
              label={t("profile.title")}
              chevron
              disabled={authed === null}
              onPress={() => router.push("/profile")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="stopwatch-outline"
              label={t("tabs.pace")}
              chevron
              disabled={authed === null}
              onPress={() => router.push("/pace")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="add-circle-outline"
              label={t("settings.newRecipe")}
              chevron
              onPress={() => router.push("/recipe-composer")}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="log-out-outline"
              label={t("common.signOut")}
              chevron
              disabled={authed === null}
              onPress={handleSignOut}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="trash-outline"
              danger
              label={t("settings.deleteAccount")}
              caption={t("settings.deleteAccountHint")}
              busy={deleting}
              disabled={authed === null}
              onPress={confirmDeleteAccount}
            />
            {deleteFailed ? (
              <View style={styles.statusPad}>
                <Text style={styles.blockedCaption}>
                  {t("settings.deleteFailed")}
                </Text>
              </View>
            ) : null}
          </Card>
        )}
      </View>

      {/* About — one plain centered footer line, no card. */}
      <Text style={styles.aboutText}>{t("settings.about", { version })}</Text>
      </ScrollView>
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("tabs.settings")}
          collapse={collapse.scrollY}
          rights={headerRights}
        />
      </View>
    </View>
  );
}
