import { memo, useCallback, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { Radius, Shadow, Space, useThemeColors, type ThemeColors } from "@/theme";

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e?: any) => void;
  padding?: number;
  shadow?: "card" | "floating" | "none";
}

function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      overflow: "hidden",
    },
    pressed: {
      backgroundColor: colors.surfaceSoft,
      // Opacity always repaints (GPU-composited) — the reliable pressed
      // acknowledgment on devices that skip ripple/bg-swap repaints.
      opacity: 0.85,
    },
  });
}

const stylesByTheme = new WeakMap<ThemeColors, ReturnType<typeof createCardStyles>>();

function getCardStyles(colors: ThemeColors) {
  let cached = stylesByTheme.get(colors);
  if (!cached) {
    cached = createCardStyles(colors);
    stylesByTheme.set(colors, cached);
  }
  return cached;
}

const PADDING_ZERO = { padding: 0, borderRadius: Radius.lg } as const;
const PADDING_LG = { padding: Space.lg, borderRadius: Radius.lg } as const;

export const Card = memo(function Card({
  children,
  style,
  onPress,
  padding = Space.lg,
  shadow = "card",
}: CardProps) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const styles = getCardStyles(colors);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  const paddingStyle =
    padding === 0
      ? PADDING_ZERO
      : padding === Space.lg
        ? PADDING_LG
        : { padding, borderRadius: Radius.lg };

  // Static style only (no Pressable style function): function styles on
  // Pressables mis-resolved and collapsed painting on some Android devices
  // (see commit c0be039). Pressed feedback is the state-driven bg + opacity
  // dim; android_ripple is intentionally omitted — on some devices it draws a
  // rectangular overlay that ignores borderRadius, revealing square edges.
  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    paddingStyle,
    shadow === "card" ? Shadow.card : null,
    shadow === "floating" ? Shadow.floating : null,
    pressed ? styles.pressed : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={baseStyle}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
});
