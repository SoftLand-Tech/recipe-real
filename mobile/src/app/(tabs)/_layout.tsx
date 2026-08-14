import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Bottom-tab navigation for the five top-level destinations. Route URLs are
 * unchanged by the group: "/", "/browse", "/pace", "/favorites", "/settings" —
 * so existing router.push(...) calls keep working. "/upgrade" is NOT a tab
 * anymore: it lives in the root stack (src/app/upgrade.tsx), so pushes to
 * "/upgrade" from pace.tsx / recipe/[id].tsx still resolve. Colors are
 * resolved per scheme via useThemeColors(). All five tabs render the shared
 * on-screen ScreenHeader; native headers are off across the group.
 */
export default function TabsLayout() {
  const colors = useThemeColors();

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
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pace"
        options={{
          title: "Your Pace",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="speedometer" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
