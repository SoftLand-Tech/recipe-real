import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { useLang } from "@/i18n";
import { Radius, Space } from "@/theme";

export interface NoteBadgeProps {
  /** Render the badge; callers hide it when the recipe has no note. */
  show: boolean;
}

/**
 * Tiny non-interactive pencil overlay marking recipe cards that carry a
 * personal note. Sits over photos, so like HeartButton it is a dark
 * translucent circle with a white glyph. Anchored to the physical top-start
 * corner — the heart owns top-end — so the two never collide in either layout
 * direction. A plain View (no press target) with static styles only
 * (Android paint rules).
 */
export function NoteBadge({ show }: NoteBadgeProps) {
  const { dir } = useLang();
  if (!show) return null;
  return (
    <View style={[styles.base, dir === "rtl" ? styles.baseRtl : styles.baseLtr]}>
      <Ionicons name="pencil" size={12} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    top: Space.sm,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  baseLtr: {
    left: Space.sm,
  },
  baseRtl: {
    right: Space.sm,
  },
});
