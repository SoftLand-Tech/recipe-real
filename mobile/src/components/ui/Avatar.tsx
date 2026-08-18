import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { Type, useThemeColors } from "@/theme";

export interface AvatarProps {
  /** Author display name — its first letter becomes the fallback initial. */
  name?: string | null;
  /** Remote avatar URL; missing/empty/failed URIs fall back to the initial. */
  uri?: string | null;
  /** Circle diameter in dp. */
  size?: number;
}

/**
 * Circular author avatar: the remote photo (expo-image) when available,
 * otherwise a surfaceSoft circle with the first initial of `name`. Remote
 * avatars 404/expire over time, so a load failure swaps back to the initial
 * instead of rendering a blank circle.
 */
export function Avatar({ name, uri, size = 36 }: AvatarProps) {
  const colors = useThemeColors();
  // Remote avatar URIs expire — fall back to the initial circle on error.
  const [failed, setFailed] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        circle: {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        initial: {
          ...Type.title,
          fontSize: Math.round(size * 0.42),
          color: colors.inkSecondary,
        },
      }),
    [colors, size],
  );

  const hasUri = typeof uri === "string" && uri.trim().length > 0;
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";

  if (hasUri && !failed) {
    return (
      <View style={styles.circle}>
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={uri as string}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={styles.circle}>
      <Text style={styles.initial} numberOfLines={1}>
        {initial}
      </Text>
    </View>
  );
}
