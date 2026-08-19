import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { useT } from "@/i18n";
import { useThemeColors } from "@/theme";

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
    <Tabs
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
  );
}
