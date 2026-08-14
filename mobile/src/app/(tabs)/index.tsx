import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { track } from "@/analytics";
import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipes,
  getFavoriteIds,
  getFavoriteRecipes,
  refreshCacheLight,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
  toggleFavorite,
} from "@/db/database";
import type { Recipe } from "@/types";
import { Color, Radius, Space, Type } from "@/theme";
import {
  Card,
  Chip,
  HeroImage,
  SectionHeader,
  SkeletonCard,
  TimeChip,
} from "@/components/ui";
import {
  CATEGORIES,
  categorizeTitle,
  type CategoryId,
} from "@/utils/categorize";

type LoadState = "loading" | "ready" | "error";

/** Active list filter: a category, the "quick" time filter, or none. */
type ListFilter = "all" | CategoryId | "quick";

export default function RecipeListScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Tablet (width >= 768): two columns. Phones: one column.
  const numColumns = width >= 768 ? 2 : 1;
  const columnGap = Space.lg;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);

  // Background continuation after a cold first-page seed: stream the remaining
  // seed pages into the cache, then reload the list. Non-blocking on purpose —
  // if it fails mid-way we keep showing whatever already loaded.
  const continueSeedInBackground = useCallback(async () => {
    try {
      await seedCacheRemainingPages();
      setRecipes(await getCachedRecipes());
    } catch (error) {
      console.warn("[RecipeReal] background seed continuation failed:", error);
    }
  }, []);

  // Background refresh: light upsert (no step re-download) + reload from cache.
  const refreshInBackground = useCallback(async () => {
    try {
      await refreshCacheLight();
      setRecipes(await getCachedRecipes({ search }));
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] background refresh failed:", error);
    }
  }, [search]);

  // Reload the favorite id set + the favorites carousel data from SQLite.
  // Purely local, so this works offline. Best-effort: a failure keeps the
  // previous state rather than blanking the hearts.
  const reloadFavorites = useCallback(async () => {
    try {
      const [ids, favs] = await Promise.all([
        getFavoriteIds(),
        getFavoriteRecipes(),
      ]);
      setFavoriteIds(new Set(ids));
      setFavoriteRecipes(favs);
    } catch (error) {
      console.warn("[RecipeReal] loading favorites failed:", error);
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (id: number) => {
      try {
        const favorited = await toggleFavorite(id);
        track("favorite_toggled", { recipe_id: id, favorited });
        await reloadFavorites();
      } catch (error) {
        console.warn("[RecipeReal] toggle favorite failed:", error);
      }
    },
    [reloadFavorites],
  );

  const handleSelectFilter = useCallback((next: ListFilter) => {
    setFilter(next);
    if (next !== "all") {
      track("filter_used", { filter: next });
    }
  }, []);

  /**
   * Load recipes from the cache, seeding progressively on a cold cache.
   * Returns true when previously cached data was shown (so the caller can
   * decide whether a light background refresh is worthwhile).
   */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    setState("loading");
    setErrorMessage(null);
    try {
      const count = await countCachedRecipes();
      if (count === 0) {
        // Cold cache: seed just the first page (a fraction of the dataset) so
        // the list renders quickly; the remaining pages arrive in background.
        const first = await seedCacheFirstPage();
        setRecipes(first);
        setState("ready");
        continueSeedInBackground();
        return false;
      }
      setRecipes(await getCachedRecipes());
      setState("ready");
      return true;
    } catch (error) {
      console.warn("[RecipeReal] loadFromCache failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load recipes.",
      );
      setState("error");
      return false;
    }
  }, [continueSeedInBackground]);

  useEffect(() => {
    // Favorites are independent of the cache load: pull them in parallel.
    reloadFavorites();
    loadFromCache().then((hadCachedData) => {
      // Only light-refresh when we showed previously cached data; a cold
      // cache was just (progressively) seeded, so refreshing would re-download
      // what the seed continuation is already fetching.
      if (hadCachedData) {
        // Self-heal first: if the cached step library was wiped (legacy
        // INSERT OR REPLACE cascade), re-seed with steps instead of doing a
        // light refresh (which never downloads steps).
        repairCachedStepsIfNeeded()
          .then(async (repaired) => {
            if (repaired) {
              setRecipes(await getCachedRecipes());
            } else {
              await refreshInBackground();
            }
          })
          .catch((error) => {
            console.warn("[RecipeReal] cache repair check failed:", error);
          });
      }
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

  // Client-side filtering over the cached recipes: search ∘ category ∘ quick.
  const visibleRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = recipes;
    if (q) {
      out = out.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (filter !== "all") {
      out =
        filter === "quick"
          ? out.filter(
              (r) =>
                r.community_avg_minutes != null &&
                r.community_avg_minutes <= 30,
            )
          : out.filter((r) => categorizeTitle(r.title) === filter);
    }
    return out;
  }, [recipes, search, filter]);

  const hasActiveFilters = search.trim().length > 0 || filter !== "all";

  const stepCount = (item: Recipe) =>
    item.recipe_steps?.length ?? item.steps?.length ?? 0;

  const renderItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => {
      const favorited = favoriteIds.has(item.id);
      return (
        <Card
          onPress={() => router.push(`/recipe/${item.id}`)}
          padding={0}
          shadow="card"
          style={numColumns > 1 ? styles.cardColumn : styles.card}
        >
          <View>
            <HeroImage uri={item.image_url} height={150} rounded={Radius.lg} />
            {/* Static style only (no width:"100%" / flex) — see Android paint rules. */}
            <Pressable
              onPress={() => handleToggleFavorite(item.id)}
              hitSlop={8}
              style={styles.heartButton}
            >
              <Text style={styles.heartGlyph}>{favorited ? "♥" : "♡"}</Text>
            </Pressable>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardChips}>
              <TimeChip minutes={item.community_avg_minutes} label="Focused" />
              <TimeChip minutes={item.cleanup_avg_minutes} label="Cleanup" />
              <Chip
                tone="amber"
                label={`${stepCount(item)} steps`}
                size="sm"
              />
            </View>
          </View>
        </Card>
      );
    },
    [numColumns, favoriteIds, handleToggleFavorite],
  );

  const renderFavoriteItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => (
      <Card
        onPress={() => router.push(`/recipe/${item.id}`)}
        padding={0}
        shadow="card"
        style={styles.favoriteCard}
      >
        <HeroImage uri={item.image_url} height={100} rounded={Radius.lg} />
        <View style={styles.favoriteBody}>
          <Text style={styles.favoriteTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <TimeChip minutes={item.community_avg_minutes} label="Focused" />
        </View>
      </Card>
    ),
    [],
  );

  const showSkeletons = state === "loading" && recipes.length === 0;

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
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes"
            placeholderTextColor={Color.inkFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {state === "ready" && favoriteRecipes.length > 0 && (
        <View style={styles.favoritesSection}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader title="Cook again" />
          </View>
          <FlatList
            horizontal
            data={favoriteRecipes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderFavoriteItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesContent}
          />
        </View>
      )}

      {state === "ready" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <Pressable onPress={() => handleSelectFilter("all")}>
            <Chip label="All" tone={filter === "all" ? "accent" : "neutral"} />
          </Pressable>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => handleSelectFilter(category.id)}
            >
              <Chip
                label={category.label}
                tone={filter === category.id ? "accent" : "neutral"}
              />
            </Pressable>
          ))}
          <Pressable onPress={() => handleSelectFilter("quick")}>
            <Chip
              label="Under 30 min"
              tone={filter === "quick" ? "accent" : "neutral"}
            />
          </Pressable>
        </ScrollView>
      )}

      {showSkeletons && (
        <FlatList
          key={numColumns === 1 ? "skel-1col" : "skel-2col"}
          data={[0, 1, 2, 3]}
          keyExtractor={(item) => `skel-${item}`}
          numColumns={numColumns}
          renderItem={() => (
            <View
              style={
                numColumns > 1
                  ? [styles.cardColumn, { paddingHorizontal: 0 }]
                  : null
              }
            >
              <SkeletonCard hasImage />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={
            numColumns > 1
              ? { justifyContent: "flex-start", gap: columnGap }
              : undefined
          }
          ItemSeparatorComponent={() => <View style={{ height: columnGap }} />}
          scrollEnabled={false}
        />
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Text style={styles.emptyGlyph}>🍲</Text>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.muted}>
            {errorMessage ?? "Could not load recipes."}
          </Text>
          <Pressable style={styles.retry} onPress={loadFromCache}>
            <Text style={styles.retryText}>Retry</Text>
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
          ItemSeparatorComponent={() => <View style={{ height: columnGap }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>🍳</Text>
              {hasActiveFilters ? (
                <>
                  <Text style={styles.muted}>
                    No recipes match — try another filter.
                  </Text>
                  <Text style={styles.emptyCount}>
                    {visibleRecipes.length} of {recipes.length} recipes
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>No recipes available yet.</Text>
              )}
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
    backgroundColor: Color.canvas,
  },
  header: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: Space.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  heading: {
    ...Type.h1,
    color: Color.ink,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Color.surfaceSoft,
    borderWidth: 1,
    borderColor: Color.hairline,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
  },
  searchGlyph: {
    fontSize: 16,
    color: Color.inkFaint,
    marginRight: Space.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Space.md,
    fontSize: Type.body.fontSize,
    color: Color.ink,
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xxl,
  },
  card: {
    marginBottom: 0,
  },
  cardColumn: {
    flex: 1,
  },
  cardBody: {
    padding: Space.lg,
    gap: Space.sm,
  },
  cardTitle: {
    ...Type.title,
    color: Color.ink,
  },
  cardChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.xs,
  },
  heartButton: {
    position: "absolute",
    top: Space.sm,
    right: Space.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heartGlyph: {
    fontSize: 16,
    lineHeight: 18,
    color: Color.surface,
  },
  favoritesSection: {
    marginBottom: Space.md,
  },
  sectionHeaderPad: {
    paddingHorizontal: Space.lg,
  },
  favoritesContent: {
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  favoriteCard: {
    width: 150,
  },
  favoriteBody: {
    padding: Space.sm,
    gap: Space.xs,
  },
  favoriteTitle: {
    ...Type.bodySm,
    fontWeight: "600",
    color: Color.ink,
  },
  filterRow: {
    flexShrink: 0,
    marginBottom: Space.sm,
  },
  filterContent: {
    paddingHorizontal: Space.lg,
    gap: Space.sm,
    alignItems: "center",
  },
  emptyCount: {
    ...Type.caption,
    color: Color.inkFaint,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.xxl,
    gap: Space.sm,
  },
  emptyGlyph: {
    fontSize: 40,
    marginBottom: Space.xs,
  },
  muted: {
    ...Type.body,
    color: Color.inkSecondary,
    textAlign: "center",
  },
  errorTitle: {
    ...Type.h3,
    color: Color.danger,
  },
  retry: {
    marginTop: Space.sm,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Color.accent,
  },
  retryText: {
    color: Color.surface,
    fontWeight: "700",
  },
});
