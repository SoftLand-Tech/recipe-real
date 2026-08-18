import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useFmtMinutes } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";

// The pure formatter now lives in `@/i18n` (so screens and this chip share one
// implementation); re-exported here to keep the `@/components/ui` barrel path
// (`export { TimeChip, fmtMinutes } from "./TimeChip"`) working.
export { fmtMinutes } from "@/i18n";

export interface TimeChipProps {
  minutes: number | null;
  label?: string;
}

export function TimeChip({ minutes, label }: TimeChipProps) {
  const colors = useThemeColors();
  const fmt = useFmtMinutes();
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
  const text = hasTime ? fmt(minutes as number) : "—";

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
  // marginEnd (not marginRight) so the gap follows the layout direction in RTL.
  const glyphStyle = { marginEnd: Space.xs };
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
