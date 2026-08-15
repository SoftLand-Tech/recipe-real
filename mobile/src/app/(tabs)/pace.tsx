import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  getCookSessions,
  getUsage,
  hasToken,
  isPaywallError,
  logout,
} from "@/api/client";
import { track } from "@/analytics";
import { refreshPaceCalibrations } from "@/db/database";
import type { CookSessionSummary, PaceCalibration } from "@/types";
import { stepTypeLabel, useFmtMinutes, useT, type TranslateFn } from "@/i18n";
import { Space, Type, useThemeColors } from "@/theme";
import {
  Button,
  Card,
  Chip,
  ScreenHeader,
  SectionHeader,
  StatPill,
  type ChipProps,
} from "@/components/ui";
import { computeStreak, summarizeHistory } from "@/utils/streaks";

type LoadState = "loading" | "ready" | "error" | "locked";

/** History rows visible before the "Show all" toggle expands the list. */
const HISTORY_PREVIEW_COUNT = 10;

// ---- Remount cache + identity fingerprints ----------------------------------
//
// Tab screens unmount/remount as the user navigates; without a cache the pace
// tab would flash its first-visit spinner on every remount. The last payloads
// live at module level so a remount renders instantly from the cache and the
// focus load refreshes silently (stale-while-revalidate across unmounts).
// The fingerprints let refocus refreshes skip the setState entirely when the
// server returns identical data — fresh array identities would re-render the
// whole list (and reset in-flight interactions) for nothing.
let lastCalibrations: PaceCalibration[] | null = null;
let lastCookCount: number | null = null;
let lastSessions: CookSessionSummary[] | null = null;
let lastCalibrationsFp = "";
let lastSessionsFp = "";

/**
 * Clear the module-level remount cache (previous account's pace data).
 * Called on sign-out — from this screen AND from Settings (imported there) —
 * so the next signed-in user never sees the previous user's calibrations or
 * cook history flash on remount.
 */
export function clearPaceCache(): void {
  lastCalibrations = null;
  lastCookCount = null;
  lastSessions = null;
  lastCalibrationsFp = "";
  lastSessionsFp = "";
}

/** Cheap change fingerprint for the pace calibration list. */
function calibrationsFingerprint(items: PaceCalibration[]): string {
  return items
    .map((c) => `${c.step_type}:${c.multiplier}:${c.confidence}`)
    .join("|");
}

/** Cheap change fingerprint for the cook-session list. */
function sessionsFingerprint(items: CookSessionSummary[]): string {
  return items
    .map((s) => `${s.id}:${s.created_at}:${s.total_actual_minutes}`)
    .join("|");
}

/** Friendly interpretation of a multiplier relative to the community average. */
function interpretPace(t: TranslateFn, multiplier: number): string {
  if (multiplier < 0.9) return t("pace.fasterThan");
  if (multiplier > 1.1) return t("pace.slowerThan");
  return t("pace.aboutAverage");
}

/** Map a pace interpretation to a Chip tone. */
function paceTone(multiplier: number): "accent" | "neutral" | "amber" | "danger" {
  if (multiplier < 0.9) return "accent";
  if (multiplier > 1.1) return "danger";
  return "amber";
}

/** Map a history delta (%) to a Chip label + tone for the history list. */
function deltaChip(
  t: TranslateFn,
  delta: number | null,
): { label: string; tone: ChipProps["tone"] } {
  if (delta == null) return { label: "—", tone: "neutral" };
  if (delta <= -10) {
    return { label: t("pace.pctFaster", { n: Math.abs(delta) }), tone: "success" };
  }
  if (delta >= 10) {
    return { label: t("pace.pctSlower", { n: delta }), tone: "danger" };
  }
  return { label: t("pace.onPace"), tone: "neutral" };
}

