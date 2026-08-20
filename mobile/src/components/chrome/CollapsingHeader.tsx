import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { Animated, I18nManager, StyleSheet, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useT } from "@/i18n";
import { Space, Type, useThemeColors } from "@/theme";
import { IconPressable } from "@/components/ui";

/**
 * Option-A header chrome: a slim PINNED bar (never hides) + a BIG title that
 * scrolls away with the content. While scrolled, the bar grows a small 17pt
 * title and a hairline (both faded in by scroll offset, iOS large-title
 * behavior) so the screen always keeps its identity mid-feed.
 */

/** Height of the bar's action row (excludes the safe-area inset). */
export const PINNED_BAR_ROW = 44;

/** Scroll-offset window over which the small title + hairline fade in. */
const COLLAPSE_FROM = 16;
const COLLAPSE_TO = 48;

/**
 * Scroll-content top padding. On tab screens the bar only exists once you
 * scroll (it overlays content), so content starts right under the status
 * bar. Pushed screens render the bar in flow above the content instead.
 */
export function usePinnedBarPad(): number {
  const insets = useSafeAreaInsets();
  return insets.top + Space.sm;
}

/**
 * Drives PinnedHeaderBar's collapse. Returns an Animated scroll offset
 * (clamped to the fade window) plus a ready-to-spread onScroll that composes
 * an existing handler — pass ScrollChrome's onScroll there so the tab bar
 * keep its hide/show behavior unchanged.
 */
export function useCollapseScroll(options?: {
  existingOnScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const existingOnScroll = options?.existingOnScroll;
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.setValue(Math.min(Math.max(y, 0), COLLAPSE_TO + 8));
      existingOnScroll?.(event);
    },
    [scrollY, existingOnScroll],
  );
  return { scrollY, onScroll, scrollEventThrottle: 16 as const };
}

export interface PinnedHeaderBarProps {
  /** Bar title (17pt). On collapsing screens it fades in only when scrolled. */
  title: string;
  /**
   * Animated scroll offset from useCollapseScroll. Provide on tab screens —
   * the small title + hairline fade in with scroll. Omit on pushed screens —
   * the title + hairline are always shown (there is no big title there).
   */
  collapse?: Animated.Value;
  /** Leading control — normally <BackChevron /> on pushed screens. */
  leading?: ReactNode;
  /** Trailing actions (plain icons — no circle chrome). */
  rights?: ReactNode[];
}

export function PinnedHeaderBar({ title, collapse, leading, rights }: PinnedHeaderBarProps) {
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
          paddingHorizontal: leading ? Space.xs : Space.lg,
        },
        title: {
          ...Type.title,
          color: colors.ink,
          flex: 1,
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
    [colors, insets.top, leading],
  );

  // On collapsing (tab) screens the WHOLE bar materializes with scroll: at
  // the top it is fully invisible (no dead action-only row under the status
  // bar — the actions live on the big title's row instead) and fades in as
  // the big title scrolls away.
  const barStyle =
    collapse != null
      ? {
          opacity: collapse.interpolate({
            inputRange: [COLLAPSE_FROM, COLLAPSE_TO],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
        }
      : undefined;

  return (
    <Animated.View style={[styles.bar, barStyle]} pointerEvents="box-none">
      <View style={styles.row}>
        {leading}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
  return (
    <IconPressable
      onPress={() => router.back()}
      accessibilityLabel={t("common.back")}
      hitSlop={Space.xs}
    >
      <Ionicons
        name={I18nManager.isRTL ? "chevron-forward" : "chevron-back"}
        size={26}
        color={colors.accent}
      />
    </IconPressable>
  );
}

/**
 * The big 24pt screen title — rendered INSIDE the scroll content (first
 * child) so it scrolls away under the bar that materializes on scroll.
 * `rights` (bell/avatar) ride the title's row at the top; once scrolled,
 * the bar's own copies take over.
 */
export function BigScreenTitle({
  title,
  subtitle,
  rights,
}: {
  title: string;
  subtitle?: string;
  rights?: ReactNode[];
}) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.xs,
          paddingBottom: subtitle ? Space.xs : Space.sm,
          gap: Space.xs,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        title: {
          ...Type.h1,
          fontSize: 24,
          letterSpacing: -0.3,
          color: colors.ink,
          flex: 1,
        },
        rightsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        subtitle: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {rights && rights.length > 0 ? (
          <View style={styles.rightsRow}>{rights}</View>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
