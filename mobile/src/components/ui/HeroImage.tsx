import { memo, useCallback, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Radius, Space, useThemeColors, type ThemeColors } from "@/theme";

let SymbolViewComponent: typeof import("expo-symbols").SymbolView | null = null;
if (Platform.OS === "ios" || Platform.OS === "android") {
  try {
    SymbolViewComponent = require("expo-symbols").SymbolView ?? null;
  } catch {
    SymbolViewComponent = null;
  }
}

const FALLBACK_SYMBOL_NAME = {
  ios: "fork.knife",
  android: "restaurant",
  web: "restaurant",
} as const;
const FALLBACK_EMOJI_STYLE = { fontSize: 44 } as const;
const SCRIM_COLORS = ["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.82)"] as const;
const SCRIM_LOCATIONS = [0, 0.3, 1] as const;

function createHeroStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: "100%",
      overflow: "hidden",
      // Loading tint: expo-image's placeholder prop only accepts an image
      // source (no plain color object), so the container background serves
      // as the themed placeholder while the bitmap decodes.
      backgroundColor: colors.surfaceSoft,
    },
    fallback: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    children: {
      ...StyleSheet.absoluteFill,
      justifyContent: "flex-end",
      padding: Space.lg,
    },
  });
}

const stylesByTheme = new WeakMap<ThemeColors, ReturnType<typeof createHeroStyles>>();

function getHeroStyles(colors: ThemeColors) {
  let cached = stylesByTheme.get(colors);
  if (!cached) {
    cached = createHeroStyles(colors);
    stylesByTheme.set(colors, cached);
  }
  return cached;
}

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
 */
export const HeroImage = memo(function HeroImage({
  uri,
  height,
  withScrim = false,
  rounded = Radius.lg,
  style,
  children,
}: HeroImageProps) {
  const colors = useThemeColors();
  // Remote food photos 404/expire over time; without this the failed URI
  // renders as a blank tinted box instead of the placeholder glyph.
  const [failed, setFailed] = useState(false);
  const styles = getHeroStyles(colors);
  const handleError = useCallback(() => setFailed(true), []);

  const hasUri = typeof uri === "string" && uri.trim().length > 0;
  const showFallback = !hasUri || failed;

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: rounded },
        style,
      ]}
    >
      {showFallback ? (
        <View style={styles.fallback}>
          <FallbackGlyph tintColor={colors.accent} />
        </View>
      ) : (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // transition 300 cross-faded from a blank placeholder, making loads
          // feel delayed; 0 shows the decoded bitmap the moment it's ready.
          transition={0}
          cachePolicy="memory-disk"
          placeholder={null}
          onError={handleError}
          // Keeps recycled cells (FlatList rails) from reloading the image.
          recyclingKey={uri as string}
        />
      )}

      {/* The scrim only ever darkens a real photo — never the fallback
          placeholder (no gray wash over the tinted no-image card). */}
      {withScrim && !showFallback ? <Scrim /> : null}

      {children ? (
        <View style={styles.children} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
});

/**
 * Smooth bottom legibility gradient behind overlaid text. A real linear
 * gradient (replaces the old five stacked opacity bars, which rendered as
 * visible bands). Three stops keep the top clean while ramping to a strong
 * dark base, so white overlay text stays readable on bright food photos
 * (bright yellow/white dishes are the known failure case). Black-based in
 * both schemes on purpose — it overlays photos, so it must darken, not tint.
 */
function Scrim() {
  return (
    <LinearGradient
      style={StyleSheet.absoluteFill}
      colors={SCRIM_COLORS}
      // Transparent over the top ~30%, then a smooth ramp to a strong dark
      // bottom edge (0.82) that anchors the overlaid title/meta.
      locations={SCRIM_LOCATIONS}
      pointerEvents="none"
    />
  );
}

/** Utensil glyph on native (expo-symbols), emoji fallback elsewhere. */
function FallbackGlyph({ tintColor }: { tintColor: string }) {
  if (SymbolViewComponent) {
    return (
      <SymbolViewComponent
        name={FALLBACK_SYMBOL_NAME}
        size={48}
        weight="semibold"
        tintColor={tintColor}
      />
    );
  }
  return <Text style={FALLBACK_EMOJI_STYLE}>🍳</Text>;
}
