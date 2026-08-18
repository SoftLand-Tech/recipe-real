import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Space, useThemeColors } from "@/theme";

export interface StepDotsProps {
  count: number;
  current: number;
  done: boolean[];
  onJump?: (index: number) => void;
}

export function StepDots({ count, current, done, onJump }: StepDotsProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        // Generous hit padding + hitSlop keeps each dot's tappable area ≥40px
        // (dot 10 + 2×8 padding + 2×8 hitSlop = 42) even though the visible
        // dot stays small.
        hit: {
          padding: Space.sm,
        },
        dot: {
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairlineStrong,
        },
        dotDone: {
          backgroundColor: colors.accent,
          borderColor: colors.accent,
        },
        dotCurrent: {
          width: 14,
          height: 14,
          backgroundColor: colors.accent,
          borderColor: colors.accent,
          // The slightly larger bordered wrapper = the "ring".
          margin: -2,
          shadowColor: colors.accent,
          shadowOpacity: 0.35,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
          elevation: 2,
        },
        dotUpcoming: {
          backgroundColor: "transparent",
        },
      }),
    [colors],
  );

  const dots = Array.from({ length: Math.max(0, count) }, (_, i) => i);

  return (
    <View style={styles.row}>
      {dots.map((i) => {
        const isDone = !!done[i];
        const isCurrent = i === current;
        const isUpcoming = !isDone && !isCurrent;

        const dot = (
          <View
            style={[
              styles.dot,
              isDone && styles.dotDone,
              isCurrent && styles.dotCurrent,
              isUpcoming && styles.dotUpcoming,
            ]}
          />
        );

        if (!onJump) return <View key={i}>{dot}</View>;

        return (
          <Pressable
            key={i}
            onPress={() => onJump(i)}
            hitSlop={Space.sm}
            style={styles.hit}
          >
            {dot}
          </Pressable>
        );
      })}
    </View>
  );
}
