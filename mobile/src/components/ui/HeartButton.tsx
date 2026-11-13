import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { StyleSheet } from "react-native";

import { useLang } from "@/i18n";
import { Radius, Space } from "@/theme";

import { IconPressable } from "./IconPressable";

export interface HeartButtonProps {
  favorited: boolean;
  onPress: () => void;
  /** sm = 30px list-card overlay; lg = 38px detail-hero overlay. */
  size?: "sm" | "lg";
}

const DIMENSIONS = { sm: 30, lg: 38 } as const;

/**
 * The heart overlay used on recipe cards and the detail hero. Sits over
 * photos, so it's always a dark translucent circle: white outline heart when
 * unfavored, red filled heart when favored. Pressed feedback: instant opacity
 * dim (IconPressable).
 *
 * Anchored to the physical top-end corner: `left`/`right` don't flip in RTL,
 * so the side is chosen from the resolved layout direction.
 */
export const HeartButton = memo(function HeartButton({
  favorited,
  onPress,
  size = "sm",
}: HeartButtonProps) {
  const { dir } = useLang();
  return (
    <IconPressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.base,
        dir === "rtl" ? styles.baseRtl : styles.baseLtr,
        size === "lg" ? styles.sizeLg : styles.sizeSm,
      ]}
    >
      <Ionicons
        name={favorited ? "heart" : "heart-outline"}
        size={size === "lg" ? 20 : 17}
        color={favorited ? "#E8384F" : "#FFFFFF"}
      />
    </IconPressable>
  );
});

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    top: Space.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
  },
  baseLtr: {
    right: Space.sm,
  },
  baseRtl: {
    left: Space.sm,
  },
  sizeSm: {
    width: DIMENSIONS.sm,
    height: DIMENSIONS.sm,
  },
  sizeLg: {
    width: DIMENSIONS.lg,
    height: DIMENSIONS.lg,
  },
});
