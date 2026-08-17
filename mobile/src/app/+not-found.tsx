import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Catch-all for unmatched routes. Deep links and auth-session returns can
 * briefly produce URLs the router doesn't know (e.g. an OAuth response
 * landing before the session completes) — instead of flashing a "route
 * unmatched" error, bounce silently home.
 */
export default function NotFound() {
  const colors = useThemeColors();
  const router = useRouter();

  useEffect(() => {
    // Give the pending auth session (if any) one beat to consume its URL,
    // then replace — never stack a back entry onto the error.
    const timer = setTimeout(() => {
      router.replace("/");
    }, 350);
    return () => clearTimeout(timer);
  }, [router]);

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
