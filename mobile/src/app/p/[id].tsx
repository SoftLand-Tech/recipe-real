import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Web-link bridge: shared post links (https://recipe-real.softland.tech/p/123)
 * open here when Android App Links hand them to the app; immediately swaps
 * to the real post screen without adding a history entry.
 */
export default function SharedPostRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();

  useEffect(() => {
    const numeric = Number(id);
    if (Number.isFinite(numeric) && numeric > 0) {
      router.replace(`/post/${numeric}`);
    } else {
      router.replace("/(tabs)/community");
    }
  }, [id]);

  return (
    <View
      style={[styles.center, { backgroundColor: colors.canvas }]}
      accessibilityLabel="Opening post"
    >
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
