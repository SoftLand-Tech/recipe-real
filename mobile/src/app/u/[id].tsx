import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useThemeColors } from "@/theme";
import { useT } from "@/i18n";

/**
 * Web-link bridge: shared profile links (https://recipe-real.softland.tech/u/123)
 * open here when Android App Links hand them to the app; immediately swaps
 * to the real public profile screen without adding a history entry.
 */
export default function SharedProfileRedirect() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const colors = useThemeColors();
  const t = useT();

  useEffect(() => {
    // useLocalSearchParams can hand back an array for a repeated query key —
    // take the first value before coercing.
    const raw = Array.isArray(id) ? id[0] : id;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      router.replace(`/user/${numeric}`);
    } else {
      router.replace("/");
    }
  }, [id]);

  return (
    <View
      style={[styles.center, { backgroundColor: colors.canvas }]}
      accessibilityLabel={t("a11y.openingProfile")}
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
