import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radius, Space, Type, useThemeColors, type ThemeColors } from "@/theme";

export interface ChipProps {
  label: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "amber" | "timing";
  icon?: ReactNode;
  size?: "sm" | "md";
  /**
   * "outline" turns the chip into a tappable-looking action pill: colored
   * border, heavier label, taller body. Use only for chips that are buttons
   * — informational tags stay filled/borderless so the two never read alike.
   */
  variant?: "filled" | "outline";
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
    // Timing/calibration semantic — every honest-time signal reads teal.
    timing: { bg: colors.timingSoft, fg: colors.timing },
  };
}

export function Chip({
  label,
  tone = "neutral",
  icon,
  size = "md",
  variant = "filled",
}: ChipProps) {
  const colors = useThemeColors();
  const toneColors = tones(colors)[tone];
  const small = size === "sm";
  const outline = variant === "outline";
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
          // marginEnd so the gap follows the layout direction in RTL.
          marginEnd: Space.xs,
        },
        label: {
          fontWeight: outline ? "700" : "600",
        },
        labelSm: { fontSize: Type.caption.fontSize },
        labelMd: { fontSize: Type.bodySm.fontSize },
      }),
    [outline],
  );
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: toneColors.bg,
          borderWidth: outline ? 1.5 : 0,
          borderColor: toneColors.fg,
          paddingVertical: small
            ? outline
              ? Space.xs + 2
              : Space.xs / 2
            : Space.xs + 2,
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
