import { useMemo, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Radius, Space, useThemeColors } from "@/theme";

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
export function HeroImage({
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
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        },
        children: {
          ...StyleSheet.absoluteFill,
          justifyContent: "flex-end",
          padding: Space.lg,
        },
      }),
    [colors],
  );

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
        <View style={[styles.fallback, { backgroundColor: colors.accentSoft }]}>
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
          onError={() => setFailed(true)}
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
}

/**
 * Smooth bottom legibility gradient behind overlaid text. A real linear
 * gradient (replaces the old five stacked opacity bars, which rendered as
 * visible bands). Black-based in both schemes on purpose — it overlays
 * photos, so it must darken, not tint.
 */
function Scrim() {
  return (
    <LinearGradient
      style={StyleSheet.absoluteFill}
      colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
      // Transparent over the top ~45%, darkening to the bottom edge.
      locations={[0.45, 1]}
      pointerEvents="none"
    />
  );
}

/** Utensil glyph on native (expo-symbols), emoji fallback elsewhere. */
function FallbackGlyph({ tintColor }: { tintColor: string }) {
  const glyphStyle = {};
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
          tintColor={tintColor}
          style={glyphStyle}
        />
      );
    } catch {
      // Fall through to the emoji fallback below.
    }
  }
  return <Text style={[glyphStyle, { fontSize: 44 }]}>🍳</Text>;
}
