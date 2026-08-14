import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

import { login, loginWithGoogle, register } from "@/api/client";
import { track } from "@/analytics";
import { Color, MaxContentWidth, Radius, Space, Type } from "@/theme";
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

/** Map a failed API call to a friendly, inline-safe message. */
function friendlyError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    if (status === 401) return "Incorrect email or password.";
    if (status === 422) return "Please check your details and try again.";
    if (e.response) return "Something went wrong. Please try again.";
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "email-address";
  autoComplete?: "email" | "name" | "password" | "off";
}

/** Warm pill-styled labeled text input (surfaceSoft bg, hairline border). */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  autoCapitalize = "none",
  keyboardType = "default",
  autoComplete = "off",
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Color.inkFaint}
        secureTextEntry={secure || undefined}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
      />
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = resolveGoogleClientId();
  const proxyRedirectUri = resolveProxyRedirectUri();

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
    if (submitting || googleBusy) return;
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
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSubmit() {
    if (submitting || googleBusy) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (mode === "signup" && !trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await register(trimmedName, trimmedEmail, password);
      } else {
        await login(trimmedEmail, password);
      }
      track("signed_in", { method: "password" });
      navigateAfterAuth();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setError(null);
    setMode((current) => (current === "signin" ? "signup" : "signin"));
  }

  const busy = submitting || googleBusy;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Sign in",
          headerStyle: { backgroundColor: Color.canvas },
          headerTintColor: Color.ink,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>
            <Text style={styles.headline}>
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </Text>
            <Text style={styles.subtext}>
              {mode === "signin"
                ? "Sign in to track your pace and sync your cook sessions."
                : "Sign up to track your pace and sync your cook sessions."}
            </Text>

            <Button
              title="Continue with Google"
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<GoogleGlyph />}
              onPress={handleGoogle}
              loading={googleBusy}
              disabled={submitting}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === "signup" ? (
              <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="sentences"
                autoComplete="name"
              />
            ) : null}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secure
              autoComplete="password"
            />

            <Button
              title={mode === "signin" ? "Sign in" : "Create account"}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleSubmit}
              loading={submitting}
              disabled={googleBusy}
            />

            <Pressable
              onPress={busy ? undefined : toggleMode}
              disabled={busy}
              accessibilityRole="button"
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Small circular "G" badge for the Google button. */
function GoogleGlyph() {
  return (
    <View style={styles.googleBadge}>
      <Text style={styles.googleBadgeText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
  },
  column: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Space.lg,
  },
  headline: {
    ...Type.h1,
    color: Color.ink,
  },
  subtext: {
    ...Type.body,
    color: Color.inkSecondary,
  },
  errorText: {
    ...Type.bodySm,
    color: Color.danger,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Color.hairline,
  },
  dividerText: {
    ...Type.caption,
    color: Color.inkFaint,
  },
  field: {
    gap: Space.xs,
  },
  fieldLabel: {
    ...Type.caption,
    color: Color.inkSecondary,
  },
  input: {
    backgroundColor: Color.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Color.hairline,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    fontSize: Type.body.fontSize,
    color: Color.ink,
  },
  toggle: {
    alignSelf: "center",
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
  },
  toggleText: {
    ...Type.bodySm,
    color: Color.accent,
    fontWeight: "600",
    textAlign: "center",
  },
  googleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Color.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Space.sm,
  },
  googleBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Color.ink,
  },
});
