import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { track } from "@/analytics";
import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipes,
  refreshCacheLight,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
} from "@/db/database";
import type { Recipe } from "@/types";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Card,
  Chip,
  HeroImage,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  TimeChip,
} from "@/components/ui";
import { CATEGORIES } from "@/utils/categorize";

type LoadState = "loading" | "ready" | "error";

/** Cards per curated rail. */
const RAIL_SIZE = 10;

/**
 * Rough "hands-off" score for a recipe: the summed community minutes of its
 * passive steps when steps are hydrated, else ~40% of the community average
 * (long-cooking recipes are mostly passive). `getCachedRecipes()` does not
 * hydrate recipe_steps, so in practice the fallback drives the ordering —
 * the step sum takes over automatically wherever steps are present.
 */
function passiveScore(recipe: Recipe): number {
  if (Array.isArray(recipe.recipe_steps) && recipe.recipe_steps.length > 0) {
    return recipe.recipe_steps.reduce(
      (sum, step) =>
        step.step_type === "passive" ? sum + (step.community_minutes ?? 0) : sum,
      0,
    );
  }
  return (recipe.community_avg_minutes ?? 0) * 0.4;
}

/**
 * Cheap content fingerprint of a recipe list. Background reloads from the
 * cache return fresh object identities even when nothing changed; comparing
 * fingerprints lets us keep the previous array (and its render identities).
 */
function recipesFingerprint(list: Recipe[]): string {
  return list
    .map(
    (r) =>
      `${r.id}:${r.title}:${r.community_avg_minutes}:${r.cleanup_avg_minutes}:${r.image_url}`,
  )
    .join("|");
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          paddingBottom: Space.xxl,
        },
        center: {
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Space.xxl,
          paddingVertical: Space.huge,
          gap: Space.sm,
        },
        emptyGlyph: {
          fontSize: 40,
          marginBottom: Space.xs,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        retry: {
          marginTop: Space.sm,
          paddingHorizontal: Space.xl,
          paddingVertical: Space.md,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        retryText: {
          color: colors.surface,
          fontWeight: "700",
        },
        skeletonCard: {
          width: 160,
        },
      }),
    [colors],
  );

  // ---- Curated rails (computed client-side over the cached recipes) --------

  // Deterministic daily rotation: the pseudo-random key shifts by one day at
  // a time, so the same library yields a different-but-stable top 10 per day.
  const topPicks = useMemo(() => {
    if (recipes.length === 0) return [];
    const todayIndex = Math.floor(Date.now() / 86_400_000);
    return [...recipes]
      .sort(
        (a, b) =>
          ((a.id * 31 + todayIndex) % recipes.length) -
          ((b.id * 31 + todayIndex) % recipes.length),
      )
      .slice(0, RAIL_SIZE);
  }, [recipes]);

  const easyWins = useMemo(
    () =>
      recipes
        .filter(
          (r) => r.community_avg_minutes != null && r.community_avg_minutes <= 30,
        )
        .sort(
          (a, b) => (a.community_avg_minutes ?? 0) - (b.community_avg_minutes ?? 0),
        )
        .slice(0, RAIL_SIZE),
    [recipes],
  );

  const handsOffHeroes = useMemo(
    () =>
      recipes
        .map((recipe) => ({ recipe, score: passiveScore(recipe) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, RAIL_SIZE)
        .map(({ recipe }) => recipe),
    [recipes],
  );

  const quickCleanup = useMemo(
    () =>
      recipes
        .filter((r) => r.cleanup_avg_minutes != null)
        .sort(
          (a, b) =>
            (a.cleanup_avg_minutes ?? 0) - (b.cleanup_avg_minutes ?? 0),
        )
        .slice(0, RAIL_SIZE),
    [recipes],
  );

  // ---- Cache load: same progressive skeleton as the Browse tab -------------

  // Identity-guarded setRecipes: when the reloaded list is content-identical
  // to what's on screen, return the previous array so React bails out — new
  // object identities would re-render every rail + card and re-fade images.
  const setRecipesIfChanged = useCallback((next: Recipe[]) => {
    setRecipes((prev) =>
      recipesFingerprint(prev) === recipesFingerprint(next) ? prev : next,
    );
  }, []);

  // Background continuation after a cold first-page seed: stream the remaining
  // seed pages into the cache, then reload. Non-blocking on purpose.
  const continueSeedInBackground = useCallback(async () => {
    try {
      await seedCacheRemainingPages();
      setRecipesIfChanged(await getCachedRecipes());
    } catch (error) {
      console.warn("[RecipeReal] home background seed continuation failed:", error);
    }
  }, [setRecipesIfChanged]);

  // Background refresh: light upsert (no step re-download) + reload from cache.
  const refreshInBackground = useCallback(async () => {
    try {
      await refreshCacheLight();
      setRecipesIfChanged(await getCachedRecipes());
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] home background refresh failed:", error);
    }
  }, [setRecipesIfChanged]);

  const loadFromCache = useCallback(async (): Promise<boolean> => {
    // Stale-while-revalidate: keep the current rails on screen during a
    // reload; skeletons are only for a true cold start (nothing to show).
    if (recipes.length === 0) setState("loading");
    setErrorMessage(null);
    try {
      const count = await countCachedRecipes();
      if (count === 0) {
        // Cold cache: seed just the first page so the rails render quickly;
        // the remaining pages arrive in the background.
        const first = await seedCacheFirstPage();
        setRecipes(first);
        setState("ready");
        continueSeedInBackground();
        return false;
      }
      setRecipesIfChanged(await getCachedRecipes());
      setState("ready");
      return true;
    } catch (error) {
      console.warn("[RecipeReal] home loadFromCache failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load recipes.",
      );
      setState("error");
      return false;
    }
  }, [continueSeedInBackground, recipes, setRecipesIfChanged]);

  useEffect(() => {
    track("home_viewed");
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
              setRecipesIfChanged(await getCachedRecipes());
            } else {
              await refreshInBackground();
            }
          })
          .catch((error) => {
            console.warn("[RecipeReal] home cache repair check failed:", error);
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

  // Category chips land in Browse ALREADY FILTERED: the `filter` param carries
  // the category id (e.g. "pasta", "quick") which Browse reads on mount.
  const handleCategoryPress = useCallback((id: string, label: string) => {
    track("home_category_tapped", { category: id, label });
    router.push({ pathname: "/browse", params: { filter: id } });
  }, []);

  const showSkeletons = state === "loading" && recipes.length === 0;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <ScreenHeader
          title="RecipeReal"
          subtitle="Honest cook times, verified by real cooks"
        />

        {showSkeletons && (
          <SkeletonRail />
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

        {state === "ready" && recipes.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.emptyGlyph}>🍳</Text>
            <Text style={styles.muted}>No recipes available yet.</Text>
            <Pressable style={styles.retry} onPress={loadFromCache}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {state === "ready" && recipes.length > 0 && (
          <>
            <HomeRail title="Top picks today" items={topPicks} />
            <HomeRail title="Easy wins" items={easyWins} />
            <HomeRail
              title="Hands-off heroes"
              subtitle="Mostly simmering, minimal stirring"
              items={handsOffHeroes}
            />
            <HomeRail title="Quick cleanup" items={quickCleanup} />
            <CategoryRail onCategoryPress={handleCategoryPress} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---- Local building blocks --------------------------------------------------

/**
 * "See all" header action for each rail: a quiet caption-toned pressable that
 * jumps to the Browse tab. Static style only (no function styles on
 * Pressables — see Android paint rules).
 */
function SeeAllAction() {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          paddingVertical: Space.xs,
          paddingLeft: Space.sm,
        },
        label: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "600",
        },
      }),
    [colors],
  );
  return (
    <Pressable
      onPress={() => router.push("/browse")}
      hitSlop={8}
      style={styles.pressable}
    >
      <Text style={styles.label}>See all</Text>
    </Pressable>
  );
}

/** Compact rail card: hero image, 2-line title, community time chip. */
function HomeCard({ item }: { item: Recipe }) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: 160,
        },
        body: {
          padding: Space.sm,
          gap: Space.xs,
        },
        title: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
        },
      }),
    [colors],
  );
  return (
    <Card
      onPress={() => router.push(`/recipe/${item.id}`)}
      padding={0}
      shadow="card"
      style={styles.card}
    >
      <HeroImage uri={item.image_url} height={110} rounded={Radius.lg} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <TimeChip minutes={item.community_avg_minutes} label="Focused" />
      </View>
    </Card>
  );
}

