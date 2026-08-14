import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Color, Radius, Space } from "@/theme";

export interface SkeletonCardProps {
  hasImage?: boolean;
}

/**
 * Lightweight, dependency-free loading placeholder shaped like a recipe card.
 * Uses a subtle opacity pulse driven by a setInterval timer (700ms).
 */
export function SkeletonCard({ hasImage = true }: SkeletonCardProps) {
  const [opacity, setOpacity] = useState(0.5);

  useEffect(() => {
    const id = setInterval(() => {
      setOpacity((o) => (o >= 1 ? 0.5 : 1));
    }, 700);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.card}>
      {hasImage ? <View style={[styles.image, { opacity }]} /> : null}
      <View style={[styles.line, styles.lineTitle, { opacity }]} />
      <View style={[styles.line, styles.lineShort, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    overflow: "hidden",
  },
  image: {
    height: 150,
    backgroundColor: Color.surfaceSoft,
    borderRadius: Radius.lg,
    marginBottom: Space.md,
  },
  line: {
    backgroundColor: Color.surfaceSoft,
    borderRadius: Radius.sm,
    height: 14,
  },
  lineTitle: {
    width: "70%",
    marginBottom: Space.sm,
  },
  lineShort: {
    width: "40%",
  },
});
