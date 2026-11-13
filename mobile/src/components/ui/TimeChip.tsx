import { memo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useFmtMinutes } from "@/i18n";
import { Radius, Space, Type, useThemeColors, type ThemeColors } from "@/theme";

// The pure formatter now lives in `@/i18n` (so screens and this chip share one
// implementation); re-exported here to keep the `@/components/ui` barrel path
// (`export { TimeChip, fmtMinutes } from "./TimeChip"`) working.
export { fmtMinutes } from "@/i18n";

let SymbolViewComponent: typeof import("expo-symbols").SymbolView | null = null;
if (Platform.OS === "ios" || Platform.OS === "android") {
  try {
    SymbolViewComponent = require("expo-symbols").SymbolView ?? null;
  } catch {
    SymbolViewComponent = null;
  }
}

const CLOCK_SYMBOL_NAME = { ios: "clock", android: "schedule", web: "schedule" } as const;
// marginEnd (not marginRight) so the gap follows the layout direction in RTL.
const GLYPH_STYLE = { marginEnd: Space.xs } as const;

function createTimeChipStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  });
}

const stylesByTheme = new WeakMap<ThemeColors, ReturnType<typeof createTimeChipStyles>>();

function getTimeChipStyles(colors: ThemeColors) {
  let cached = stylesByTheme.get(colors);
  if (!cached) {
    cached = createTimeChipStyles(colors);
    stylesByTheme.set(colors, cached);
  }
  return cached;
}

export interface TimeChipProps {
  minutes: number | null;
  label?: string;
}

export const TimeChip = memo(function TimeChip({ minutes, label }: TimeChipProps) {
  const colors = useThemeColors();
  const fmt = useFmtMinutes();
  const styles = getTimeChipStyles(colors);

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
});

/** Small clock glyph; expo-symbols on native, a unicode fallback on web. */
function Glyph({ tintColor }: { tintColor: string }) {
  if (SymbolViewComponent) {
    return (
      <SymbolViewComponent
        name={CLOCK_SYMBOL_NAME}
        size={13}
        weight="semibold"
        tintColor={tintColor}
        style={GLYPH_STYLE}
      />
    );
  }
  return (
    <Text style={[GLYPH_STYLE, { fontSize: 12, color: tintColor }]}>◷</Text>
  );
}
