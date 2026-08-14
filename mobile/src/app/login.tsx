import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import axios from "axios";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import {
  getDefaultReturnUrl,
  getRedirectUrl,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { loginWithGoogle } from "@/api/client";
import { track } from "@/analytics";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button } from "@/components/ui";

const GOOGLE_CLIENT_ID_PLACEHOLDER = "REPLACE_WITH_GOOGLE_WEB_CLIENT_ID";

/** Resolve the Google Web Client ID from `expo.extra`, or null if unset/placeholder. */
function resolveGoogleClientId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { googleWebClientId?: string }
    | undefined;
  const clientId = extra?.googleWebClientId?.trim();
  if (!clientId || clientId === GOOGLE_CLIENT_ID_PLACEHOLDER) return null;
  return clientId;
}

/**
 * The Expo proxy redirect URL (`https://auth.expo.io/@owner/slug`). SDK 57's
 * expo-auth-session no longer wires the proxy into `promptAsync`, so the flow
 * is assembled here from the same public building blocks. Returns null when the
 * proxy can't be resolved (e.g. missing project full name).
 */
function resolveProxyRedirectUri(): string | null {
  try {
    // Prefer the explicit owner/slug from app.json — getRedirectUrl() depends
    // on the runtime manifest exposing `originalFullName`, which Expo Go can
    // omit (e.g. when the dev server predates a config change), leaving the
    // Google button permanently "not ready".
    const cfg = Constants.expoConfig;
    if (cfg?.owner && cfg?.slug) {
      return `https://auth.expo.io/@${cfg.owner}/${cfg.slug}`;
    }
    return getRedirectUrl();
  } catch {
    return null;
  }
}

/** Map a failed Google sign-in API call to a friendly, inline-safe message. */
function friendlyError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.response) return "Something went wrong. Please try again.";
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = resolveGoogleClientId();
  const proxyRedirectUri = resolveProxyRedirectUri();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        body: {
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: Space.xl,
        },
        column: {
          width: "100%",
          maxWidth: MaxContentWidth,
          alignSelf: "center",
          gap: Space.mega,
        },
        heading: {
          gap: Space.md,
        },
        headline: {
          ...Type.h1,
          color: colors.ink,
          textAlign: "center",
        },
        subtext: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        actions: {
          gap: Space.md,
        },
        caption: {
          ...Type.caption,
          color: colors.inkFaint,
          textAlign: "center",
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
          textAlign: "center",
        },
      }),
    [colors],
  );

  // Google auth request (id-token implicit flow against the Web client). The
  // redirect goes through the Expo proxy so this works in Expo Go / dev
  // clients without registering a custom URL scheme. The request loads async;
  // pressing the button before it's ready surfaces a friendly retry error.
  const [request] = Google.useAuthRequest({
    clientId: googleClientId ?? GOOGLE_CLIENT_ID_PLACEHOLDER,
    responseType: ResponseType.IdToken,
    redirectUri: proxyRedirectUri ?? undefined,
  });

  // Close any lingering auth popup on web; no-op on native.
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  function navigateAfterAuth() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/pace");
    }
  }

  async function handleGoogle() {
    if (googleBusy) return;
    setError(null);

    if (!googleClientId) {
      setError("Google sign-in isn't configured yet (missing Web Client ID).");
      return;
    }
    if (!request || !proxyRedirectUri) {
      setError("Google sign-in isn't ready yet. Please try again in a moment.");
      return;
    }

    setGoogleBusy(true);
    try {
      // Proxy start URL: auth.expo.io bounces the Google redirect (an HTTPS URL
      // registerable on the Web OAuth client) back into the app.
      const returnUrl = getDefaultReturnUrl();
      const authUrl =
        request.url ?? (await request.makeAuthUrlAsync(Google.discovery));
      const startUrl = `${proxyRedirectUri}/start?${new URLSearchParams({
        authUrl,
        returnUrl,
      })}`;

      const result = await WebBrowser.openAuthSessionAsync(
        startUrl,
        returnUrl,
      );

      // Cancelled/dismissed by the user — no error banner needed.
      if (result.type !== "success") {
        return;
      }

      const parsed = request.parseReturnUrl(result.url);
      if (parsed.type !== "success") {
        setError("Google sign-in didn't complete. Please try again.");
        return;
      }

      const idToken = parsed.params?.id_token;
      if (!idToken) {
        setError("Google sign-in didn't return an ID token. Please try again.");
        return;
      }

      await loginWithGoogle(idToken);
      track("signed_in", { method: "google" });
      navigateAfterAuth();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Sign in",
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
        }}
      />
      <View style={styles.body}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <Text style={styles.headline}>Welcome back</Text>
            <Text style={styles.subtext}>
              Sign in to track your pace and sync your cook sessions.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              title="Continue with Google"
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<GoogleGlyph />}
              onPress={handleGoogle}
              loading={googleBusy}
            />
            <Text style={styles.caption}>
              Sign in with Google — no password needed.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Small circular "G" badge for the Google button. */
function GoogleGlyph() {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          marginRight: Space.sm,
        },
        badgeText: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.ink,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>G</Text>
    </View>
  );
}
