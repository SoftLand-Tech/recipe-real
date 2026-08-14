import { StyleSheet, Text, View } from "react-native";

import { Color, Space, Type } from "@/theme";

export interface StatPillProps {
  label: string;
  value: string;
  tone?: "neutral" | "accent";
}

export function StatPill({ label, value, tone = "neutral" }: StatPillProps) {
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

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  label: {
    color: Color.inkSecondary,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontSize: 11,
    marginBottom: Space.xs,
  },
  value: {
    ...Type.title,
    color: Color.ink,
  },
  valueAccent: {
    color: Color.accent,
  },
});
