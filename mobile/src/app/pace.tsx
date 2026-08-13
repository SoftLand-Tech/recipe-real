import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { getCookSessions, getUsage, hasToken, isPaywallError } from "@/api/client";
import { track } from "@/analytics";
import { refreshPaceCalibrations } from "@/db/database";
import type { PaceCalibration } from "@/types";

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

  useEffect(() => {
    load();
  }, [load]);

  // Not authenticated: show a friendly message (no login screen exists yet).
  if (state === "ready" && authenticated === false) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Log in to see your personalized pace.
          </Text>
        </View>
      </View>
    );
  }

  if (state === "loading") {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
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
          <Pressable style={styles.button} onPress={load}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
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
          <Pressable
            style={styles.button}
            onPress={() => router.push("/upgrade")}
          >
            <Text style={styles.buttonText}>Upgrade</Text>
          </Pressable>
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
              <View key={c.step_type} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{capitalize(c.step_type)}</Text>
                  <Text style={styles.paceTag}>{interpretPace(c.multiplier)}</Text>
                </View>
                <Text style={styles.multiplier}>
                  {c.multiplier.toFixed(1)}× the community average
                </Text>
                <Text style={styles.confidence}>
                  confidence: {confidencePct}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    gap: 4,
    marginBottom: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  subheading: {
    fontSize: 15,
    color: "#6B7280",
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  paceTag: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },
  multiplier: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  confidence: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "600",
  },
  lockedTitle: {
    color: "#7C3AED",
    fontSize: 17,
    fontWeight: "700",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
