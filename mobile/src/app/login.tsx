import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import axios from "axios";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import {
  getRedirectUrl,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { loginWithGoogle } from "@/api/client";
import { track } from "@/analytics";
import { API_BASE_URL } from "@/config";
import { useT, type TranslateFn } from "@/i18n";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button, GoogleLogo } from "@/components/ui";

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
 * The Google-flow redirect URI, by environment:
 * - Standalone/store builds: OUR OWN domain trampoline
 *   (`https://recipe-real.softland.tech/auth/callback`) — branded ("Finishing
 *   sign-in…" on our warm palette, never "expo.io"), registered in the Google
 *   console, and it forwards the OAuth response to recipereal:///login.
 * - Expo Go: the auth.expo.io proxy (custom schemes can't return to Expo Go).
 *   SDK 57's expo-auth-session no longer wires the proxy into `promptAsync`,
 *   so the flow is assembled here from the same public building blocks.
 */
function resolveAuthRedirectUri(): string | null {
  const isStandalone =
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  if (isStandalone) {
    return `${API_BASE_URL}/auth/callback`;
  }
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
function friendlyError(e: unknown, t: TranslateFn): string {
  if (axios.isAxiosError(e)) {
    if (e.response) return t("login.errGeneric");
    return t("login.errOffline");
  }
  return t("login.errGeneric");
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const t = useT();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = resolveGoogleClientId();
  const proxyRedirectUri = resolveAuthRedirectUri();

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
      setError(t("login.errNotConfigured"));
      return;
    }
    if (!request || !proxyRedirectUri) {
      setError(t("login.errNotReady"));
      return;
    }

    setGoogleBusy(true);
    try {
      const authUrl =
        request.url ?? (await request.makeAuthUrlAsync(Google.discovery));

      const isStandalone =
        Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

      // The return always targets the /login ROUTE (this screen — its mount
      // effect calls maybeCompleteAuthSession() to hand the result back to
      // the pending openAuthSessionAsync promise).
      const returnUrl = makeRedirectUri({ path: "login" });

      let openUrl: string;
      if (isStandalone) {
        // Domain flow: Google redirects straight to OUR trampoline
        // (recipe-real.softland.tech/auth/callback — branded, HTTPS, the
        // only kind Google's web client accepts) which forwards the
        // response to recipereal:///login. No expo.io branding anywhere.
        openUrl = authUrl;
      } else {
        // Expo Go: the auth.expo.io proxy bounce (custom schemes cannot
        // return to Expo Go; the proxy is an HTTPS return target).
        openUrl = `${proxyRedirectUri}/start?${new URLSearchParams({
          authUrl,
          returnUrl,
        })}`;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        openUrl,
        returnUrl,
      );

      // Cancelled/dismissed by the user — no error banner needed.
      if (result.type !== "success") {
        return;
      }

      // The trampoline (and Google's implicit flow) may deliver the params
      // in the URL FRAGMENT — normalize #params to ?params before parsing.
      const resultUrl = result.url.includes("#")
        ? result.url.replace("#", "?")
        : result.url;
      const parsed = request.parseReturnUrl(resultUrl);
      if (parsed.type !== "success") {
        setError(t("login.errNotComplete"));
        return;
      }

      const idToken = parsed.params?.id_token;
      if (!idToken) {
        setError(t("login.errNoToken"));
        return;
      }

      await loginWithGoogle(idToken);
      track("signed_in", { method: "google" });
      navigateAfterAuth();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t("stack.signIn"),
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
        }}
      />
      <View style={styles.body}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <Text style={styles.headline}>{t("login.welcome")}</Text>
            <Text style={styles.subtext}>{t("login.subtext")}</Text>
          </View>

          <View style={styles.actions}>
            <Button
              title={t("login.continueGoogle")}
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<GoogleGlyph />}
              onPress={handleGoogle}
              loading={googleBusy}
            />
            <Text style={styles.caption}>{t("login.googleCaption")}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Google mark for the sign-in button: the official MULTI-COLOR Google "G"
 * (GoogleLogo, official brand geometry) inside the surface badge — the
 * colored mark reads correctly on both the terracotta button and dark
 * mode. marginEnd keeps the gap direction-safe in RTL.
 */
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
          // marginEnd so the gap follows the layout direction in RTL.
          marginEnd: Space.sm,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.badge}>
      <GoogleLogo size={14} />
    </View>
  );
}
