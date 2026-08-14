import { useEffect, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import {
  createCheckout,
  hasToken,
  openBillingPortal,
} from "@/api/client";
import { track } from "@/analytics";
import type { BillingPlan } from "@/types";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button, Card, Chip } from "@/components/ui";

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
  const colors = useThemeColors();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          paddingHorizontal: Space.lg,
        },
        columnWrap: {
          width: "100%",
          maxWidth: MaxContentWidth,
          alignSelf: "center",
          gap: Space.lg,
        },
        title: {
          ...Type.h1,
          color: colors.ink,
        },
        subtitle: {
          ...Type.body,
          color: colors.inkSecondary,
        },
        plans: {
          gap: Space.md,
        },
        planCard: {
          gap: Space.md,
        },
        planHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.sm,
        },
        planName: {
          ...Type.h3,
          color: colors.ink,
        },
        planPrice: {
          ...Type.h2,
          color: colors.ink,
        },
        planCadence: {
          ...Type.body,
          fontWeight: "500",
          color: colors.inkSecondary,
        },
        loginCard: {
          gap: Space.md,
        },
        loginText: {
          ...Type.body,
          color: colors.ink,
          fontWeight: "500",
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
          textAlign: "center",
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors],
  );

  // Re-check auth whenever the screen gains focus, so this refreshes after
  // returning from /login.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) setAuthed(ok);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Space.lg, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.columnWrap}>
        <Text style={styles.title}>Upgrade to Premium</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited recipes, personalized pace calibration, and cleanup
          estimates.
        </Text>

        {authed === false ? (
          <Card style={styles.loginCard}>
            <Text style={styles.loginText}>Log in to subscribe.</Text>
            <Button
              title="Sign in"
              size="lg"
              fullWidth
              onPress={() => router.push("/login")}
            />
          </Card>
        ) : (
          <View style={styles.plans}>
            <Chip label="Subscriptions coming soon" tone="amber" />
            {PLANS.map(({ plan, price, cadence, note }) => {
              const busy = pendingPlan === plan;
              return (
                <Card key={plan} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>
                      {plan === "yearly" ? "Yearly" : "Monthly"}
                    </Text>
                    {note ? (
                      <Chip label={note} tone="success" size="sm" />
                    ) : null}
                  </View>
                  <Text style={styles.planPrice}>
                    {price}
                    <Text style={styles.planCadence}> {cadence}</Text>
                  </Text>
                  <Button
                    title="Subscribe"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={busy}
                    disabled
                    onPress={() => handleSubscribe(plan)}
                  />
                </Card>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={portalPending ? "Loading…" : "Manage subscription"}
          variant="ghost"
          onPress={handleManage}
          disabled={portalPending || authed === false}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}
