import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { Radius, Space, Type, useThemeColors } from "@/theme";

export interface BadgeProps {
  label: string;
  stepType?: string;
}

export function Badge({ label, stepType }: BadgeProps) {
  const colors = useThemeColors();
  const tone =
    (stepType ? colors.stepTones[stepType] : undefined) ??
    colors.stepTones.default;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          ...Type.caption,
          textTransform: "uppercase",
          fontWeight: "700",
          letterSpacing: 1,
          fontSize: 11,
          paddingVertical: Space.xs,
          paddingHorizontal: Space.sm,
          borderRadius: Radius.sm,
          alignSelf: "flex-start",
          overflow: "hidden",
        },
      }),
    [],
  );
  return (
    <Text
      style={[
        styles.base,
        {
          backgroundColor: tone.bg,
          color: tone.fg,
        },
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}
