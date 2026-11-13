import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import { hasToken, openBillingPortal } from "@/api/client";
import { track } from "@/analytics";
import { useT } from "@/i18n";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button, Card, Chip, ScreenScrollView, ScreenView } from "@/components/ui";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";

/**
 * Plan rows are DISPLAY-ONLY while billing is "coming soon": prices are
 * hardcoded here and the subscribe buttons render disabled with no press
 * handler. When billing ships, wire each row's button to createCheckout()
 * (see the git history of this file for the previous flow).
 */
const PLANS: {
  plan: "monthly" | "yearly";
  price: string;
  cadenceKey: string;
  noteKey?: string;
}[] = [
  {
    plan: "monthly",
    price: "$5.99",
    cadenceKey: "upgrade.perMonth",
  },
  {
    plan: "yearly",
    price: "$49.99",
    cadenceKey: "upgrade.perYear",
    noteKey: "upgrade.save30",
  },
];

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once-only guard for the upgrade_viewed analytics event (fires after the
  // auth state resolved, not on the spinner frame).
  const viewedTrackedRef = useRef(false);

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
  // returning from /login. The view event fires once, after auth resolved.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) {
          setAuthed(ok);
          if (!viewedTrackedRef.current) {
            viewedTrackedRef.current = true;
            track("upgrade_viewed");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleManage() {
    setError(null);
    setPortalPending(true);
    try {
      const url = await openBillingPortal();
      if (url) {
        await openBrowserAsync(url);
      } else {
        // Portal reachable but returned no URL — surface it instead of
        // silently doing nothing.
        setError(t("upgrade.errPortal"));
      }
    } catch {
      // Best-effort: don't block the user on portal failures.
      setError(t("upgrade.errPortal"));
    } finally {
      setPortalPending(false);
    }
  }

  if (authed === null) {
    return (
      <View style={styles.container}>
        <ScreenView style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </ScreenView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PinnedHeaderBar title={t("stack.premium")} leading={<BackChevron />} />
      <ScreenScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: Space.lg,
          paddingBottom: insets.bottom + 32,
        }}
      >
      <View style={styles.columnWrap}>
        <Text style={styles.title}>{t("upgrade.headline")}</Text>
        <Text style={styles.subtitle}>{t("upgrade.subtitle")}</Text>

        {authed === false ? (
          <Card style={styles.loginCard}>
            <Text style={styles.loginText}>{t("upgrade.loginPrompt")}</Text>
            <Button
              title={t("common.signIn")}
              size="lg"
              fullWidth
              onPress={() => router.push("/login")}
            />
          </Card>
        ) : (
          <View style={styles.plans}>
            <Chip label={t("upgrade.comingSoon")} tone="amber" />
            {PLANS.map(({ plan, price, cadenceKey, noteKey }) => {
              return (
                <Card key={plan} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>
                      {plan === "yearly"
                        ? t("upgrade.yearly")
                        : t("upgrade.monthly")}
                    </Text>
                    {noteKey ? (
                      <Chip label={t(noteKey)} tone="success" size="sm" />
                    ) : null}
                  </View>
                  <Text style={styles.planPrice}>
                    {price}
                    <Text style={styles.planCadence}> {t(cadenceKey)}</Text>
                  </Text>
                  {/* Display-only while billing is coming soon — no handler. */}
                  <Button
                    title={t("upgrade.subscribe")}
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled
                  />
                </Card>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={portalPending ? t("upgrade.loading") : t("upgrade.manage")}
          variant="ghost"
          onPress={handleManage}
          disabled={portalPending || authed === false}
          fullWidth
        />
      </View>
      </ScreenScrollView>
    </View>
  );
}
