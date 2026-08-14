import { Text } from "react-native";
import { Tabs } from "expo-router";

import { useThemeColors } from "@/theme";

/**
 * Bottom-tab navigation for the four top-level destinations. Route URLs are
 * unchanged by the group: "/", "/pace", "/upgrade", "/settings" — so existing
 * router.push("/pace") / router.push("/upgrade") calls keep working.
 * Colors are resolved per scheme via useThemeColors().
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
      {/* Renders its own header (title + search bar) with a manual top inset. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Recipes",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>🍳</Text>
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
            <Text style={{ color, fontSize: 18 }}>⏱</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="upgrade"
        options={{
          title: "Premium",
          headerShown: true,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "600" },
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>✦</Text>
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
            <Text style={{ color, fontSize: 18 }}>⚙</Text>
          ),
        }}
      />
    </Tabs>
  );
}
