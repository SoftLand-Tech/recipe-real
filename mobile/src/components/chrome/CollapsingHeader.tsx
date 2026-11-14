import { useMemo, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useLang, useT } from "@/i18n";
import { Space, Type, useThemeColors } from "@/theme";
import { IconPressable } from "@/components/ui";

/**
 * Compact header bar (v4): a small 17pt title + plain icons, visible from
 * the start. On TAB screens it hides on scroll-down and returns on
 * scroll-up (Facebook-style) — pass ScrollChrome's `hidden` value so it
 * moves in lockstep with the tab bar, giving full-screen content while
 * scrolling. On PUSHED screens it stays put (no `hidden`).
 */

/** Height of the bar's action row (excludes the safe-area inset). */
export const PINNED_BAR_ROW = 44;

/**
 * Scroll-content top padding: safe area + bar row + a small gap. The bar is
 * an overlay, so when it hides the content scrolls under it.
 */
export function usePinnedBarPad(): number {
  const insets = useSafeAreaInsets();
  return insets.top + PINNED_BAR_ROW + Space.xs;
}

export interface PinnedHeaderBarProps {
  /** Bar title (17pt), always visible. */
  title: string;
  /**
   * Custom content in place of the title text (e.g. a brand logo chip on
   * Home). `title` is still used as the accessibility label.
   */
  titleContent?: ReactNode;
  /**
   * ScrollChrome's `hidden` value (0 = shown, 1 = hidden). Provide on tab
   * screens: the bar slides fully away on scroll-down and back on
   * scroll-up, in sync with the tab bar. Omit to keep the bar always
   * visible (pushed screens).
   */
  hidden?: Animated.Value;
  /** Leading control — normally <BackChevron /> on pushed screens. */
  leading?: ReactNode;
  /** Trailing actions (plain icons — no circle chrome). */
  rights?: ReactNode[];
}

export function PinnedHeaderBar({ title, titleContent, hidden, leading, rights }: PinnedHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          paddingTop: insets.top,
          backgroundColor: colors.canvas,
        },
        row: {
          height: PINNED_BAR_ROW,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          // Always the screen gutter — a leading back chevron used to collapse
          // this to 4px, so the chevron/title aligned with neither the padded
          // content (16) nor the full-bleed screens (0).
          paddingHorizontal: Space.lg,
        },
        title: {
          ...Type.title,
          color: colors.ink,
          flex: 1,
        },
        titleSlot: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
        },
        rightsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        hairline: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.hairline,
        },
      }),
    [colors, insets.top],
  );

  // Slide the whole bar (incl. hairline) off-screen when the chrome hides.
  const barStyle = useMemo(
    () =>
      hidden != null
        ? {
            transform: [
              {
                translateY: hidden.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -(insets.top + PINNED_BAR_ROW + 1)],
                }),
              },
            ],
          }
        : undefined,
    [hidden, insets.top],
  );

  return (
    <Animated.View style={[styles.bar, barStyle]} pointerEvents="box-none" accessibilityLabel={title}>
      <View style={styles.row}>
        {leading}
        {titleContent != null ? (
          <View style={styles.titleSlot}>{titleContent}</View>
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {rights && rights.length > 0 ? (
          <View style={styles.rightsRow}>{rights}</View>
        ) : null}
      </View>
      <View style={styles.hairline} />
    </Animated.View>
  );
}

/**
 * Back affordance for PUSHED (stack) screens — platform convention: chevron
 * for hierarchy, X only for modals. Flips with RTL.
 */
export function BackChevron() {
  const colors = useThemeColors();
  const t = useT();
  // Reactive direction from the language preference — I18nManager.isRTL can
  // be stale for a session after an in-app flip (same fix as cook mode).
  const { dir } = useLang();
  return (
    <IconPressable
      onPress={() => router.back()}
      accessibilityLabel={t("common.back")}
      hitSlop={Space.xs}
    >
      <Ionicons
        name={dir === "rtl" ? "chevron-forward" : "chevron-back"}
        size={26}
        color={colors.accent}
      />
    </IconPressable>
  );
}

/**
 * Small caption line for ex-subtitle info (e.g. Favorites tagline, Pace
 * cook-count) that used to live under the big title. Renders at the top of
 * scroll content, scrolls away with it.
 */
export function ScreenCaption({ text }: { text: string }) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        caption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          // No horizontal padding: caption renders inside the screen's
          // content gutter (ScreenScrollView/ScreenFlatList), so adding its
          // own would double the inset.
          paddingBottom: Space.sm,
        },
      }),
    [colors],
  );
  return (
    <Text style={styles.caption} numberOfLines={2}>
      {text}
    </Text>
  );
}

// Re-exported scroll types for callers that compose handlers.
export type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
