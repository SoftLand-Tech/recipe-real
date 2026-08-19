import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Web-link bridge: shared recipe links (https://recipe-real.softland.tech/r/123)
 * open here when Android App Links hand them to the app; immediately swaps
 * to the real recipe screen without adding a history entry.
 */
export default function SharedRecipeRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();

  useEffect(() => {
    const numeric = Number(id);
    if (Number.isFinite(numeric) && numeric > 0) {
      router.replace(`/recipe/${numeric}`);
    } else {
      router.replace("/");
    }
  }, [id]);

  return (
    <View
      style={[styles.center, { backgroundColor: colors.canvas }]}
      accessibilityLabel="Opening recipe"
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
