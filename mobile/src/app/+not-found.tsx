import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";

import { useThemeColors } from "@/theme";

/** Query keys that mark a URL as an in-flight OAuth return. */
const AUTH_PARAM_KEYS = ["id_token", "access_token", "code", "state", "error"];

/**
 * Catch-all for unmatched routes. Deep links and auth-session returns can
 * briefly produce URLs the router doesn't know (e.g. an OAuth response
 * landing before the session completes) — instead of flashing a "route
 * unmatched" error, bounce silently home.
 */
export default function NotFound() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useGlobalSearchParams();
  // Derived boolean (stable dep): the raw params object identity is not
  // guaranteed stable, and re-running the effect per render would keep
  // resetting the bounce timer.
  const isAuthReturn = AUTH_PARAM_KEYS.some((key) => params[key] != null);

  useEffect(() => {
    // Give the pending auth session (if any) one beat to consume its URL,
    // then leave — never stack a back entry onto the error.
    const timer = setTimeout(() => {
      // OAuth guard: an auth return landing here must not be stolen by the
      // bounce — stay put and let the auth handler win.
      if (isAuthReturn) return;
      // Return to where the bad link came from when there is history; only
      // bounce home on a cold start with nowhere to go back to.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [router, isAuthReturn]);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** Static export used when the timer approach isn't mounted in time. */
export const unstable_settings = {
  initialRouteName: "index",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
