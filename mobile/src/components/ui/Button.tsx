import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  /**
   * Leading glyph BY NAME — the Button renders it tinted to the variant's
   * label color (white on primary in BOTH schemes, ink on ghost/secondary).
   * Prefer this over leftIcon whenever a stock Ionicon will do.
   */
  icon?: ComponentProps<typeof Ionicons>["name"];
  iconSize?: number;
  /**
   * Custom leading element (e.g. the multicolor Google logo). The CALLER
   * controls its colors — nothing here can recolor an arbitrary node, so
   * make sure it reads on this variant's background in both themes.
   */
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function variantContent(
  colors: ThemeColors,
): Record<
  NonNullable<ButtonProps["variant"]>,
  { bg: string; fg: string; pressedBg: string; border?: string }
> {
  return {
    // fg is LITERAL white, never colors.surface: the primary background is
    // always the saturated accent, and surface flips to a dark tone in dark
    // mode — dark-on-orange text (the "black text" bug). Same rule as
    // over-photo elements: white on saturated color in BOTH schemes.
    primary: {
      bg: colors.accent,
      fg: "#FFFFFF",
      pressedBg: colors.accentPress,
    },
    secondary: {
      bg: colors.surfaceSoft,
      fg: colors.ink,
      pressedBg: colors.hairlineStrong,
    },
    // Ghost = the quiet action, but NEVER transparent: a bare-text button
    // reads as a label and users don't tap it. Soft tinted fill + hairline
    // border in both schemes (the pill style of the search/filter controls).
    ghost: {
      bg: colors.surfaceSoft,
      fg: colors.ink,
      pressedBg: colors.hairlineStrong,
      border: colors.hairline,
    },
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
  icon,
  iconSize,
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
        // Breathing room between the glyph and the label.
        iconGap: {
          marginEnd: Space.sm,
        },
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
        tone.border != null
          ? { borderWidth: 1, borderColor: tone.border }
          : null,
        large ? styles.sizeLg : styles.sizeMd,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? [styles.pressed, { backgroundColor: tone.pressedBg }] : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          // Literal white on the accent background (see variantContent).
          color={variant === "primary" ? "#FFFFFF" : colors.accent}
          size="small"
        />
      ) : (
        <>
          {leftIcon ? <View style={styles.iconGap}>{leftIcon}</View> : null}
          {icon ? (
            <Ionicons
              name={icon}
              size={iconSize ?? (large ? 20 : 16)}
              color={tone.fg}
              style={styles.iconGap}
            />
          ) : null}
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
