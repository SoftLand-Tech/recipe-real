import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import {
  getRedirectUrl,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { loginWithGoogle } from "@/api/client";
import { track } from "@/analytics";
import { useT, type TranslateFn } from "@/i18n";
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
 * The Google-flow redirect URI: ALWAYS the auth.expo.io proxy
 * (`https://auth.expo.io/@owner/slug`). The proxy is an HTTPS bounce that
 * works identically from Expo Go AND standalone builds — in a standalone
 * build `getDefaultReturnUrl()` resolves to the app scheme
 * (`recipereal://...`) and the proxy returns the browser there. The scheme
 * is only ever the proxy's return target, never a Google redirect_uri, so
 * it does NOT need to be registered in the Google console (Google's web
 * clients reject non-HTTPS URIs anyway). SDK 57's expo-auth-session no
 * longer wires the proxy into `promptAsync`, so the flow is assembled here
 * from the same public building blocks.
 */
function resolveAuthRedirectUri(): string | null {
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

      // Proxy flow (both Expo Go and standalone): auth.expo.io bounces the
      // Google redirect (an HTTPS URL — the only kind Google's web client
      // accepts) back to the app. The return URL targets the /login ROUTE:
      // makeRedirectUri({path}) resolves to exp://<host>/--/login in Expo Go
      // (the /--/ marker is stripped by the router) and recipereal:///login
      // in standalone builds — both land on this screen, whose mount effect
      // calls maybeCompleteAuthSession() to hand the result back to the
      // pending openAuthSessionAsync promise. A bare root return URL made
      // standalone builds land on an unmatched route after the bounce.
      const returnUrl = makeRedirectUri({ path: "login" });
      const openUrl = `${proxyRedirectUri}/start?${new URLSearchParams({
        authUrl,
        returnUrl,
      })}`;

      const result = await WebBrowser.openAuthSessionAsync(
        openUrl,
        returnUrl,
      );

      // Cancelled/dismissed by the user — no error banner needed.
      if (result.type !== "success") {
        return;
      }

      const parsed = request.parseReturnUrl(result.url);
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
 * Google mark for the sign-in button: Ionicons `logo-google` (the official
 * monochrome single-color mark) inside the existing circular badge. The icon
 * uses the badge's ink color — the button's own foreground (surface) would
 * vanish against the surface-colored badge background. marginEnd keeps the
 * gap direction-safe in RTL.
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
      <Ionicons name="logo-google" size={18} color={colors.ink} />
    </View>
  );
}
