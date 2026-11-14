import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  I18nManager,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import {
  PinnedHeaderBar,
  useChromeContentBottomPad,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";

import { cancelAllScheduledNotifications } from "@/utils/cookAlarms";
import {
  isNotificationsAvailable,
  requestNotificationsPermission,
  syncNudgePrefWithPermission,
} from "@/utils/notifications";

import { deleteAccount, hasToken, logout } from "@/api/client";
import { AI_IMPORT_ENABLED } from "@/config";
import {
  clearRecipeCache,
  countCachedRecipes,
  seedCacheFirstPage,
  seedCacheRemainingPages,
  SEED_PAGE_SIZE,
} from "@/db/database";
import {
  computeKitchenProfile,
  getKitchenProfile,
  saveKitchenProfile,
  setNudgePref,
  syncKitchenProfileToLocalPace,
  type KitchenEnvPref,
  type KitchenProfile,
  type PrepSpeedPref,
} from "@/utils/prefs";
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
  ConfirmDialog,
  IconPressable,
  Toggle,
  useHeaderActionsRights,
} from "@/components/ui";

/** Legal pages, opened in the system browser (same URLs as the consent modal). */
const PRIVACY_URL = "https://recipe-real.softland.tech/privacy";
const TERMS_URL = "https://recipe-real.softland.tech/terms";

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

const PREP_SPEED_OPTIONS: { pref: PrepSpeedPref; labelKey: string }[] = [
  { pref: "relaxed", labelKey: "settings.prepRelaxed" },
  { pref: "steady", labelKey: "settings.prepSteady" },
  { pref: "fast", labelKey: "settings.prepFast" },
];

