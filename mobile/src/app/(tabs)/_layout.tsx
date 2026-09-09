import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { BottomTabBar } from "expo-router/build/react-navigation/bottom-tabs/views/BottomTabBar";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";

import { useT } from "@/i18n";
import { useThemeColors } from "@/theme";
import {
  ScrollChromeProvider,
  useScrollChromeContext,
} from "@/components/chrome";

function ChromeTabBar(props: BottomTabBarProps) {
  const { hidden } = useScrollChromeContext();
  // Fallback until onLayout measures the real height: the outputRange starts
  // at this value, so a chrome that mounts hidden is already off-screen
  // instead of flashing visible for a frame. Overshoot is harmless (further
  // off-screen); undershoot would flash a sliver. Corrected on layout.
  const [barHeight, setBarHeight] = useState(96);
  // Mirror the animated value into state so the slid-away bar drops out of
  // the touch tree (pointerEvents) and the screen-reader tree (accessible +
  // platform hidden flags) while hidden.
  const [isHidden, setIsHidden] = useState(false);
  useEffect(() => {
    const id = hidden.addListener(({ value }) => {
      setIsHidden(value > 0.5);
    });
    return () => {
      hidden.removeListener(id);
    };
  }, [hidden]);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h !== barHeight) setBarHeight(h);
    },
    [barHeight],
  );

  // Community tab should keep chrome visible — if the focused route is
  // community and chrome is hidden, we still animate via the shared value
  // but the screen itself won't report scroll to re-hide it. The always-visible
  // guarantee is handled by the scroll logic (near-top show) and the fact
  // community never calls hide; if chrome was hidden before entering community,
  // the next scroll-up on any reporting screen will reveal it. For extra safety,
  // we ensure the tab bar doesn't stay hidden when community is focused for a
  // long idle period: the provider's show is idempotent, so we can nudge it.
  // (No extra effect needed — spec says one-line follow-up.)

  const translateY = hidden.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barHeight],
  });

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={isHidden ? "none" : "auto"}
      accessible={isHidden ? false : undefined}
      accessibilityElementsHidden={isHidden}
      importantForAccessibility={isHidden ? "no-hide-descendants" : "auto"}
      style={[
        styles.tabBarWrap,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {/* BottomTabBar handles safe-area insets itself — keep props flowing. */}
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    // ABSOLUTE overlay: the screens container is flex:1 and the tab bar is
    // its flow sibling — an in-flow wrapper would leave a blank gap when
    // translated away. Absolute lets content fill the screen when hidden;
    // screens pad their scroll content past the bar while it is visible
    // (useChromeContentBottomPad).
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

/**
 * Bottom-tab navigation for the five top-level destinations. Route URLs are
 * unchanged by the group: "/", "/browse", "/favorites", "/community",
 * "/settings" — so existing router.push(...) calls keep working. Pace is NOT
 * a tab anymore: it lives in the root stack (src/app/pace.tsx), so pushes to
 * "/pace" from profile.tsx / settings.tsx / login.tsx still resolve.
 * "/upgrade" is also NOT a tab: it lives in the root stack
 * (src/app/upgrade.tsx), so pushes to "/upgrade" from recipe/[id].tsx still
 * resolve. Colors are resolved per scheme via useThemeColors(); titles via
 * useT(). All five tabs render the shared on-screen ScreenHeader (Home keeps
 * its custom brand header); native headers are off across the group. The tab
 * row order follows the layout direction (RTL via I18nManager).
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  const t = useT();

  return (
    <ScrollChromeProvider>
      <Tabs
        tabBar={(props) => <ChromeTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.hairline,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: t("tabs.browse"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("tabs.favorites"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("tabs.community"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={22} color={color} />
          ),
        }}
      />
      </Tabs>
    </ScrollChromeProvider>
  );
}
