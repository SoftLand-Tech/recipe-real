import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openBrowserAsync } from "expo-web-browser";

import {
  createCheckout,
  hasToken,
  openBillingPortal,
} from "@/api/client";
import { track } from "@/analytics";
import type { BillingPlan } from "@/types";

const PLANS: {
  plan: BillingPlan;
  price: string;
  cadence: string;
  note?: string;
}[] = [
  {
    plan: "monthly",
    price: "$5.99",
    cadence: "/ month",
  },
  {
    plan: "yearly",
    price: "$49.99",
    cadence: "/ year",
    note: "save ~30%",
  },
];

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await hasToken();
      if (!cancelled) setAuthed(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire-and-forget analytics: upgrade screen viewed.
  useEffect(() => {
    track("upgrade_viewed");
  }, []);

  async function handleSubscribe(plan: BillingPlan) {
    setError(null);
    setPendingPlan(plan);
    try {
      const url = await createCheckout(plan);
      if (url) {
        // Fire-and-forget analytics right before opening the checkout browser.
        track("upgrade_checkout_opened", { plan });
        await openBrowserAsync(url);
      }
    } catch (e) {
      // 503 = billing not configured on the backend; anything else is still a
      // "can't reach checkout right now" state for the user.
      setError("Billing isn't available yet.");
    } finally {
      setPendingPlan(null);
    }
  }

  async function handleManage() {
    setError(null);
    setPortalPending(true);
    try {
      const url = await openBillingPortal();
      if (url) {
        await openBrowserAsync(url);
      }
    } catch {
      // Best-effort: don't block the user on portal failures.
      setError("Couldn't open subscription management right now.");
    } finally {
      setPortalPending(false);
    }
  }

  if (authed === null) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.columnWrap}>
        <Text style={styles.title}>Upgrade to Premium</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited recipes, personalized pace calibration, and cleanup
          estimates.
        </Text>

        {authed === false ? (
          <View style={styles.loginCard}>
            <Text style={styles.loginText}>Log in to subscribe.</Text>
          </View>
        ) : (
          <View style={styles.plans}>
            {PLANS.map(({ plan, price, cadence, note }) => {
              const busy = pendingPlan === plan;
              return (
                <View key={plan} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>
                      {plan === "yearly" ? "Yearly" : "Monthly"}
                    </Text>
                    {note ? (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveBadgeText}>{note}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planPrice}>
                    {price}
                    <Text style={styles.planCadence}> {cadence}</Text>
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cta,
                      pressed && styles.ctaPressed,
                      busy && styles.ctaDisabled,
                    ]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={pendingPlan != null}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.ctaText}>Subscribe</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.manageLink,
            pressed && styles.manageLinkPressed,
          ]}
          onPress={handleManage}
          disabled={portalPending || authed === false}
        >
          <Text style={styles.manageLinkText}>
            {portalPending ? "Loading…" : "Manage subscription"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 16,
  },
  columnWrap: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 21,
  },
  plans: {
    gap: 12,
  },
  planCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  saveBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  saveBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  planPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  planCadence: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  cta: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaPressed: {
    backgroundColor: "#1D4ED8",
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  loginCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    padding: 16,
  },
  loginText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
  },
  manageLink: {
    paddingVertical: 8,
    alignItems: "center",
  },
  manageLinkPressed: {
    opacity: 0.6,
  },
  manageLinkText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
