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
 * Deliberate full-bleed surfaces (photo grids, square-card social feeds,
 * grouped settings rows, horizontal carousels) keep using a plain
 * View/ScrollView/FlatList directly — there is no opt-out prop to misuse.
 */
import { forwardRef, memo } from "react";
import {
  FlatList,
  ScrollView,
  View,
  type FlatListProps,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";

import { MaxContentWidth, Space } from "@/theme";

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

export type ScreenViewProps = ViewProps;

/** Padded View for non-scrolling screen layouts. */
export const ScreenView = memo(function ScreenView({
  style,
  ...rest
}: ScreenViewProps) {
  return <View {...rest} style={[SCREEN_CONTENT_STYLE, style]} />;
});

export type ScreenScrollViewProps = ScrollViewProps;

/**
 * ScrollView whose content is gutter-padded. Screen-provided
 * `contentContainerStyle` is merged on top, so vertical paddings/gaps stay
 * with the screen; do not re-add horizontal padding here.
 */
export const ScreenScrollView = memo(
  forwardRef<ScrollView, ScreenScrollViewProps>(function ScreenScrollView(
    { contentContainerStyle, ...rest },
    ref,
  ) {
    return (
      <ScrollView
        {...rest}
        ref={ref}
        contentContainerStyle={[SCREEN_CONTENT_STYLE, contentContainerStyle]}
      />
    );
  }),
);

export type ScreenFlatListProps<ItemT> = FlatListProps<ItemT>;

/**
 * FlatList whose content is gutter-padded. Same merge contract as
 * ScreenScrollView: the screen's contentContainerStyle (vertical padding,
 * gaps) is applied after the shared gutter.
 */
export function ScreenFlatList<ItemT>({
  contentContainerStyle,
  ...rest
}: ScreenFlatListProps<ItemT>) {
  return (
    <FlatList<ItemT>
      {...rest}
      contentContainerStyle={[SCREEN_CONTENT_STYLE, contentContainerStyle]}
    />
  );
}
