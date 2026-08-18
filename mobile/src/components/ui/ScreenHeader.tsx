import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Space, Type, useThemeColors } from "@/theme";

export interface ScreenHeaderProps {
  /** Big on-screen title (Type.h1, ink). */
  title: string;
  /** Optional supporting line under the title (Type.bodySm, inkSecondary). */
  subtitle?: string;
  /** Optional trailing action (e.g. a "+" icon button) aligned to the title. */
  right?: ReactNode;
}

/**
 * The shared big on-screen header used by every tab screen (native tab-group
 * headers are off). Sits directly on the canvas background — no card/surface
 * behind it — and handles its own top safe-area inset.
 */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
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
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        title: {
          ...Type.h1,
          color: colors.ink,
          flex: 1,
        },
        subtitle: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        right: {
          // Static style only (Android paint rules) — IconPressable provides
          // the pressed feedback.
          width: 40,
          height: 40,
          borderRadius: 999,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, insets.top],
  );
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
