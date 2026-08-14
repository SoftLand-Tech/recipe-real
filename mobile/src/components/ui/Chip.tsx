import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Color, Radius, Space, Type } from "@/theme";

export interface ChipProps {
  label: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "amber";
  icon?: ReactNode;
  size?: "sm" | "md";
}

const TONES: Record<
  NonNullable<ChipProps["tone"]>,
  { bg: string; fg: string }
> = {
  neutral: { bg: Color.surfaceSoft, fg: Color.inkSecondary },
  accent: { bg: Color.accentSoft, fg: Color.accent },
  success: { bg: Color.successSoft, fg: Color.success },
  danger: { bg: Color.dangerSoft, fg: Color.danger },
  amber: { bg: Color.amberSoft, fg: "#8A5A12" },
};

export function Chip({ label, tone = "neutral", icon, size = "md" }: ChipProps) {
  const colors = TONES[tone];
  const small = size === "sm";
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          paddingVertical: small ? Space.xs / 2 : Space.xs + 2,
          paddingHorizontal: small ? Space.sm : Space.md,
        },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          { color: colors.fg },
          small ? styles.labelSm : styles.labelMd,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: Space.xs,
  },
  label: {
    fontWeight: "600",
  },
  labelSm: { fontSize: Type.caption.fontSize },
  labelMd: { fontSize: Type.bodySm.fontSize },
});
