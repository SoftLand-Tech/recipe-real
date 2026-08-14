import { useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { Color, Space, Type } from "@/theme";

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

const VARIANT_CONTENT: Record<
  NonNullable<ButtonProps["variant"]>,
  { bg: string; fg: string; pressedBg: string }
> = {
  primary: { bg: Color.accent, fg: Color.surface, pressedBg: Color.accentPress },
  secondary: {
    bg: Color.surfaceSoft,
    fg: Color.ink,
    pressedBg: Color.hairlineStrong,
  },
  ghost: { bg: "transparent", fg: Color.ink, pressedBg: Color.surfaceSoft },
};

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
  const tone = VARIANT_CONTENT[variant];
  const large = size === "lg";
  const [pressed, setPressed] = useState(false);

  // Static style only (no Pressable style function, no width: "100%"): both
  // percentage width and function styles inside footers have mis-resolved and
  // collapsed button painting on some Android devices (see commit c0be039).
  // Pressed feedback comes from state + the native android_ripple instead.
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      android_ripple={{ color: "rgba(0,0,0,0.12)", borderless: false }}
      style={[
        styles.base,
        { backgroundColor: tone.bg },
        large ? styles.sizeLg : styles.sizeMd,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? { backgroundColor: tone.pressedBg } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? Color.surface : Color.accent}
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

const styles = StyleSheet.create({
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
  label: {
    fontWeight: "600",
    textAlign: "center",
  },
  labelMd: { fontSize: Type.body.fontSize },
  labelLg: { fontSize: Type.title.fontSize },
});
