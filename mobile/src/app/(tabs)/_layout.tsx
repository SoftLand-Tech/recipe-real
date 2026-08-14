import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Bottom-tab navigation for the five top-level destinations. Route URLs are
 * unchanged by the group: "/", "/browse", "/pace", "/favorites", "/settings" —
 * so existing router.push(...) calls keep working. "/upgrade" is NOT a tab
 * anymore: it lives in the root stack (src/app/upgrade.tsx), so pushes to
 * "/upgrade" from pace.tsx / recipe/[id].tsx still resolve. Colors are
 * resolved per scheme via useThemeColors().
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
      {/* Home: curated rails; renders its own header with a manual top inset. */}
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
      {/* Browse: the full recipe list; renders its own header (title + search). */}
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
          headerShown: true,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "600" },
          tabBarIcon: ({ color }) => (
            <Ionicons name="speedometer" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          headerShown: true,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "600" },
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: true,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "600" },
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
