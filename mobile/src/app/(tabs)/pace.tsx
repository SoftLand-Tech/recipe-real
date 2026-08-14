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
import { Space, Type, useThemeColors } from "@/theme";
import {
  Button,
  Card,
  Chip,
  SectionHeader,
  StatPill,
  fmtMinutes,
  type ChipProps,
} from "@/components/ui";
import { computeStreak, summarizeHistory } from "@/utils/streaks";

type LoadState = "loading" | "ready" | "error" | "locked";

/** History rows visible before the "Show all" toggle expands the list. */
const HISTORY_PREVIEW_COUNT = 10;

/** Capitalize the first letter of a step_type for display. */
function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Friendly interpretation of a multiplier relative to the community average. */
function interpretPace(multiplier: number): string {
  if (multiplier < 0.9) return "Faster than average";
  if (multiplier > 1.1) return "Slower than average";
  return "About average";
}

/** Map a pace interpretation to a Chip tone. */
function paceTone(multiplier: number): "accent" | "neutral" | "amber" | "danger" {
  if (multiplier < 0.9) return "accent";
  if (multiplier > 1.1) return "danger";
  return "amber";
}

/** Map a history delta (%) to a Chip label + tone for the history list. */
function deltaChip(
  delta: number | null,
): { label: string; tone: ChipProps["tone"] } {
  if (delta == null) return { label: "—", tone: "neutral" };
  if (delta <= -10) {
    return { label: `${Math.abs(delta)}% faster`, tone: "success" };
  }
  if (delta >= 10) return { label: `+${delta}% slower`, tone: "danger" };
  return { label: "on pace", tone: "neutral" };
}

export default function PaceScreen() {
  const colors = useThemeColors();
  const [state, setState] = useState<LoadState>("loading");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  const [cookCount, setCookCount] = useState<number | null>(null);
  const [cookSessions, setCookSessions] = useState<CookSessionSummary[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Only show the loading spinner on the very first load. Refocuses (tab
  // switches, returning from /login) refresh silently while the previous
  // content stays visible — stale-while-revalidate.
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    if (firstLoadRef.current) {
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
      setCalibrations(paceResult);
      setCookCount(sessions?.meta?.total ?? sessions?.data?.length ?? 0);
      setCookSessions(sessions?.data ?? []);
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
          padding: Space.lg,
          paddingBottom: 40,
        },
        headerCard: {
          gap: Space.xs,
          marginBottom: Space.lg,
        },
        heading: {
          ...Type.h1,
          color: colors.ink,
        },
        subheading: {
          ...Type.body,
          color: colors.inkSecondary,
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
        <View style={styles.center}>
          <Text style={styles.signInTitle}>Track your pace</Text>
          <Text style={styles.muted}>
            Sign in to see your personal pace calibrations.
          </Text>
          <Button
            title="Sign in"
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Loading your pace…</Text>
        </View>
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.muted}>Could not load your pace data.</Text>
          <Button title="Retry" onPress={load} style={styles.cta} />
        </View>
      </View>
    );
  }

  if (state === "locked") {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.lockedTitle}>Premium feature</Text>
          <Text style={styles.muted}>
            Pace calibration is a Premium feature.
          </Text>
          <Button
            title="Upgrade"
            onPress={() => router.push("/upgrade")}
            style={styles.cta}
          />
          <Button
            title="Sign out"
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
      <View style={styles.headerCard}>
        <Text style={styles.heading}>Your Pace</Text>
        <Text style={styles.subheading}>
          {cookCount != null
            ? `${cookCount} ${cookCount === 1 ? "cook" : "cooks"} logged`
            : "Cooks logged"}
        </Text>
      </View>

      {calibrations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            Cook a few recipes to unlock your personal pace.
          </Text>
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
                  <Text style={styles.cardTitle}>{capitalize(c.step_type)}</Text>
                  <Chip
                    label={interpretPace(c.multiplier)}
                    tone={paceTone(c.multiplier)}
                    size="sm"
                  />
                </View>
                <Text style={styles.multiplier}>
                  {c.multiplier.toFixed(1)}× the community average
                </Text>
                <StatPill
                  label="Confidence"
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
                label="Day streak"
                value={`${streak.currentStreak}`}
                tone="accent"
              />
              <StatPill label="This week" value={`${streak.weekCount}`} />
              <StatPill label="Best" value={`${streak.bestStreak}`} />
            </View>
          </Card>

          {/* Cook history */}
          <View>
            <SectionHeader title="Cook history" />
            <View style={styles.list}>
              {visibleHistory.map((entry) => {
                const chip = deltaChip(entry.deltaPercent);
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
                            ? fmtMinutes(entry.actualMinutes)
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
                title={showAllHistory ? "Show less" : "Show all"}
                variant="ghost"
                onPress={() => setShowAllHistory((v) => !v)}
                style={styles.showAllButton}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Button
        title="Sign out"
        variant="ghost"
        onPress={handleSignOut}
        style={styles.listSignOut}
      />
    </ScrollView>
  );
}
