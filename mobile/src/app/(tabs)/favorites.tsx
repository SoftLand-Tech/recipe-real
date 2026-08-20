import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useChromeContentBottomPad, useScrollChrome } from "@/components/chrome";

import { track } from "@/analytics";
import {
  getFavoriteIds,
  getFavoriteRecipes,
  getNotedRecipeIds,
  getNotedRecipes,
  toggleFavorite,
} from "@/db/database";
import type { Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT, type Lang } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { bestMinutes } from "@/utils/recipeTime";
import {
  Button,
  Card,
  Chip,
  HeroImage,
  HeartButton,
  IconPressable,
  NoteBadge,
  ScreenHeader,
  SkeletonCard,
  TimeChip,
  useHeaderActionsRights,
} from "@/components/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LoadState = "loading" | "ready" | "error";

/** Which of the two peer lists the screen shows. */
type FavoritesTab = "favorites" | "notes";

/** Persists the last-selected tab so the screen reopens where you left it. */
const FAVORITES_TAB_KEY = "recipereal.favoritesTab";

/** A recipe joined with its personal note (newest note first). */
type NotedRecipe = { recipe: Recipe; note: string; updatedAt: number };

/** Skeleton cards shown while the very first load runs. */
const SKELETON_COUNT = 3;

/** Note rows visible before the "Show all notes" toggle expands the list. */
const NOTES_PREVIEW_COUNT = 10;

/**
 * Compact note date, e.g. "Aug 16" — short month + day, resolved for the
 * in-app language. Text-only (no directional glyphs), so it is RTL-safe.
 */
