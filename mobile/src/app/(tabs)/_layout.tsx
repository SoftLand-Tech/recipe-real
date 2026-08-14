import { Text } from "react-native";
import { Tabs } from "expo-router";

import { Color } from "@/theme";

/**
 * Bottom-tab navigation for the three top-level destinations. Route URLs are
 * unchanged by the group: "/", "/pace", "/upgrade" — so existing
 * router.push("/pace") / router.push("/upgrade") calls keep working.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Color.accent,
        tabBarInactiveTintColor: Color.inkFaint,
        tabBarStyle: {
          backgroundColor: Color.surface,
          borderTopColor: Color.hairline,
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
          headerStyle: { backgroundColor: Color.canvas },
          headerTintColor: Color.ink,
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
          headerStyle: { backgroundColor: Color.canvas },
          headerTintColor: Color.ink,
          headerTitleStyle: { fontWeight: "600" },
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>✦</Text>
          ),
        }}
      />
    </Tabs>
  );
}
