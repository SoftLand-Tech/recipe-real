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
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: true }}>
          {/*
            The index screen renders its own header (title + search bar) and
            applies the status-bar inset manually via `paddingTop: insets.top`.
            Hiding the Stack header here makes that manual padding the sole
            source of the top safe-area, avoiding a double-counted gap.
          */}
          <Stack.Screen
            name="index"
            options={{ headerShown: false, title: "Recipes" }}
          />
          <Stack.Screen name="recipe/[id]" options={{ title: "Recipe" }} />
          <Stack.Screen name="pace" options={{ title: "Your Pace" }} />
          <Stack.Screen
            name="cook/[id]"
            options={{ title: "Cook Mode", headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
