import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/i18n";
import { useThemeColors } from "@/theme";

/**
 * Bottom-tab navigation for the six top-level destinations. Route URLs are
 * unchanged by the group: "/", "/browse", "/pace", "/favorites",
 * "/community", "/settings" — so existing router.push(...) calls keep
 * working. "/upgrade" is NOT a tab anymore: it lives in the root stack
 * (src/app/upgrade.tsx), so pushes to "/upgrade" from pace.tsx /
 * recipe/[id].tsx still resolve. Colors are resolved per scheme via
 * useThemeColors(); titles via useT(). All six tabs render the shared
 * on-screen ScreenHeader; native headers are off across the group. The tab
 * row order follows the layout direction (RTL via I18nManager).
 *
 * Elderly / low-tech sizing: 26px icons and 13/600 labels inside a ~64px
 * content bar; the safe-area inset is added as bottom padding ON TOP of the
 * content height (a fixed 64 would otherwise be eaten by the gesture bar).
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: t("tabs.browse"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pace"
        options={{
          title: t("tabs.pace"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="speedometer" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("tabs.favorites"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("tabs.community"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
