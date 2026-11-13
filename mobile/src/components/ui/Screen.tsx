/**
 * Screen content gutter — the app-wide horizontal container.
 *
 * Every screen's primary content should sit inside a 16px left/right gutter
 * (`Space.lg`) and a 720px readable column on tablets/web (`MaxContentWidth`).
 * Before this primitive each screen hand-rolled its own `contentContainerStyle`
 * padding, which drifted to 0 / 12 / 20 / 24 across the app and made several
 * list screens render rounded cards flush against the screen edges.
 *
 * Usage:
 *   <ScreenScrollView contentContainerStyle={styles.content}> ... </ScreenScrollView>
 *   <ScreenFlatList data={...} contentContainerStyle={styles.list} ... />
 *   <ScreenView style={styles.container}> ... </ScreenView>
 *
 * Pass `bleed` only for surfaces that are intentionally edge-to-edge (full-
 * bleed photo grids, social feeds with square cards, grouped settings rows,
 * horizontal carousels). `bleed` removes both the gutter and the max width.
 */
import { memo } from "react";
import {
  FlatList,
  ScrollView,
  View,
  type FlatListProps,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";

import { MaxContentWidth, Space } from "@/theme";

/** Shared props for every Screen* container. */
export interface ScreenGutterProps {
  /** Opt out of the 16px gutter + 720px column for deliberate full-bleed layouts. */
  bleed?: boolean;
}

/**
 * Content gutter: 16px sides, 720px max width, centered on wide viewports.
 * Screens may still merge their own style on top (vertical paddings, gaps).
 */
export const SCREEN_CONTENT_STYLE = {
  paddingHorizontal: Space.lg,
  width: "100%",
  maxWidth: MaxContentWidth,
  alignSelf: "center",
} as const;

/** Full-bleed content: no gutter, no width cap. */
const BLEED_STYLE = { width: "100%" } as const;

export interface ScreenViewProps extends ViewProps, ScreenGutterProps {}

/** Padded View for non-scrolling screen layouts. */
export const ScreenView = memo(function ScreenView({
  bleed,
  style,
  ...rest
}: ScreenViewProps) {
  return <View {...rest} style={[bleed ? BLEED_STYLE : SCREEN_CONTENT_STYLE, style]} />;
});

export interface ScreenScrollViewProps extends ScrollViewProps, ScreenGutterProps {}

/**
 * ScrollView whose content is gutter-padded. Screen-provided
 * `contentContainerStyle` is merged on top, so vertical paddings/gaps stay
 * with the screen; do not re-add horizontal padding here.
 */
export const ScreenScrollView = memo(function ScreenScrollView({
  bleed,
  contentContainerStyle,
  scrollViewRef,
  ...rest
}: ScreenScrollViewProps) {
  return (
    <ScrollView
      {...rest}
      // Forward through `ref`: `scrollViewRef` is native-only (react-native-web
      // does not implement it), while `ref` works on both platforms and exposes
      // the same public instance (scrollTo, etc.).
      ref={scrollViewRef}
      contentContainerStyle={[
        bleed ? BLEED_STYLE : SCREEN_CONTENT_STYLE,
        contentContainerStyle,
      ]}
    />
  );
});

export interface ScreenFlatListProps<ItemT>
  extends FlatListProps<ItemT>,
    ScreenGutterProps {}

/**
 * FlatList whose content is gutter-padded. Same merge contract as
 * ScreenScrollView: the screen's contentContainerStyle (vertical padding,
 * gaps) is applied after the shared gutter.
 */
export function ScreenFlatList<ItemT>({
  bleed,
  contentContainerStyle,
  ...rest
}: ScreenFlatListProps<ItemT>) {
  return (
    <FlatList<ItemT>
      {...rest}
      contentContainerStyle={[
        bleed ? BLEED_STYLE : SCREEN_CONTENT_STYLE,
        contentContainerStyle,
      ]}
    />
  );
}
