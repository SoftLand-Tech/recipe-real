import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Radius, Space, Type, useThemeColors } from "@/theme";

export interface TimeChipProps {
  minutes: number | null;
  label?: string;
}

/** Format a minute count into a compact human string. */
export function fmtMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "0m";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function TimeChip({ minutes, label }: TimeChipProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingVertical: Space.xs,
          paddingHorizontal: Space.sm,
          alignSelf: "flex-start",
        },
        text: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        faint: {
          color: colors.inkFaint,
        },
      }),
    [colors],
  );

  const hasTime = minutes != null && Number.isFinite(minutes);
  const text = hasTime ? fmtMinutes(minutes as number) : "—";

  return (
    <View style={styles.base}>
      <Glyph tintColor={colors.inkSecondary} />
      <Text style={[styles.text, !hasTime && styles.faint]} numberOfLines={1}>
        {label ? `${label} ` : ""}
        {text}
      </Text>
    </View>
  );
}

/** Small clock glyph; expo-symbols on native, a unicode fallback on web. */
function Glyph({ tintColor }: { tintColor: string }) {
  const glyphStyle = { marginRight: Space.xs };
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      const { SymbolView } = require("expo-symbols");
      return (
        <SymbolView
          name={{ ios: "clock", android: "schedule", web: "schedule" }}
          size={13}
          weight="semibold"
          tintColor={tintColor}
          style={glyphStyle}
        />
      );
    } catch {
      // Fall through to unicode fallback if the native module isn't present.
    }
  }
  return (
    <Text style={[glyphStyle, { fontSize: 12, color: tintColor }]}>◷</Text>
  );
}
