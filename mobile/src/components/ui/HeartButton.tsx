import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet } from "react-native";

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
 */
export function HeartButton({ favorited, onPress, size = "sm" }: HeartButtonProps) {
  const dim = DIMENSIONS[size];
  return (
    <IconPressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.base,
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
    right: Space.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
