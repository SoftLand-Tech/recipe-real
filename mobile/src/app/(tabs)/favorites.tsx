import { useCallback, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { track } from "@/analytics";
import { getFavoriteIds, getFavoriteRecipes, toggleFavorite } from "@/db/database";
import type { Recipe } from "@/types";
import { useLocalizedRecipe, useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Button,
  Card,
  Chip,
  HeroImage,
  HeartButton,
  ScreenHeader,
  SkeletonCard,
  TimeChip,
} from "@/components/ui";

type LoadState = "loading" | "ready" | "error";

/** Skeleton cards shown while the very first load runs. */
const SKELETON_COUNT = 3;

/**
 * Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
 * whatever happens (force-cleared by a setTimeout guard). The load itself is
 * purely local SQLite, so this is just belt-and-braces.
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

/**
 * The Favorites tab: all locally favorited recipes as a card grid. Data is
 * re-loaded from SQLite on mount AND on every focus, so un-hearting a recipe
 * on the detail screen is reflected here immediately (no snapshot-on-mount
 * staleness). All colors resolve per scheme via useThemeColors().
 */
export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const t = useT();
  const lr = useLocalizedRecipe();

  // Tablet (width >= 768): two columns. Phones: one column. (Matches browse.)
  const numColumns = width >= 768 ? 2 : 1;

  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  // Only the very first load shows skeletons; focus refreshes are silent
  // (stale-while-revalidate) so returning from a recipe never flashes.
  const firstLoadRef = useRef(true);
  // "favorites_viewed" is tracked once per mount, not on every focus.
  const viewedTrackedRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          flexGrow: 1,
          paddingHorizontal: Space.lg,
          gap: Space.lg,
          paddingBottom: insets.bottom + Space.xxl,
        },
        list: {
          gap: Space.lg,
        },
        row: {
          flexDirection: "row",
          gap: Space.lg,
        },
        // Grid cell wrapper (a plain View, never the Pressable card itself) —
        // the card stretches to fill it on both phone and tablet layouts.
        gridCell: {
          flex: 1,
        },
        cardBody: {
          padding: Space.lg,
          gap: Space.sm,
        },
        cardTitle: {
          ...Type.title,
          color: colors.ink,
        },
        cardChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingHorizontal: Space.xxl,
          paddingVertical: 64,
        },
        emptyGlyph: {
          fontSize: 40,
          color: colors.inkFaint,
        },
        emptyTitle: {
          ...Type.h3,
          color: colors.ink,
        },
        emptyCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        cta: {
          marginTop: Space.sm,
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
      }),
    [colors, insets.bottom],
  );

  // Reload the favorites list + the id set from SQLite. Purely local, so this
  // works offline. Runs on mount AND on every focus so the list never goes
  // stale after un-hearting a recipe on the detail screen.
  const load = useCallback(async () => {
    if (firstLoadRef.current) setState("loading");
    try {
      const [recipes, ids] = await Promise.all([
        getFavoriteRecipes(),
        getFavoriteIds(),
      ]);
      setFavorites(recipes);
      setFavoriteIds(new Set(ids));
      setState("ready");
      // Fire-and-forget analytics: favorites rendered with data, once.
      if (recipes.length > 0 && !viewedTrackedRef.current) {
        viewedTrackedRef.current = true;
        track("favorites_viewed");
      }
    } catch (error) {
      console.warn("[RecipeReal] favorites load failed:", error);
      if (firstLoadRef.current) setState("error");
    } finally {
      firstLoadRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Global safety: the spinner never outlives ~10s.
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    try {
      // Purely local SQLite reads — already fast.
      await load();
    } finally {
      clearTimeout(guard);
      setRefreshing(false);
    }
  }, [load]);

  // Un-hearting removes the card from this list: drop it optimistically,
  // persist via toggleFavorite, then re-sync the id set with the DB.
  const handleToggleFavorite = useCallback(async (id: number) => {
    setFavorites((prev) => prev.filter((r) => r.id !== id));
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      const favorited = await toggleFavorite(id);
      track("favorite_toggled", { recipe_id: id, favorited });
    } catch (error) {
      console.warn("[RecipeReal] toggle favorite failed:", error);
    }
    try {
      setFavoriteIds(new Set(await getFavoriteIds()));
    } catch (error) {
      console.warn("[RecipeReal] refreshing favorite ids failed:", error);
    }
  }, []);

  const stepCount = (item: Recipe) =>
    item.recipe_steps?.length ?? item.steps?.length ?? 0;

  // Chunk the favorites into grid rows (1 column on phones, 2 on tablets).
  const rows = useMemo(() => {
    const out: Recipe[][] = [];
    for (let i = 0; i < favorites.length; i += numColumns) {
      out.push(favorites.slice(i, i + numColumns));
    }
    return out;
  }, [favorites, numColumns]);

  const skeletonRows = useMemo(() => {
    const indexes = Array.from({ length: SKELETON_COUNT }, (_, i) => i);
    const out: number[][] = [];
    for (let i = 0; i < indexes.length; i += numColumns) {
      out.push(indexes.slice(i, i + numColumns));
    }
    return out;
  }, [numColumns]);

  const renderCard = (item: Recipe) => {
    const favorited = favoriteIds.has(item.id);
    return (
      <View key={item.id} style={styles.gridCell}>
        <Card
          onPress={() => router.push(`/recipe/${item.id}`)}
          padding={0}
          shadow="card"
        >
          <View>
            <HeroImage uri={item.image_url} height={150} rounded={Radius.lg} />
            <HeartButton
              favorited={favorited}
              onPress={() => handleToggleFavorite(item.id)}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {lr.title(item)}
            </Text>
            <View style={styles.cardChips}>
              <TimeChip
                minutes={item.community_avg_minutes}
                label={t("common.focused")}
              />
              <TimeChip
                minutes={item.cleanup_avg_minutes}
                label={t("common.cleanup")}
              />
              <Chip
                tone="amber"
                label={t("common.stepCount", { n: stepCount(item) })}
                size="sm"
              />
            </View>
          </View>
        </Card>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <ScreenHeader
        title={t("tabs.favorites")}
        subtitle={t("favorites.subtitle")}
      />

      {state === "loading" ? (
        <View
          style={styles.list}
          key={numColumns === 1 ? "skel-1col" : "skel-2col"}
        >
          {skeletonRows.map((row, rowIndex) => (
            <View key={`skel-row-${rowIndex}`} style={styles.row}>
              {row.map((i) => (
                <View key={`skel-${i}`} style={styles.gridCell}>
                  <SkeletonCard hasImage />
                </View>
              ))}
              {row.length < numColumns ? (
                <View style={styles.gridCell} />
              ) : null}
            </View>
          ))}
        </View>
      ) : state === "error" ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.muted}>{t("favorites.couldNotLoad")}</Text>
          <Button title={t("common.retry")} onPress={load} style={styles.cta} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyGlyph}>♡</Text>
          <Text style={styles.emptyTitle}>{t("favorites.emptyTitle")}</Text>
          <Text style={styles.emptyCaption}>
            {t("favorites.emptyCaption")}
          </Text>
          <Button
            title={t("favorites.browseRecipes")}
            variant="primary"
            onPress={() => router.push("/browse")}
            style={styles.cta}
          />
        </View>
      ) : (
        <View
          style={styles.list}
          key={numColumns === 1 ? "fav-1col" : "fav-2col"}
        >
          {rows.map((row) => (
            <View key={`row-${row[0].id}`} style={styles.row}>
              {row.map(renderCard)}
              {row.length < numColumns ? <View style={styles.gridCell} /> : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
