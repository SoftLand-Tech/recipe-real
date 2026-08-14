import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Color, Radius, Space } from "@/theme";

export interface HeroImageProps {
  uri?: string | null;
  height: number;
  withScrim?: boolean;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Full-bleed recipe hero image with a graceful fallback and an optional
 * legibility scrim behind overlaid children (title etc.).
 *
 * Scrim note: `expo-linear-gradient` is not installed and `@expo/ui` does NOT
 * export a `LinearGradient` component in this project (verified against
 * `node_modules/@expo/ui/build/universal/index.d.ts` — no gradient export).
 * We therefore fake the gradient with a dependency-free stack of five
 * absolutely-positioned, full-width Views of increasing opacity at the bottom.
 */
export function HeroImage({
  uri,
  height,
  withScrim = false,
  rounded = Radius.lg,
  style,
  children,
}: HeroImageProps) {
  const hasUri = typeof uri === "string" && uri.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: rounded },
        style,
      ]}
    >
      {hasUri ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          placeholder={null}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: Color.accentSoft }]}>
          <FallbackGlyph />
        </View>
      )}

      {withScrim ? <Scrim height={height} /> : null}

      {children ? (
        <View style={styles.children} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Dependency-free fake gradient: 5 stacked full-width bars of increasing
 * opacity, anchored to the bottom ~55% of the hero. Renders as a smooth-ish
 * dark-to-transparent legibility layer behind overlaid text.
 */
function Scrim({ height }: { height: number }) {
  const opacities = [0.06, 0.14, 0.24, 0.36, 0.5];
  const barHeight = Math.max(1, (height * 0.55) / opacities.length);
  return (
    <View style={styles.scrimContainer} pointerEvents="none">
      {opacities.map((o, i) => (
        <View
          key={i}
          style={{
            height: barHeight,
            backgroundColor: `rgba(0,0,0,${o})`,
          }}
        />
      ))}
    </View>
  );
}

/** Utensil glyph on native (expo-symbols), emoji fallback elsewhere. */
function FallbackGlyph() {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      const { SymbolView } = require("expo-symbols");
      return (
        <SymbolView
          name={{
            ios: "fork.knife",
            android: "restaurant",
            web: "restaurant",
          }}
          size={48}
          weight="semibold"
          tintColor={Color.accent}
          style={styles.glyph}
        />
      );
    } catch {
      // Fall through to the emoji fallback below.
    }
  }
  return <Text style={styles.glyphFallback}>🍳</Text>;
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: Color.accentSoft,
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {},
  glyphFallback: {
    fontSize: 44,
  },
  scrimContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
  },
  children: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: Space.lg,
  },
});