function formatNoteDate(lang: Lang, updatedAt: number): string {
  return new Date(updatedAt).toLocaleDateString(
    lang === "ar" ? "ar" : "en-US",
    { month: "short", day: "numeric" },
  );
}

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
  const headerRights = useHeaderActionsRights();
  const lr = useLocalizedRecipe();
  const { lang } = useLang();
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const [headerHeight, setHeaderHeight] = useState(0);

  // Tablet (width >= 768): two columns. Phones: one column. (Matches browse.)
  const numColumns = width >= 768 ? 2 : 1;

  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  // Ids of recipes carrying a personal note (card badges) + the joined
  // recipe+note rows for the "Your notes" section below the grid.
  const [noteIds, setNoteIds] = useState<Set<number>>(new Set());
  const [notedRecipes, setNotedRecipes] = useState<NotedRecipe[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);

  // Favorites/Notes peer tabs — notes live one tap away instead of an
  // endless scroll below the grid (or vice versa).
  const [tab, setTab] = useState<FavoritesTab>("favorites");
  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_TAB_KEY)
      .then((saved) => {
        if (saved === "notes") setTab("notes");
      })
      .catch(() => {
        // Best-effort restore.
      });
  }, []);
  const selectTab = useCallback((next: FavoritesTab) => {
    setTab(next);
    AsyncStorage.setItem(FAVORITES_TAB_KEY, next).catch(() => {
      // Best-effort persist.
    });
  }, []);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  // Only the very first load shows skeletons; focus refreshes are silent
  // (stale-while-revalidate) so returning from a recipe never flashes.
  const firstLoadRef = useRef(true);
  // "favorites_viewed" is tracked once per mount, not on every focus.
  const viewedTrackedRef = useRef(false);
  // "notes_list_viewed" likewise: once per mount, when the section has data.
  const notesViewedRef = useRef(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        scroll: {
          flex: 1,
        },
        content: {
          flexGrow: 1,
          paddingHorizontal: 0,
          gap: Space.lg,
          // Bottom inset handled on the outer container (pinned-header
          // structure) — only list breathing room here.
          paddingBottom: Space.xxl,
        },
        chromeHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: colors.canvas,
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
        tabsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
          marginBottom: Space.md,
        },
        notesSection: {
          gap: Space.md,
        },
        notesList: {
          gap: Space.md,
        },
        noteRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        noteMain: {
          flex: 1,
          gap: 2,
        },
        noteTitle: {
          ...Type.title,
          color: colors.ink,
        },
        noteSnippet: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        noteDate: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        notesEmpty: {
          ...Type.caption,
          color: colors.inkSecondary,
        },
        showAllButton: {
          alignSelf: "flex-start",
          marginTop: Space.xs,
        },
      }),
    [colors, insets.bottom],
  );

  // Reload the favorites list + the id set from SQLite, plus the noted-recipe
  // data (badge id set + the "Your notes" rows). Purely local, so this works
  // offline. Runs on mount AND on every focus so the list never goes stale
  // after un-hearting a recipe or editing a note on the detail screen.
  const load = useCallback(async () => {
    if (firstLoadRef.current) setState("loading");
    try {
      const [recipes, ids, noteIdList, noted] = await Promise.all([
        getFavoriteRecipes(),
        getFavoriteIds(),
        getNotedRecipeIds(),
        getNotedRecipes(),
      ]);
      setFavorites(recipes);
      setFavoriteIds(new Set(ids));
      setNoteIds(new Set(noteIdList));
      setNotedRecipes(noted);
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

  // Fire-and-forget analytics: the notes section rendered with data. Tracked
  // once per mount, not on silent refocus refreshes (pace history pattern).
  useEffect(() => {
    if (notedRecipes.length > 0 && !notesViewedRef.current) {
      notesViewedRef.current = true;
      track("notes_list_viewed");
    }
  }, [notedRecipes.length]);

  // Note rows visible under the current "Show all notes" toggle.
  const visibleNotes = useMemo(
    () =>
      showAllNotes ? notedRecipes : notedRecipes.slice(0, NOTES_PREVIEW_COUNT),
    [showAllNotes, notedRecipes],
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
            <NoteBadge show={noteIds.has(item.id)} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {lr.title(item)}
            </Text>
            <View style={styles.cardChips}>
              <TimeChip
                minutes={bestMinutes(item)}
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight, paddingBottom: chromeBottomPad },
        ]}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
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
      {/* Peer tabs: the two lists never bury each other in one scroll. */}
      {state === "ready" ? (
        <View style={styles.tabsRow}>
          <IconPressable
            onPress={() => selectTab("favorites")}
            accessibilityRole="button"
          >
            <Chip
              label={`${t("tabs.favorites")} · ${favorites.length}`}
              tone={tab === "favorites" ? "accent" : "neutral"}
            />
          </IconPressable>
          <IconPressable
            onPress={() => selectTab("notes")}
            accessibilityRole="button"
          >
            <Chip
              label={`${t("favorites.tabNotes")} · ${notedRecipes.length}`}
              tone={tab === "notes" ? "accent" : "neutral"}
            />
          </IconPressable>
        </View>
      ) : null}

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
      ) : tab === "notes" ? (
        /* Notes tab: the note list as its own top-level list. */
        <View style={styles.notesSection}>
          {notedRecipes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>📝</Text>
              <Text style={styles.muted}>{t("favorites.noNotes")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.notesList}>
                {visibleNotes.map(({ recipe, note, updatedAt }) => (
                  <Card
                    key={recipe.id}
                    padding={Space.md}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    <View style={styles.noteRow}>
                      <View style={styles.noteMain}>
                        <Text style={styles.noteTitle} numberOfLines={1}>
                          {lr.title(recipe)}
                        </Text>
                        <Text style={styles.noteSnippet} numberOfLines={2}>
                          {note}
                        </Text>
                      </View>
                      <Text style={styles.noteDate}>
                        {formatNoteDate(lang, updatedAt)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
              {notedRecipes.length > NOTES_PREVIEW_COUNT ? (
                <Button
                  title={
                    showAllNotes
                      ? t("favorites.showFewNotes")
                      : t("favorites.showAllNotes")
                  }
                  variant="ghost"
                  onPress={() => setShowAllNotes((v) => !v)}
                  style={styles.showAllButton}
                />
              ) : null}
            </>
          )}
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
      <Animated.View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[
          styles.chromeHeader,
          {
            transform: [
              {
                translateY: chrome.hidden.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -headerHeight],
                }),
              },
            ],
          },
        ]}
      >
        <ScreenHeader
          title={t("tabs.favorites")}
          subtitle={t("favorites.subtitle")}
          rights={headerRights}
        />
      </Animated.View>
    </View>
  );
}