export default function PaceScreen() {
  const colors = useThemeColors();
  const t = useT();
  const fmtMin = useFmtMinutes();
  const [state, setState] = useState<LoadState>(() =>
    lastCalibrations != null || lastSessions != null ? "ready" : "loading",
  );
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>(
    () => lastCalibrations ?? [],
  );
  const [cookCount, setCookCount] = useState<number | null>(
    () => lastCookCount,
  );
  const [cookSessions, setCookSessions] = useState<CookSessionSummary[]>(
    () => lastSessions ?? [],
  );
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Only show the loading spinner on the very first load. Refocuses (tab
  // switches, returning from /login) refresh silently while the previous
  // content stays visible — stale-while-revalidate. A remount with cached
  // payloads also skips the spinner and renders the cache immediately.
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    if (firstLoadRef.current && lastCalibrations == null && lastSessions == null) {
      setState("loading");
    }
    try {
      const authed = await hasToken();
      setAuthenticated(authed);
      if (!authed) {
        setState("ready");
        return;
      }

      // Usage is the authoritative premium signal. Pace calibration is a
      // Premium feature: if the user is not premium, surface the upgrade CTA
      // instead of the multipliers.
      const usage = await getUsage().catch(() => null);
      if (usage && usage.premium === false) {
        setState("locked");
        return;
      }

      const [paceResult, sessions] = await Promise.all([
        refreshPaceCalibrations(),
        getCookSessions().catch(() => null),
      ]);
      const nextSessions = sessions?.data ?? [];

      // Identity guards: only hand React a new array when the payload actually
      // changed (compare fingerprints), so refocus refreshes don't re-render
      // the calibration cards / history rows mid-interaction.
      const calibFp = calibrationsFingerprint(paceResult);
      if (calibFp !== lastCalibrationsFp) {
        lastCalibrationsFp = calibFp;
        setCalibrations(paceResult);
      }
      const sessionsFp = sessionsFingerprint(nextSessions);
      if (sessionsFp !== lastSessionsFp) {
        lastSessionsFp = sessionsFp;
        setCookSessions(nextSessions);
      }
      setCookCount(sessions?.meta?.total ?? sessions?.data?.length ?? 0);

      // Refresh the remount cache (skip caching a failed sessions fetch — an
      // empty list from a network error shouldn't blank the next remount).
      lastCalibrations = paceResult;
      if (sessions) {
        lastSessions = nextSessions;
        lastCookCount = sessions.meta?.total ?? sessions.data.length ?? 0;
      }
      setState("ready");
      // Fire-and-forget analytics: pace dashboard rendered with multipliers.
      // Only on the first load — silent refocus refreshes don't re-count.
      if (paceResult.length > 0 && firstLoadRef.current) {
        track("pace_viewed");
      }
    } catch (error) {
      // A 402 from the pace fetch is also a paywall state.
      if (isPaywallError(error)) {
        setState("locked");
        return;
      }
      console.warn("[RecipeReal] pace screen load failed:", error);
      setState("error");
    } finally {
      firstLoadRef.current = false;
    }
  }, []);

  // Re-run the auth check + load whenever the screen gains focus, so pace
  // refreshes after returning from /login (sign-in / sign-out).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // logout() clears the stored token in its finally block; ignore errors.
    }
    clearPaceCache();
    setAuthenticated(false);
    setCalibrations([]);
    setCookCount(null);
    setCookSessions([]);
    setState("ready");
  }, []);

  // Streak + history are derived from the cook-session data the load already
  // fetches; recomputed only when the session list changes.
  const streak = useMemo(() => computeStreak(cookSessions), [cookSessions]);
  const history = useMemo(() => summarizeHistory(cookSessions), [cookSessions]);
  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, HISTORY_PREVIEW_COUNT);

  // Fire-and-forget analytics: cook history section rendered with data.
  // Tracked once per screen mount, not on silent refocus refreshes.
  const historyViewedRef = useRef(false);
  useEffect(() => {
    if (history.length > 0 && !historyViewedRef.current) {
      historyViewedRef.current = true;
      track("history_viewed");
    }
  }, [history.length]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          paddingHorizontal: Space.lg,
          paddingBottom: 40,
        },
        list: {
          gap: Space.md,
        },
        card: {
          gap: Space.sm,
        },
        cardHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.sm,
        },
        cardTitle: {
          ...Type.h3,
          color: colors.ink,
        },
        multiplier: {
          ...Type.body,
          color: colors.ink,
          fontWeight: "500",
        },
        historySection: {
          marginTop: Space.lg,
          gap: Space.lg,
        },
        streakRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.md,
        },
        historyRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.md,
        },
        historyMain: {
          flex: 1,
          gap: 2,
        },
        historyTitle: {
          ...Type.body,
          fontWeight: "600",
          color: colors.ink,
        },
        historyDate: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        historyRight: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        historyMinutes: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.inkSecondary,
        },
        showAllButton: {
          alignSelf: "flex-start",
          marginTop: Space.xs,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: 64,
          paddingHorizontal: Space.xxl,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        errorTitle: {
          ...Type.title,
          color: colors.danger,
        },
        signInTitle: {
          ...Type.h2,
          color: colors.ink,
          textAlign: "center",
        },
        lockedTitle: {
          ...Type.title,
          color: colors.accent,
          fontWeight: "700",
        },
        cta: {
          marginTop: Space.sm,
        },
        secondaryCta: {
          marginTop: Space.xs,
        },
        listSignOut: {
          marginTop: Space.xl,
        },
      }),
    [colors],
  );

  // Not authenticated: friendly sign-in prompt.
  if (state === "ready" && authenticated === false) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("tabs.pace")} />
        <View style={styles.center}>
          <Text style={styles.signInTitle}>{t("pace.trackTitle")}</Text>
          <Text style={styles.muted}>{t("pace.signInPrompt")}</Text>
          <Button
            title={t("common.signIn")}
            size="lg"
            onPress={() => router.push("/login")}
            style={styles.cta}
          />
        </View>
      </View>
    );
  }

  if (state === "loading") {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("tabs.pace")} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>{t("pace.loading")}</Text>
        </View>
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("tabs.pace")} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.muted}>{t("pace.couldNotLoad")}</Text>
          <Button title={t("common.retry")} onPress={load} style={styles.cta} />
        </View>
      </View>
    );
  }

  if (state === "locked") {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("tabs.pace")} />
        <View style={styles.center}>
          <Text style={styles.lockedTitle}>{t("pace.premiumTitle")}</Text>
          <Text style={styles.muted}>{t("pace.premiumBody")}</Text>
          <Button
            title={t("common.upgrade")}
            onPress={() => router.push("/upgrade")}
            style={styles.cta}
          />
          <Button
            title={t("common.signOut")}
            variant="ghost"
            onPress={handleSignOut}
            style={styles.secondaryCta}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={t("tabs.pace")}
        subtitle={
          cookCount != null
            ? cookCount === 1
              ? t("pace.cooksOne", { n: cookCount })
              : t("pace.cooksMany", { n: cookCount })
            : t("pace.cooksLabel")
        }
      />

      {calibrations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("pace.emptyCalibrations")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {calibrations.map((c) => {
            const confidencePct = Math.round(
              Math.max(0, Math.min(1, c.confidence)) * 100,
            );
            return (
              <Card key={c.step_type} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {stepTypeLabel(t, c.step_type)}
                  </Text>
                  <Chip
                    label={interpretPace(t, c.multiplier)}
                    tone={paceTone(c.multiplier)}
                    size="sm"
                  />
                </View>
                <Text style={styles.multiplier}>
                  {t("pace.multiplier", { x: c.multiplier.toFixed(1) })}
                </Text>
                <StatPill
                  label={t("pace.confidence")}
                  value={`${confidencePct}%`}
                />
              </Card>
            );
          })}
        </View>
      )}

      {cookSessions.length > 0 ? (
        <View style={styles.historySection}>
          {/* Streak banner */}
          <Card>
            <View style={styles.streakRow}>
              <StatPill
                label={t("pace.dayStreak")}
                value={`${streak.currentStreak}`}
                tone="accent"
              />
              <StatPill
                label={t("pace.thisWeek")}
                value={`${streak.weekCount}`}
              />
              <StatPill
                label={t("pace.best")}
                value={`${streak.bestStreak}`}
              />
            </View>
          </Card>

          {/* Cook history */}
          <View>
            <SectionHeader title={t("pace.history")} />
            <View style={styles.list}>
              {visibleHistory.map((entry) => {
                const chip = deltaChip(t, entry.deltaPercent);
                return (
                  <Card key={entry.id} padding={Space.md}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyMain}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {entry.title}
                        </Text>
                        <Text style={styles.historyDate}>{entry.date}</Text>
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={styles.historyMinutes} numberOfLines={1}>
                          {entry.actualMinutes != null
                            ? fmtMin(entry.actualMinutes)
                            : "—"}
                        </Text>
                        <Chip label={chip.label} tone={chip.tone} size="sm" />
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
            {history.length > HISTORY_PREVIEW_COUNT ? (
              <Button
                title={showAllHistory ? t("pace.showLess") : t("pace.showAll")}
                variant="ghost"
                onPress={() => setShowAllHistory((v) => !v)}
                style={styles.showAllButton}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Button
        title={t("common.signOut")}
        variant="ghost"
        onPress={handleSignOut}
        style={styles.listSignOut}
      />
    </ScrollView>
  );
}
