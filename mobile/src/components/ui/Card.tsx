import { useMemo, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { Radius, Shadow, Space, useThemeColors } from "@/theme";

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padding?: number;
  shadow?: "card" | "floating" | "none";
}

export function Card({
  children,
  style,
  onPress,
  padding = Space.lg,
  shadow = "card",
}: CardProps) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [colors],
  );
  // Static style only (no Pressable style function): function styles on
  // Pressables mis-resolved and collapsed painting on some Android devices
  // (see commit c0be039). Pressed feedback uses state + android_ripple.
  const baseStyle: StyleProp<ViewStyle> = [
    styles.base,
    { padding, borderRadius: Radius.lg },
    shadow === "card" ? Shadow.card : null,
    shadow === "floating" ? Shadow.floating : null,
    pressed ? styles.pressed : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
        style={baseStyle}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}
