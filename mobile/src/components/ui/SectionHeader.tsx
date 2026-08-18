import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Space, Type, useThemeColors } from "@/theme";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          // Breathing room below the header so the section content that
          // follows reads as a calmer, lower-density block.
          marginBottom: Space.md,
        },
        text: {
          flex: 1,
          // marginEnd (not marginRight): the gap must sit between the text and
          // the trailing action on BOTH sides of the layout direction.
          marginEnd: Space.md,
        },
        title: {
          ...Type.h3,
          color: colors.ink,
        },
        subtitle: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          marginTop: 2,
        },
        action: {
          alignSelf: "flex-start",
        },
      }),
    [colors],
  );
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
