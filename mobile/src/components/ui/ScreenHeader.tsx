import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Space, Type, useThemeColors } from "@/theme";

export interface ScreenHeaderProps {
  /** Big on-screen title (Type.h1, ink). */
  title: string;
  /** Optional supporting line under the title (Type.bodySm, inkSecondary). */
  subtitle?: string;
}

/**
 * The shared big on-screen header used by every tab screen (native tab-group
 * headers are off). Sits directly on the canvas background — no card/surface
 * behind it — and handles its own top safe-area inset.
 */
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingTop: insets.top + Space.md,
          paddingHorizontal: Space.lg,
          paddingBottom: Space.sm,
          gap: Space.xs,
        },
        title: {
          ...Type.h1,
          color: colors.ink,
        },
        subtitle: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
      }),
    [colors, insets.top],
  );
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
