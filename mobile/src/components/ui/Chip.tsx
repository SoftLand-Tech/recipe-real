import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radius, Space, Type, useThemeColors, type ThemeColors } from "@/theme";

export interface ChipProps {
  label: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "amber";
  icon?: ReactNode;
  size?: "sm" | "md";
}

function tones(
  colors: ThemeColors,
): Record<NonNullable<ChipProps["tone"]>, { bg: string; fg: string }> {
  return {
    neutral: { bg: colors.surfaceSoft, fg: colors.inkSecondary },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    success: { bg: colors.successSoft, fg: colors.success },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    // Amber fg mirrors the "active" step tone ink so it reads on amberSoft
    // in both schemes (light: #8A5A12, dark: #E8C87E).
    amber: { bg: colors.amberSoft, fg: colors.stepTones.active.fg },
  };
}

export function Chip({ label, tone = "neutral", icon, size = "md" }: ChipProps) {
  const colors = useThemeColors();
  const toneColors = tones(colors)[tone];
  const small = size === "sm";
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [],
  );
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: toneColors.bg,
          paddingVertical: small ? Space.xs / 2 : Space.xs + 2,
          paddingHorizontal: small ? Space.sm : Space.md,
        },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          { color: toneColors.fg },
          small ? styles.labelSm : styles.labelMd,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
