import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import axios from "axios";
import * as Crypto from "expo-crypto";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import {
  makeRedirectUri,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { loginWithGoogle, fetchMyProfileFull } from "@/api/client";
import { setAuthTokenCache } from "@/api/http";
import { track } from "@/analytics";
import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";
import { useT, type TranslateFn } from "@/i18n";
import { secureStore } from "@/utils/secureStore";
import { clearFlowSecret, readFlowSecret, saveFlowSecret } from "@/utils/oauthStorage";
import type { AuthResponse } from "@/types";
import {
  MaxContentWidth,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import { Button, GoogleLogo } from "@/components/ui";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";

const GOOGLE_CLIENT_ID_PLACEHOLDER = "REPLACE_WITH_GOOGLE_WEB_CLIENT_ID";

/**
 * Expo Go's Google redirect: the auth.expo.io proxy URI that is REGISTERED
 * in the Google console (see resolveAuthRedirectUri for why it's pinned).
 */
const EXPO_GO_AUTH_PROXY = "https://auth.expo.io/@mamounhisham1/recipereal";

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
  // PINNED, not built from owner/slug: the EAS project's slug (vibe-labs,
  // borrowed account) must match app.json for eas-cli to work, but the
  // proxy URI has to be one REGISTERED in the Google console. The proxy is
  // project-agnostic (verified: it relays for any owner/slug), so we pin
  // the original account's URI — registered, and stays correct after the
  // post-Sep-1 account revert. If this ever 400s at Google, check the
  // console for this exact URI.
  return EXPO_GO_AUTH_PROXY;
}

/** Map a failed Google sign-in API call to a friendly, inline-safe message. */
function friendlyError(e: unknown, t: TranslateFn): string {
  if (axios.isAxiosError(e)) {
    if (e.response) return t("login.errGeneric");
    return t("login.errOffline");
  }
  return t("login.errGeneric");
}

/**
 * Exchange an authorization code for a session (standalone code+PKCE flow):
 * POST /api/auth/google/code with the code plus the PKCE verifier and nonce
 * stored for THIS attempt (the backend performs the Google token exchange
 * server-side and answers the same { token, user } shape as the implicit
 * /api/auth/google endpoint). The returned token is persisted exactly like
 * loginWithGoogle does for the implicit flow. Deliberately a direct axios
 * call in THIS screen, not a client.ts function: the endpoint is
 * login-only and this file owns the whole OAuth flow.
 */
async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
  nonce: string,
): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(
    `${API_BASE_URL}/api/auth/google/code`,
    {
      code,
      code_verifier: codeVerifier,
      nonce,
    },
  );
  if (data?.token) {
    await secureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
    // Keep the http layer's in-memory mirror in sync (see getAuthToken).
    setAuthTokenCache(data.token);
  }
  return data;
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
  // Which OAuth flow to START: standalone/store builds run the
  // authorization-CODE + PKCE flow (the implicit id_token they returned
  // before was interceptable off the recipereal:// scheme bounce). Expo Go
  // (executionEnvironment === StoreClient) and web keep the implicit
  // id_token flow — the auth.expo.io proxy and the web popup completion
  // below only ever deliver an id_token.
  const useCodePkceFlow = Platform.OS !== "web" && isStandalone;
  // Domain flow: Google redirects straight to OUR trampoline
  // (<API_BASE_URL>/auth/callback — branded, HTTPS, the only kind Google's
  // web client accepts) which forwards the response to recipereal:///login.
  // On web the OAuth popup must land back on THIS origin: expo-web-browser
  // completes the session via postMessage and rejects cross-origin senders,
  // and the domain trampoline can only bounce to a recipereal:// app link a
  // browser cannot open. So web redirects straight to the /login route
  // (must be an authorized redirect URI in the Google console — plain
  // http://localhost is accepted for development).
  const oauthRedirectUri = Platform.OS === "web"
    ? makeRedirectUri({ path: "login" })
    : isStandalone
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

  // Google auth request (authorization-code + PKCE in standalone/store
  // builds; id-token implicit flow in Expo Go/web). The redirect goes
  // through our domain trampoline so this works without a custom-scheme
  // return target. The request loads async; pressing the button before it's
  // ready surfaces a friendly retry error.
  // With usePKCE on, expo-auth-session generates the verifier/challenge when
  // the request loads, auto-attaches code_challenge (S256) to the auth URL
  // and keeps the paired verifier on request.codeVerifier (saved into the
  // flow secret at button-press for the backend exchange).
  // nonce rides via extraParams (Google signs it into the id_token; the
  // backend requires an exact match). state MUST be a top-level option —
  // AuthRequest.makeAuthUrlAsync OVERWRITES extraParams.state with the
  // hook's internally generated one ("These overwrite any extra params"),
  // so a state smuggled through extraParams never reaches Google and the
  // echoed value fails our SecureStore comparison on return.
  const [request] = Google.useAuthRequest({
    // Never feed the placeholder literal into the hook: with no real client
    // ID the request stays un-ready and the button surfaces errNotConfigured
    // instead of building a bogus Google URL.
    clientId: googleClientId ?? "",
    responseType: useCodePkceFlow ? ResponseType.Code : ResponseType.IdToken,
    usePKCE: useCodePkceFlow,
    redirectUri: oauthRedirectUri ?? undefined,
    state: oauthState,
    extraParams: { nonce },
  });

  // Close any lingering auth popup on web; no-op on native.
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  /**
   * DEEP-LINK COMPLETION (standalone Android): when the domain trampoline
   * fires recipereal:///login?state=…&code=… (code+PKCE) or
   * recipereal:///login?state=…&id_token=… (Expo Go implicit), the OS opens
   * this route as a deep link while the pending openAuthSessionAsync promise
   * often resolves as "dismissed" (the custom-scheme navigation tears down
   * the custom tab).
   *
   * SECURITY: the callback is only trusted when its `state` matches the
   * single-use material generated for THIS attempt (persisted in SecureStore
   * at button-press so cold-start completions still verify). The comparison
   * happens FIRST — a link injected by another app via the custom scheme
   * carries no matching state and is IGNORED SILENTLY without burning the
   * secret, so the genuine callback that follows still completes; only a
   * VERIFIED callback consumes it (single use — a captured URL can never
   * replay). Then the code is exchanged WITH the paired PKCE verifier and
   * nonce, or the id_token submitted WITH its nonce (backend enforces both).
   */
  const deepParams = useLocalSearchParams<{
    id_token?: string;
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const completedRef = useRef(false);
  const deepIdToken =
    typeof deepParams.id_token === "string" && deepParams.id_token.length > 0
      ? deepParams.id_token
      : null;
  const deepCode =
    typeof deepParams.code === "string" && deepParams.code.length > 0
      ? deepParams.code
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
    if (!deepIdToken && !deepCode && !deepError) return;
    (async () => {
      try {
        // Verify the state BEFORE marking the completion or touching the
        // secret: a forged link must neither consume the one-shot
        // completion nor the stored secret — the genuine callback that
        // follows still completes.
        const secret = await readFlowSecret();
        if (
          !secret ||
          !deepState ||
          !timingSafeEqual(deepState, secret.state)
        ) {
          return;
        }
        completedRef.current = true;
        // Strip the credentials from this route entry (setParams with
        // undefined removes the params) so they can never replay on a later
        // /login mount — the sign-in continues in THIS component instance.
        router.setParams({
          id_token: undefined,
          code: undefined,
          state: undefined,
          error: undefined,
          error_description: undefined,
        });
        // Verified: consume the single-use secret BEFORE any sign-in call.
        await clearFlowSecret();
        if (!deepCode && !deepIdToken) {
          // A verified callback that carries an OAuth error (consent
          // denied etc.) — the attempt is over, surface it.
          setError(t("login.errNotComplete"));
          return;
        }
        setGoogleBusy(true);
        if (deepCode) {
          // Standalone code+PKCE completion: backend exchange, then the
          // exact same post-login path as the implicit flow.
          await exchangeAuthCode(
            deepCode,
            secret.codeVerifier ?? "",
            secret.nonce,
          );
        } else {
          await loginWithGoogle(deepIdToken as string, secret.nonce);
        }
        track("signed_in", { method: "google" });
        navigateAfterAuth();
      } catch (e) {
        setError(friendlyError(e, t));
      } finally {
        setGoogleBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepIdToken, deepCode, deepState, deepError]);

  /**
   * WEB popup completion. Some embedded browsers (the dev preview's
   * in-app browser) open window.open targets as tabs with NO opener link,
   * so expo-web-browser's postMessage handshake can never deliver the
   * OAuth result to the tab that started the flow — the token just sits
   * in this page's URL fragment. When this page loads carrying the
   * fragment and has no opener to hand it to, complete the sign-in HERE,
   * guarded by the same single-use SecureStore material the deep-link
   * path uses (state must match; the secret is consumed on read).
   */
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    // With a live opener the standard popup handshake completes in the
    // opening tab — completing here too would submit the token twice.
    if (window.opener != null) return;
    const hash = window.location.hash;
    if (!hash.includes("id_token=") || !hash.includes("state=")) return;
    if (completedRef.current) return;
    completedRef.current = true;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const idToken = params.get("id_token");
    const returnedState = params.get("state");
    // Strip the credentials from the address bar and history immediately.
    window.history.replaceState(null, "", window.location.pathname);
    (async () => {
      try {
        setGoogleBusy(true);
        // Verify the state BEFORE touching the secret (same order as the
        // deep-link path): a non-matching fragment is ignored silently
        // without burning the single-use material; only a verified match
        // consumes it before the sign-in call.
        const secret = await readFlowSecret();
        if (
          !secret ||
          !returnedState ||
          !timingSafeEqual(returnedState, secret.state)
        ) {
          return;
        }
        await clearFlowSecret();
        if (!idToken) {
          setError(t("login.errNotComplete"));
          return;
        }
        await loginWithGoogle(idToken, secret.nonce);
        track("signed_in", { method: "google" });
        navigateAfterAuth();
      } catch (e) {
        setError(friendlyError(e, t));
      } finally {
        setGoogleBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Post-auth routing. Fresh profiles (no display name typed yet — the
   * onboarding marker; the name is the one required field, gender/bio/
   * photo are optional) are routed to /onboarding, which cannot be
   * skipped or backed out of; everyone else returns to wherever they
   * came from (home when there is no history, e.g. a cold deep-link
   * straight into /login).
   */
  async function navigateAfterAuth() {
    try {
      const me = await fetchMyProfileFull();
      if (me.user.has_display_name === false) {
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
      // Persist this attempt's single-use material BEFORE opening
      // Google: the deep-link completion (possibly a cold start, fresh JS
      // context) verifies state and reads the nonce — and, in the code
      // flow, the PKCE verifier expo-auth-session generated for this
      // request — from here.
      await saveFlowSecret({
        nonce,
        state: oauthState,
        codeVerifier: request?.codeVerifier,
      });

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
      // A "success" carrying NEITHER id_token (Expo Go/web implicit) NOR
      // code (standalone PKCE) is the Android fragment-drop signature
      // (credentials lost in the custom-scheme redirect) — surface it
      // instead of failing silently back to the sign-in screen. The URL is
      // logged WITHOUT its query/fragment so no credential material can
      // reach the (possibly non-stripped) console.
      if (
        !result.url ||
        (!result.url.includes("id_token") && !result.url.includes("code"))
      ) {
        console.warn(
          "[RecipeReal] auth returned success with no id_token/code:",
          result.url.split(/[?#]/)[0],
        );
        setError(t("login.errNoToken"));
        return;
      }

      // The trampoline (and Google's flows) may deliver the params in the
      // URL FRAGMENT — normalize #params to ?params before parsing.
      const resultUrl = result.url.includes("#")
        ? result.url.replace("#", "?")
        : result.url;
      const parsed = request.parseReturnUrl(resultUrl);
      if (parsed.type !== "success") {
        setError(t("login.errNotComplete"));
        return;
      }

      const returnedCode = parsed.params?.code;
      const idToken = parsed.params?.id_token;
      const returnedState = parsed.params?.state;
      if (
        typeof returnedState !== "string" ||
        !timingSafeEqual(returnedState, oauthState)
      ) {
        setError(t("login.errNoToken"));
        return;
      }

      // The deep-link completion effect may have already claimed this
      // sign-in (Android resolves the session as dismissed while the deep
      // link carries the credentials) — never submit twice.
      if (completedRef.current) return;
      completedRef.current = true;

      if (typeof returnedCode === "string" && returnedCode) {
        // Standalone code+PKCE: backend exchange with the verifier this
        // request generated, then the same post-login path as implicit.
        await exchangeAuthCode(returnedCode, request.codeVerifier ?? "", nonce);
      } else if (typeof idToken === "string" && idToken) {
        // Implicit (Expo Go/web): existing id_token handling.
        await loginWithGoogle(idToken, nonce);
      } else {
        setError(t("login.errNoToken"));
        return;
      }
      track("signed_in", { method: "google" });
      navigateAfterAuth();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setGoogleBusy(false);
    }
  }

  // Config/readiness failures (missing Web Client ID, hook not loaded yet)
  // are retryable — surface an explicit Retry button under the error instead
  // of leaving the user with a dead message. Compared by resolved message so
  // no error-key plumbing has to change at the call sites.
  const isConfigError =
    error != null &&
    (error === t("login.errNotConfigured") ||
      error === t("login.errNotReady"));

  return (
    <View style={styles.container}>
      <PinnedHeaderBar title={t("stack.signIn")} leading={<BackChevron />} />
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
              disabled={googleBusy}
            />
            <Text style={styles.caption}>{t("login.googleCaption")}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {isConfigError ? (
              <Button
                title={t("common.retry")}
                variant="secondary"
                size="md"
                fullWidth
                onPress={handleGoogle}
                loading={googleBusy}
                disabled={googleBusy}
              />
            ) : null}
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