const KITCHEN_ENV_OPTIONS: { pref: KitchenEnvPref; labelKey: string }[] = [
  { pref: "focused", labelKey: "settings.envFocused" },
  { pref: "busy", labelKey: "settings.envBusy" },
  { pref: "hectic", labelKey: "settings.envHectic" },
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

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [kitchenProfile, setKitchenProfile] = useState<KitchenProfile>(() =>
    computeKitchenProfile("steady", "focused"),
  );
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
  /** Centered sign-out confirmation (never a native Alert). */
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
          // Content is full-bleed; captions are text and must not touch
          // the screen edge.
          marginHorizontal: Space.lg,
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
        // Count + chevron at a tappable row's end.
        endRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
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
          marginHorizontal: Space.lg,
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

  const applyNudgePref = useCallback((nudge: "on" | "off") => {
    const enabled = nudge === "on";
    setNudgeOn(enabled);
    if (enabled) {
      setNudgeBlocked(false);
      setNudgeUnavailable(false);
    }
  }, []);

  // Refresh auth + sync the nudge preference with OS permission on mount /
  // focus, so account rows and the Notifications switch stay accurate after
  // returning from /login, Cook Mode, Recipe Detail, or OS Settings.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [ok, nudge, profile] = await Promise.all([
          hasToken(),
          syncNudgePrefWithPermission(),
          getKitchenProfile(),
        ]);
        if (cancelled) return;
        setAuthed(ok);
        applyNudgePref(nudge);
        setKitchenProfile(profile);
      })();
      void reloadCachedCount();
      return () => {
        cancelled = true;
      };
    }, [applyNudgePref, reloadCachedCount]),
  );

  // Also re-sync immediately when returning to the foreground from OS Settings
  // while the Settings screen is already focused.
  useEffect(() => {
    let mounted = true;
    void syncNudgePrefWithPermission().then((nudge) => {
      if (mounted) applyNudgePref(nudge);
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void syncNudgePrefWithPermission().then((nudge) => {
        if (mounted) applyNudgePref(nudge);
      });
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [applyNudgePref]);

  const refreshAuth = useCallback(async () => {
    setAuthed(await hasToken());
  }, []);

  const profileTapSeqRef = useRef(0);
  const handleKitchenProfileChange = useCallback(
    async (patch: Partial<Pick<KitchenProfile, "prepSpeed" | "kitchenEnv">>) => {
      const seq = ++profileTapSeqRef.current;
      setKitchenProfile((prev) =>
        computeKitchenProfile(
          patch.prepSpeed ?? prev.prepSpeed,
          patch.kitchenEnv ?? prev.kitchenEnv,
        ),
      );
      const next = await saveKitchenProfile(patch);
      if (seq === profileTapSeqRef.current) {
        setKitchenProfile(next);
      }
      await syncKitchenProfileToLocalPace(next);
      clearPaceCache();
    },
    [],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // logout() clears the stored token in its finally block; ignore errors.
    }
    // Drop any still-scheduled cook alarms — they belong to the signed-out
    // user's sessions and must not fire for whoever picks up the device next.
    await cancelAllScheduledNotifications();
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
      // The account (and its cook sessions) is gone server-side; cancel any
      // of its alarms still scheduled locally too.
      await cancelAllScheduledNotifications();
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
   * discoverability, not friction, so one confirm is enough.
   */
  const confirmDeleteAccount = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const handleNudgeToggle = useCallback(async (value: boolean) => {
    setNudgeOn(value);
    setNudgeBlocked(false);
    setNudgeUnavailable(false);
    if (!value) {
      await setNudgePref("off");
      return;
    }
    // expo-notifications cannot load in Expo Go on Android — surface that
    // instead of failing silently. Otherwise best-effort permission request;
    // if the system denies/blocks, revert the switch and hint at system
    // settings instead.
    if (!(await isNotificationsAvailable())) {
      setNudgeOn(false);
      await setNudgePref("off");
      setNudgeUnavailable(true);
      return;
    }
    const granted = await requestNotificationsPermission();
    setNudgeOn(granted);
    if (!granted) {
      await setNudgePref("off");
    }
    setNudgeBlocked(!granted);
  }, []);

  /**
   * Library sync. "quick" ADDS the next ~200 recipes the cache doesn't
   * cover yet (starts right past the cached page count — no re-downloading
   * the top rows the library already has). "deep" re-walks the whole seed
   * (first page + everything to the server's last page).
   */
  const handleSync = useCallback(
    async (mode: "quick" | "deep") => {
      if (syncingOption != null) return;
      setSyncingOption(mode);
      setSyncDone(false);
      try {
        if (mode === "quick") {
          const cached = await countCachedRecipes();
          const startPage = Math.floor(cached / SEED_PAGE_SIZE) + 1;
          await seedCacheRemainingPages({ startPage, pages: 4 });
        } else {
          await seedCacheFirstPage();
          await seedCacheRemainingPages();
        }
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
    setConfirmClear(true);
  }, []);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "upToDate" | "failed"
  >("idle");

  /** Manual OTA update check (EAS Update). An auto-check already runs on
      launch; this row lets the user force one and restart into the fix. */
  const handleCheckUpdates = useCallback(async () => {
    if (updateStatus === "checking") return;
    setUpdateStatus("checking");
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setUpdateStatus("upToDate");
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert(
        t("settings.updateReadyTitle"),
        t("settings.updateReadyBody"),
        [
          {
            text: t("settings.updateLater"),
            style: "cancel",
            onPress: () => setUpdateStatus("idle"),
          },
          {
            text: t("settings.updateRestart"),
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        ],
      );
    } catch (error) {
      console.warn("[RecipeReal] update check failed:", error);
      setUpdateStatus("failed");
    }
  }, [t, updateStatus]);

  const updateCaption =
    updateStatus === "checking"
      ? t("settings.updateChecking")
      : updateStatus === "upToDate"
        ? t("settings.updateUpToDate")
        : updateStatus === "failed"
          ? t("settings.updateFailed")
          : t("settings.updateAuto");

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: barPad, paddingBottom: chromeBottomPad },
        ]}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
      >
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

      {/* Kitchen profile: baseline prep speed + kitchen environment. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.kitchenProfile")}</Text>
        <Card padding={0} style={styles.group}>
          <SettingsRow
            icon="cut-outline"
            label={t("settings.prepSpeed")}
            caption={t("settings.prepSpeedCaption")}
            below={PREP_SPEED_OPTIONS.map(({ pref: option, labelKey }) => (
              <IconPressable
                key={option}
                onPress={() =>
                  void handleKitchenProfileChange({ prepSpeed: option })
                }
                accessibilityLabel={t(labelKey)}
              >
                <Chip
                  label={t(labelKey)}
                  tone={
                    kitchenProfile.prepSpeed === option ? "accent" : "neutral"
                  }
                />
              </IconPressable>
            ))}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="home-outline"
            label={t("settings.kitchenEnv")}
            caption={t("settings.kitchenEnvCaption")}
            below={KITCHEN_ENV_OPTIONS.map(({ pref: option, labelKey }) => (
              <IconPressable
                key={option}
                onPress={() =>
                  void handleKitchenProfileChange({ kitchenEnv: option })
                }
                accessibilityLabel={t(labelKey)}
              >
                <Chip
                  label={t(labelKey)}
                  tone={
                    kitchenProfile.kitchenEnv === option ? "accent" : "neutral"
                  }
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
                <View style={styles.endRow}>
                  <Text style={styles.countText}>
                    {t("settings.recipesCached", { n: cachedCount })}
                  </Text>
                  <Ionicons
                    name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
                    size={18}
                    color={colors.inkFaint}
                  />
                </View>
              ) : null
            }
            onPress={() => router.push("/browse")}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download-outline"
            label={t("settings.syncTop200")}
            chevron
            busy={syncingOption === "quick"}
            disabled={syncingOption != null && syncingOption !== "quick"}
            onPress={() => handleSync("quick")}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cloud-download"
            label={t("settings.syncDeep")}
            chevron
            busy={syncingOption === "deep"}
            disabled={syncingOption != null && syncingOption !== "deep"}
            onPress={() => handleSync("deep")}
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

      {/* App updates: auto-check runs on launch; manual check + restart here. */}
      <View>
        <Text style={styles.groupCaption}>{t("settings.appUpdates")}</Text>
        <Card padding={0} style={styles.group}>
          <SettingsRow
            icon="download-outline"
            label={t("settings.checkUpdates")}
            caption={updateCaption}
            chevron
            busy={updateStatus === "checking"}
            disabled={updateStatus === "checking"}
            onPress={handleCheckUpdates}
          />
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
            {AI_IMPORT_ENABLED ? (
              <>
                <SettingsRow
                  icon="sparkles-outline"
                  label={t("import.start")}
                  chevron
                  onPress={() => router.push("/recipe-import")}
                />
                <View style={styles.divider} />
              </>
            ) : null}
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
              onPress={() => setConfirmSignOut(true)}
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

      {/* Legal: privacy policy + terms, opened in the system browser. */}
      <Card padding={0} style={styles.group}>
        <SettingsRow
          icon="shield-checkmark-outline"
          label={t("settings.privacyPolicy")}
          chevron
          onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
        />
        <View style={styles.divider} />
        <SettingsRow
          icon="document-text-outline"
          label={t("settings.termsOfService")}
          chevron
          onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})}
        />
      </Card>

      {/* About — one plain centered footer line, no card. */}
      <Text style={styles.aboutText}>{t("settings.about", { version })}</Text>
      </ScrollView>
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("tabs.settings")}
          hidden={chrome.hidden}
          rights={headerRights}
        />
      </View>

      {/* Sign-out confirmation — same centered dialog as cook mode, never a
          native Alert; the session only ends once the user confirms. */}
      <ConfirmDialog
        visible={confirmSignOut}
        tone="destructive"
        icon="log-out-outline"
        iconSize={26}
        title={t("settings.signOutConfirmTitle")}
        message={t("settings.signOutConfirmMessage")}
        confirmLabel={t("common.signOut")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          setConfirmSignOut(false);
          void handleSignOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
      {/* Delete-account + clear-library confirmations — migrated off native
          Alert onto the same centered dialog (never Alert.alert). */}
      <ConfirmDialog
        visible={confirmDelete}
        tone="destructive"
        icon="trash-outline"
        title={t("settings.deleteConfirmTitle")}
        message={t("settings.deleteConfirmMessage")}
        confirmLabel={t("settings.deleteConfirmBtn")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          setConfirmDelete(false);
          void handleDeleteAccount();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        visible={confirmClear}
        tone="destructive"
        icon="cloud-offline-outline"
        title={t("settings.clearCache")}
        message={t("settings.clearCacheConfirm")}
        confirmLabel={t("settings.clearCache")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          setConfirmClear(false);
          void handleClearCache();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </View>
  );
}
