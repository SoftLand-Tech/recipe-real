import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { grantAnalyticsConsent } from "@/analytics";
import { useT } from "@/i18n";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";
import { Button } from "@/components/ui";

const CONSENT_KEY = "consent.v1";
const PRIVACY_URL = "https://recipe-real.softland.tech/privacy";
const TERMS_URL = "https://recipe-real.softland.tech/terms";

/**
 * Whether the user opted INTO analytics sharing: true only for the stored
 * value 'accepted'. Anything else — 'essential', unset, or an unreadable
 * store — reports false so callers treat sharing as OFF by default.
 */
export async function hasAnalyticsConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "accepted";
  } catch {
    return false;
  }
}

export interface FirstRunConsentProps {
  /** Fired after Accept persists 'accepted' (the root layout re-reports). */
  onAccepted?: () => void;
}

/**
 * One privacy-policy link/tap row (pressed feedback via the state-driven
 * opacity dim — the repo-wide Android-safe pattern, never a style function).
 */
function ConsentLink({ label, url }: { label: string; url: string }) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const open = useCallback(() => {
    void Linking.openURL(url).catch(() => {
      // No browser / blocked URL — nothing to do in-app.
    });
  }, [url]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        link: {
          ...Type.bodySm,
          color: colors.accent,
          fontWeight: "600",
        },
        linkPressed: { opacity: 0.6 },
      }),
    [colors],
  );

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={open}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={pressed ? styles.linkPressed : null}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

/**
 * First-run analytics consent (mounted once from the root layout): a themed
 * modal shown only while AsyncStorage 'consent.v1' is unset. Accept stores
 * 'accepted' (analytics on) and notifies the caller; "Continue without
 * sharing" stores 'essential' (analytics off). The stored answer suppresses
 * every later mount, so this fires exactly once per install.
 */
export function FirstRunConsent({ onAccepted }: FirstRunConsentProps) {
  const colors = useThemeColors();
  const t = useT();
  const [visible, setVisible] = useState(false);

  // Show only when no answer is stored yet. A storage read failure keeps the
  // modal hidden (the essentials-only default) instead of nagging forever.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(CONSENT_KEY)
      .then((stored) => {
        if (!cancelled && stored == null) setVisible(true);
      })
      .catch(() => {
        // Unreadable storage — stay hidden, analytics stays off.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist the choice, close, and (on accept) notify the caller. */
  const decide = useCallback(
    async (value: "accepted" | "essential") => {
      await AsyncStorage.setItem(CONSENT_KEY, value).catch(() => {
        // Best-effort: close regardless so the app is never blocked.
      });
      // Analytics.ts caches its consent read per session — flip it here so
      // track() events flow immediately on Accept, not on the next launch.
      if (value === "accepted") grantAnalyticsConsent();
      setVisible(false);
      if (value === "accepted") onAccepted?.();
    },
    [onAccepted],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrim: {
          flex: 1,
          backgroundColor: colors.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: Space.xl,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.lg,
          padding: Space.xl,
          gap: Space.md,
          maxWidth: 420,
          width: "100%",
          ...Shadow.floating,
        },
        title: {
          ...Type.h3,
          color: colors.ink,
          textAlign: "center",
        },
        body: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        linksRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
        },
        actions: {
          gap: Space.sm,
          marginTop: Space.xs,
        },
      }),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // The question must be answered — Android back does not dismiss it
      // ("Continue without sharing" is the always-available way out).
      onRequestClose={() => {}}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("consent.title")}</Text>
          <Text style={styles.body}>{t("consent.body")}</Text>
          <View style={styles.linksRow}>
            <ConsentLink label={t("consent.privacy")} url={PRIVACY_URL} />
            <Text style={styles.body}>·</Text>
            <ConsentLink label={t("consent.terms")} url={TERMS_URL} />
          </View>
          <View style={styles.actions}>
            <Button
              title={t("consent.accept")}
              onPress={() => void decide("accepted")}
            />
            <Button
              title={t("consent.decline")}
              variant="ghost"
              onPress={() => void decide("essential")}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
