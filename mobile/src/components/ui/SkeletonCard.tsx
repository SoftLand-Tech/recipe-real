import { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { Radius, Space, useThemeColors, type ThemeColors } from "@/theme";

export interface SkeletonCardProps {
  hasImage?: boolean;
}

function createSkeletonStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Space.lg,
      overflow: "hidden",
    },
    image: {
      height: 150,
      backgroundColor: colors.surfaceSoft,
      borderRadius: Radius.lg,
      marginBottom: Space.md,
    },
    line: {
      backgroundColor: colors.surfaceSoft,
      borderRadius: Radius.sm,
      height: 14,
    },
    lineTitle: {
      width: "70%",
      marginBottom: Space.sm,
    },
    lineShort: {
      width: "40%",
    },
  });
}

const stylesByTheme = new WeakMap<ThemeColors, ReturnType<typeof createSkeletonStyles>>();

function getSkeletonStyles(colors: ThemeColors) {
  let cached = stylesByTheme.get(colors);
  if (!cached) {
    cached = createSkeletonStyles(colors);
    stylesByTheme.set(colors, cached);
  }
  return cached;
}

/**
 * Lightweight, dependency-free loading placeholder shaped like a recipe card.
 * Uses a native-driver opacity pulse driven by Animated.loop.
 */
export const SkeletonCard = memo(function SkeletonCard({
  hasImage = true,
}: SkeletonCardProps) {
  const colors = useThemeColors();
  const styles = getSkeletonStyles(colors);
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <View style={styles.card}>
      {hasImage ? <Animated.View style={[styles.image, { opacity }]} /> : null}
      <Animated.View style={[styles.line, styles.lineTitle, { opacity }]} />
      <Animated.View style={[styles.line, styles.lineShort, { opacity }]} />
    </View>
  );
});
