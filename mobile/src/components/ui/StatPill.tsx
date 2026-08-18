import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Space, Type, useThemeColors } from "@/theme";

export interface StatPillProps {
  label: string;
  value: string;
  tone?: "neutral" | "accent";
}

export function StatPill({ label, value, tone = "neutral" }: StatPillProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "column",
        },
        label: {
          color: colors.inkSecondary,
          fontWeight: "700",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontSize: Type.caption.fontSize,
          marginBottom: Space.xs,
        },
        value: {
          ...Type.title,
          fontWeight: "700",
          color: colors.ink,
        },
        valueAccent: {
          color: colors.accent,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.container}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.value, tone === "accent" && styles.valueAccent]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
