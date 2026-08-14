import { useCallback, useState } from "react";
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
import type { PaceCalibration } from "@/types";
import { Color, Space, Type } from "@/theme";
import { Button, Card, Chip, StatPill } from "@/components/ui";

type LoadState = "loading" | "ready" | "error" | "locked";

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

export default function PaceScreen() {
  const [state, setState] = useState<LoadState>("loading");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  const [cookCount, setCookCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState("loading");
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
      setState("ready");
      // Fire-and-forget analytics: pace dashboard rendered with multipliers.
      if (paceResult.length > 0) {
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
    setState("ready");
  }, []);

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
          <ActivityIndicator size="large" color={Color.accent} />
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

      <Button
        title="Sign out"
        variant="ghost"
        onPress={handleSignOut}
        style={styles.listSignOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.canvas,
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
    color: Color.ink,
  },
  subheading: {
    ...Type.body,
    color: Color.inkSecondary,
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
    color: Color.ink,
  },
  multiplier: {
    ...Type.body,
    color: Color.ink,
    fontWeight: "500",
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
    color: Color.inkSecondary,
    textAlign: "center",
  },
  errorTitle: {
    ...Type.title,
    color: Color.danger,
  },
  signInTitle: {
    ...Type.h2,
    color: Color.ink,
    textAlign: "center",
  },
  lockedTitle: {
    ...Type.title,
    color: Color.accent,
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
});
