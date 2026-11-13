import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radius, Shadow, Space, Type, useThemeColors, type ThemeColors } from "@/theme";

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

type ToneMap = Record<NonNullable<ChipProps["tone"]>, { bg: string; fg: string }>;

const tonesByTheme = new WeakMap<ThemeColors, ToneMap>();

function getTones(colors: ThemeColors): ToneMap {
  let cached = tonesByTheme.get(colors);
  if (!cached) {
    cached = {
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
    tonesByTheme.set(colors, cached);
  }
  return cached;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  baseSmFilled: {
    borderWidth: 0,
    paddingVertical: Space.xs / 2,
    paddingHorizontal: Space.sm,
  },
  baseSmOutline: {
    borderWidth: 1.5,
    paddingVertical: Space.xs + 2,
    paddingHorizontal: Space.sm,
  },
  baseMdFilled: {
    borderWidth: 0,
    paddingVertical: Space.xs + 2,
    paddingHorizontal: Space.md,
  },
  baseMdOutline: {
    borderWidth: 1.5,
    paddingVertical: Space.xs + 2,
    paddingHorizontal: Space.md,
  },
  icon: {
    // marginEnd so the gap follows the layout direction in RTL.
    marginEnd: Space.xs,
  },
  labelFilled: {
    fontWeight: "600",
  },
  labelOutline: {
    fontWeight: "700",
  },
  labelSm: { fontSize: Type.caption.fontSize },
  labelMd: { fontSize: Type.bodySm.fontSize },
});

export const Chip = memo(function Chip({
  label,
  tone = "neutral",
  icon,
  size = "md",
  variant = "filled",
}: ChipProps) {
  const colors = useThemeColors();
  const toneColors = getTones(colors)[tone];
  const small = size === "sm";
  const outline = variant === "outline";
  return (
    <View
      style={[
        styles.base,
        small
          ? outline
            ? styles.baseSmOutline
            : styles.baseSmFilled
          : outline
            ? styles.baseMdOutline
            : styles.baseMdFilled,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.fg,
        },
        // Raised = tappable. Tags stay flat; action pills lift off the
        // screen (the one cue that separates them at a glance).
        outline ? Shadow.card : null,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          outline ? styles.labelOutline : styles.labelFilled,
          { color: toneColors.fg },
          small ? styles.labelSm : styles.labelMd,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});
