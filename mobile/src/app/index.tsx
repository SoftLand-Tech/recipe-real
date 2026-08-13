import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipes,
  seedAndCacheRecipes,
} from "@/db/database";
import type { Recipe } from "@/types";

type LoadState = "loading" | "ready" | "error";

/** Formats a community/cleanup minute value into a short label fragment. */
function fmtMinutes(value: number | null | undefined): string {
  if (value == null) return "—";
  const rounded = Math.round(value);
  return `${rounded} min`;
}

export default function RecipeListScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Tablet (width >= 768): two columns. Phones: one column.
  const numColumns = width >= 768 ? 2 : 1;
  const columnGap = 12;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Load recipes from the cache, seeding first if the cache is empty.
  const loadFromCache = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const count = await countCachedRecipes();
      if (count === 0) {
        await seedAndCacheRecipes();
      }
      const cached = await getCachedRecipes();
      setRecipes(cached);
      setState("ready");
    } catch (error) {
      console.warn("[RecipeReal] loadFromCache failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load recipes.",
      );
      setState("error");
    }
  }, []);

  // Background refresh: re-seed and update the list without blocking UI.
  const refreshInBackground = useCallback(async () => {
    try {
      await seedAndCacheRecipes();
      const cached = await getCachedRecipes({ search });
      setRecipes(cached);
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] background refresh failed:", error);
    }
  }, [search]);

  useEffect(() => {
    loadFromCache().then(() => {
      // After showing cached data, refresh in the background once.
      refreshInBackground();
      // Best-effort: upload any cook sessions queued while offline.
      flushPendingCookSessions().catch((error) => {
        console.warn("[RecipeReal] background flush failed:", error);
      });
    });
    // We intentionally run this only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshInBackground();
    setRefreshing(false);
  }, [refreshInBackground]);

  // Client-side title search over the cached recipes.
  const visibleRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, search]);

  const renderItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => {
      const summary = `Community avg: ${fmtMinutes(
        item.community_avg_minutes,
      )} · Cleanup: ${fmtMinutes(item.cleanup_avg_minutes)}`;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            numColumns > 1 && styles.cardColumn,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push(`/recipe/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open recipe ${item.title}`}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardSummary}>{summary}</Text>
        </Pressable>
      );
    },
    [numColumns],
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.heading}>Recipes</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.premiumPill,
                pressed && styles.premiumPillPressed,
              ]}
              onPress={() => router.push("/upgrade")}
            >
              <Text style={styles.premiumPillText}>Go Premium</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.paceButton,
                pressed && styles.paceButtonPressed,
              ]}
              onPress={() => router.push("/pace")}
            >
              <Text style={styles.paceButtonText}>Your pace</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {state === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Loading recipes…</Text>
        </View>
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.muted}>
            {errorMessage ?? "Could not load recipes."}
          </Text>
          <Pressable style={styles.button} onPress={loadFromCache}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {state === "ready" && (
        <FlatList
          key={numColumns === 1 ? "list-1col" : "list-2col"}
          data={visibleRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={
            numColumns > 1
              ? { justifyContent: "flex-start", gap: columnGap }
              : undefined
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ItemSeparatorComponent={() =>
            numColumns > 1 ? <View style={{ height: columnGap }} /> : (
              <View style={styles.separator} />
            )
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>
                {search
                  ? "No recipes match your search."
                  : "No recipes available yet."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  paceButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paceButtonPressed: {
    backgroundColor: "#DBEAFE",
  },
  paceButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumPill: {
    backgroundColor: "#F5F3FF",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  premiumPillPressed: {
    backgroundColor: "#EDE9FE",
  },
  premiumPillText: {
    color: "#7C3AED",
    fontSize: 14,
    fontWeight: "600",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardColumn: {
    flex: 1,
  },
  cardPressed: {
    backgroundColor: "#F9FAFB",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  cardSummary: {
    fontSize: 13,
    color: "#6B7280",
  },
  separator: {
    height: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
