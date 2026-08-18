import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet } from "react-native";

import { useLang } from "@/i18n";
import { Radius, Space } from "@/theme";

import { IconPressable } from "./IconPressable";

export interface HeartButtonProps {
  favorited: boolean;
  onPress: () => void;
  /** sm = 34px list-card overlay; lg = 42px detail-hero overlay. */
  size?: "sm" | "lg";
}

const DIMENSIONS = { sm: 34, lg: 42 } as const;

/**
 * The heart overlay used on recipe cards and the detail hero. Sits over
 * photos, so it's always a dark translucent circle: white outline heart when
 * unfavored, red filled heart when favored. Pressed feedback: instant opacity
 * dim (IconPressable).
 *
 * Anchored to the physical top-end corner: `left`/`right` don't flip in RTL,
 * so the side is chosen from the resolved layout direction.
 */
export function HeartButton({ favorited, onPress, size = "sm" }: HeartButtonProps) {
  const { dir } = useLang();
  const dim = DIMENSIONS[size];
  return (
    <IconPressable
      onPress={onPress}
      hitSlop={10}
      style={[
        styles.base,
        dir === "rtl" ? styles.baseRtl : styles.baseLtr,
        {
          width: dim,
          height: dim,
          borderRadius: Radius.pill,
        },
      ]}
    >
      <Ionicons
        name={favorited ? "heart" : "heart-outline"}
        size={size === "lg" ? 20 : 17}
        color={favorited ? "#E8384F" : "#FFFFFF"}
      />
    </IconPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    top: Space.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  baseLtr: {
    right: Space.sm,
  },
  baseRtl: {
    left: Space.sm,
  },
});