/** One curated rail: section header ("See all" → Browse) + horizontal cards. */
function HomeRail({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Recipe[];
}) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: Space.md,
        },
        sectionHeaderPad: {
          paddingHorizontal: Space.lg,
        },
        railContent: {
          paddingHorizontal: Space.lg,
          gap: Space.md,
        },
      }),
    [],
  );
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderPad}>
        <SectionHeader title={title} subtitle={subtitle} action={<SeeAllAction />} />
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <HomeCard item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      />
    </View>
  );
}

/** Category chips row — every craving is one tap away in Browse. */
function CategoryRail({
  onCategoryPress,
}: {
  onCategoryPress: (id: string, label: string) => void;
}) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: Space.md,
        },
        sectionHeaderPad: {
          paddingHorizontal: Space.lg,
        },
        railContent: {
          paddingHorizontal: Space.lg,
          gap: Space.sm,
          alignItems: "center",
        },
      }),
    [],
  );
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderPad}>
        <SectionHeader title="Browse by craving" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      >
        {CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => onCategoryPress(category.id, category.label)}
          >
            <Chip label={category.label} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Loading placeholder: four skeleton cards in a rail shape. */
function SkeletonRail() {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: Space.md,
        },
        sectionHeaderPad: {
          paddingHorizontal: Space.lg,
        },
        railContent: {
          paddingHorizontal: Space.lg,
          gap: Space.md,
        },
        card: {
          width: 160,
        },
      }),
    [],
  );
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderPad}>
        <SectionHeader title="Top picks today" />
      </View>
      <FlatList
        horizontal
        data={[0, 1, 2, 3]}
        keyExtractor={(item) => `skel-${item}`}
        renderItem={() => (
          <View style={styles.card}>
            <SkeletonCard hasImage />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        scrollEnabled={false}
      />
    </View>
  );
}
