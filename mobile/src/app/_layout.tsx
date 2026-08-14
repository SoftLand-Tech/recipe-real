import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router";
import { useColorScheme } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import "@/global.css";
import { track } from "@/analytics";
import { initDatabase } from "@/db/database";

/**
 * Root layout. Initializes the offline SQLite cache on mount and provides the
 * SafeAreaProvider + theme for the whole app.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initDatabase().catch((error) => {
      // Cache failures are non-fatal: screens fall back to the network.
      console.warn("[RecipeReal] initDatabase failed:", error);
    });
    // Fire-and-forget analytics. Runs once on app mount.
    track("app_open");
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: true }}>
          {/*
            The (tabs) group provides bottom-tab navigation for the three
            top-level destinations. Its own screens manage headers: index
            renders its own header (title + search bar) with a manual
            status-bar inset, so the Stack header is hidden for the whole
            group to avoid a double-counted gap.
          */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="recipe/[id]"
            options={{ title: "Recipe", headerShown: false }}
          />
          <Stack.Screen
            name="cook/[id]"
            options={{ title: "Cook Mode", headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
