import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Color, Space, Type } from "@/theme";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.sm,
  },
  text: {
    flex: 1,
    marginRight: Space.md,
  },
  title: {
    ...Type.h3,
    color: Color.ink,
  },
  subtitle: {
    ...Type.bodySm,
    color: Color.inkSecondary,
    marginTop: 2,
  },
  action: {
    alignSelf: "flex-start",
  },
});
