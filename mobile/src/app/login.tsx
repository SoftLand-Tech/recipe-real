import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import axios from "axios";
import * as Crypto from "expo-crypto";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import {
  getRedirectUrl,
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";

import { loginWithGoogle, fetchMyProfileFull } from "@/api/client";
import { track } from "@/analytics";
import { API_BASE_URL, OAUTH_FLOW_KEY } from "@/config";
import { useT, type TranslateFn } from "@/i18n";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button, GoogleLogo } from "@/components/ui";

const GOOGLE_CLIENT_ID_PLACEHOLDER = "REPLACE_WITH_GOOGLE_WEB_CLIENT_ID";

/** The single-use OAuth material generated per sign-in attempt. */
interface FlowSecret {
  nonce: string;
  state: string;
}

/** Length-independent comparison for state/secret checks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

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

  // Standalone builds (preview APK / store) must send OUR DOMAIN trampoline
  // as the OAuth redirect — the trampoline forwards the result to the
  // recipereal:/// scheme. The auth.expo.io proxy redirect only works inside
  // Expo Go; sending it in a standalone build bounces the user back into
  // Expo Go (or nowhere) after the Google consent screen.
  const isStandalone =
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  // Domain flow: Google redirects straight to OUR trampoline
  // (<API_BASE_URL>/auth/callback — branded, HTTPS, the only kind Google's
  // web client accepts) which forwards the response to recipereal:///login.
  const oauthRedirectUri = isStandalone
    ? `${API_BASE_URL}/auth/callback`
    : proxyRedirectUri;

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

  // Single-use anti-injection material, generated fresh per mount of this
  // screen. Google embeds the nonce INSIDE the signed id_token (backend
  // requires an exact match) and echoes the state back as a plain param —
  // so an id_token injected by another app (custom-scheme intent broadcast)
  // fails BOTH checks even though its signature is perfectly valid.
  const nonce = useMemo(() => Crypto.randomUUID().replace(/-/g, ""), []);
  const oauthState = useMemo(() => Crypto.randomUUID().replace(/-/g, ""), []);

  // Google auth request (id-token implicit flow against the Web client). The
  // redirect goes through our domain trampoline so this works without a
  // custom-scheme return target. The request loads async; pressing the button
  // before it's ready surfaces a friendly retry error.
  const [request] = Google.useAuthRequest({
    clientId: googleClientId ?? GOOGLE_CLIENT_ID_PLACEHOLDER,
    responseType: ResponseType.IdToken,
    redirectUri: oauthRedirectUri ?? undefined,
    // nonce + state ride via extraParams (the provider's supported channel):
    // both land in the authorization URL — Google signs the nonce into the
    // id_token and echoes state back as a plain callback param.
    extraParams: { nonce, state: oauthState },
  });

  // Close any lingering auth popup on web; no-op on native.
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  /**
   * DEEP-LINK COMPLETION (standalone Android): when the domain trampoline
   * fires recipereal:///login?state=…&id_token=…, the OS opens this route as
   * a deep link while the pending openAuthSessionAsync promise often
   * resolves as "dismissed" (the custom-scheme navigation tears down the
   * custom tab).
   *
   * SECURITY: the callback is only trusted when its `state` matches the
   * single-use material generated for THIS attempt (persisted in SecureStore
   * at button-press so cold-start completions still verify). The secret is
   * CONSUMED on first read — an id_token injected by another app via the
   * custom scheme carries no matching state and dies here; a captured URL
   * can never replay either. Only then is loginWithGoogle called WITH the
   * paired nonce (which Google signed into the token; backend enforces).
   */
  const deepParams = useLocalSearchParams<{
    id_token?: string;
    state?: string;
    error?: string;
  }>();
  const completedRef = useRef(false);
  const deepIdToken =
    typeof deepParams.id_token === "string" && deepParams.id_token.length > 0
      ? deepParams.id_token
      : null;
  const deepState =
    typeof deepParams.state === "string" && deepParams.state.length > 0
      ? deepParams.state
      : null;
  const deepError =
    typeof deepParams.error === "string" && deepParams.error.length > 0
      ? deepParams.error
      : null;
  useEffect(() => {
    if (completedRef.current) return;
    if (!deepIdToken && !deepError) return;
    completedRef.current = true;
    // Strip the credentials from this route entry (setParams with
    // undefined removes the params) so they can never replay on a later
    // /login mount — the sign-in continues in THIS component instance.
    router.setParams({ id_token: undefined, state: undefined, error: undefined });
    (async () => {
      try {
        if (!deepIdToken) {
          setError(t("login.errNotComplete"));
          return;
        }
        setGoogleBusy(true);
        // Verify + consume the flow secret BEFORE any sign-in call.
        const raw = await SecureStore.getItemAsync(OAUTH_FLOW_KEY);
        await SecureStore.deleteItemAsync(OAUTH_FLOW_KEY); // single use
        const secret: FlowSecret | null = raw ? JSON.parse(raw) : null;
        if (!secret || !deepState || !timingSafeEqual(deepState, secret.state)) {
          setError(t("login.errNoToken"));
          return;
        }
        await loginWithGoogle(deepIdToken, secret.nonce);
        track("signed_in", { method: "google" });
        navigateAfterAuth();
      } catch (e) {
        setError(friendlyError(e, t));
      } finally {
        setGoogleBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepIdToken, deepState, deepError]);

  /**
   * Post-auth routing. Fresh profiles (no gender yet — the onboarding
   * marker) are routed to /onboarding to complete their details; everyone
   * else returns to wherever they came from (home when there is no
   * history, e.g. a cold deep-link straight into /login).
   */
  async function navigateAfterAuth() {
    try {
      const me = await fetchMyProfileFull();
      if (!me.user.gender) {
        router.replace("/onboarding");
        return;
      }
    } catch {
      // Profile fetch failed — fall through to the plain return path.
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  async function handleGoogle() {
    if (googleBusy) return;
    setError(null);

    if (!googleClientId) {
      setError(t("login.errNotConfigured"));
      return;
    }
    if (!request || !oauthRedirectUri) {
      setError(t("login.errNotReady"));
      return;
    }

    setGoogleBusy(true);
    try {
      // Persist this attempt's anti-injection material BEFORE opening
      // Google: the deep-link completion (possibly a cold start, fresh JS
      // context) verifies state and reads the nonce from here.
      const flowSecret: FlowSecret = { nonce, state: oauthState };
      await SecureStore.setItemAsync(
        OAUTH_FLOW_KEY,
        JSON.stringify(flowSecret),
      );

      const authUrl =
        request.url ?? (await request.makeAuthUrlAsync(Google.discovery));

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
      // A "success" carrying NO params is the Android fragment-drop
      // signature (token lost in the custom-scheme redirect) — surface it
      // instead of failing silently back to the sign-in screen. The URL is
      // logged WITHOUT its query/fragment so no credential material can
      // reach the (possibly non-stripped) console.
      if (!result.url || !result.url.includes("id_token")) {
        console.warn(
          "[RecipeReal] auth returned success with no id_token:",
          result.url.split(/[?#]/)[0],
        );
        setError(t("login.errNoToken"));
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
      const returnedState = parsed.params?.state;
      if (
        typeof idToken !== "string" ||
        !idToken ||
        typeof returnedState !== "string" ||
        !timingSafeEqual(returnedState, oauthState)
      ) {
        setError(t("login.errNoToken"));
        return;
      }

      // The deep-link completion effect may have already claimed this
      // sign-in (Android resolves the session as dismissed while the deep
      // link carries the token) — never submit twice.
      if (completedRef.current) return;
      completedRef.current = true;

      await loginWithGoogle(idToken, nonce);
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
