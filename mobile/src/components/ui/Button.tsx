import { useMemo, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { Space, Type, useThemeColors, type ThemeColors } from "@/theme";

export interface ButtonProps {
  title?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function variantContent(
  colors: ThemeColors,
): Record<
  NonNullable<ButtonProps["variant"]>,
  { bg: string; fg: string; pressedBg: string }
> {
  return {
    primary: {
      bg: colors.accent,
      fg: colors.surface,
      pressedBg: colors.accentPress,
    },
    secondary: {
      bg: colors.surfaceSoft,
      fg: colors.ink,
      pressedBg: colors.hairlineStrong,
    },
    ghost: { bg: "transparent", fg: colors.ink, pressedBg: colors.surfaceSoft },
  };
}

export function Button({
  title,
  children,
  variant = "primary",
  size = "md",
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  style,
}: ButtonProps) {
  const colors = useThemeColors();
  const tone = variantContent(colors)[variant];
  const large = size === "lg";
  const [pressed, setPressed] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
        },
        sizeMd: {
          paddingVertical: Space.md,
          paddingHorizontal: Space.xl,
        },
        sizeLg: {
          paddingVertical: Space.lg,
          paddingHorizontal: Space.xxl,
        },
        // alignSelf stretch (not width: "100%") — percentage widths on Pressables
        // collapsed painting on some Android devices; stretch is resolved by the
        // parent's cross-axis and paints reliably.
        fullWidth: {
          alignSelf: "stretch",
        },
        disabled: {
          opacity: 0.5,
        },
        // Opacity is the pressed workhorse: it's GPU-composited, so unlike a
        // background-color swap (which some Android devices fail to repaint,
        // and android_ripple which may not render at all) it ALWAYS visibly
        // acknowledges the tap, instantly — even when the onPress handler is
        // slow (async navigation etc.).
        pressed: {
          opacity: 0.75,
        },
        label: {
          fontWeight: "600",
          textAlign: "center",
        },
        labelMd: { fontSize: Type.body.fontSize },
        labelLg: { fontSize: Type.title.fontSize },
      }),
    [],
  );

  // Static style only (no Pressable style function, no width: "100%"): both
  // percentage width and function styles inside footers have mis-resolved and
  // collapsed button painting on some Android devices (see commit c0be039).
  // Pressed feedback is the opacity dim from state; android_ripple is
  // intentionally omitted — on some devices it draws a rectangular overlay
  // that ignores borderRadius, revealing square edges.
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        { backgroundColor: tone.bg },
        large ? styles.sizeLg : styles.sizeMd,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? [styles.pressed, { backgroundColor: tone.pressedBg }] : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.surface : colors.accent}
          size="small"
        />
      ) : (
        <>
          {leftIcon ? <>{leftIcon}</> : null}
          <Text
            style={[
              styles.label,
              { color: tone.fg },
              large ? styles.labelLg : styles.labelMd,
            ]}
            numberOfLines={1}
          >
            {title ?? (typeof children === "string" ? children : undefined)}
          </Text>
        </>
      )}
    </Pressable>
  );
}
