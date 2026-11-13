import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  PinnedHeaderBar,
  ScreenCaption,
  useChromeContentBottomPad,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";

import { track } from "@/analytics";
import {
  getFavoriteIds,
  getFavoriteRecipes,
  getNotedRecipes,
  toggleFavorite,
} from "@/db/database";
import type { Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT, type Lang } from "@/i18n";
import { Radius, Space, Type, useThemeColors, type ThemeColors } from "@/theme";
import { bestMinutes } from "@/utils/recipeTime";
import {
  Button,
  Card,
  Chip,
  HeroImage,
  HeartButton,
  IconPressable,
  NoteBadge,
  ScreenFlatList,
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

const EMPTY_RECIPES: Recipe[] = [];
const FLEX_ONE_STYLE = { flex: 1 } as const;
const recipeKeyExtractor = (item: Recipe) => String(item.id);
const noteKeyExtractor = (item: NotedRecipe) => String(item.recipe.id);

function setMatchesIds(prev: Set<number>, ids: number[]): boolean {
  if (prev.size !== ids.length) return false;
  for (let i = 0; i < ids.length; i++) {
    if (!prev.has(ids[i])) return false;
  }
  return true;
}

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    content: {
      flexGrow: 1,
      gap: Space.lg,
      // Bottom inset handled on the outer container (pinned-header
      // structure) — only list breathing room here.
      paddingBottom: Space.xxl,
    },
    pinnedBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
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
      // Inside the padded list — the screen gutter supplies the inset.
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
    showAllButton: {
      alignSelf: "flex-start",
      marginTop: Space.xs,
    },
  });
}

type FavoritesStyles = ReturnType<typeof createStyles>;

interface FavoriteCardProps {
  item: Recipe;
  favorited: boolean;
  hasNote: boolean;
  onOpen: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  styles: FavoritesStyles;
  maxCellWidth?: number;
}

const FavoriteCard = memo(function FavoriteCard({
  item,
  favorited,
  hasNote,
  onOpen,
  onToggleFavorite,
  styles,
  maxCellWidth,
}: FavoriteCardProps) {
  const t = useT();
  const lr = useLocalizedRecipe();
  const stepsCount = item.recipe_steps?.length ?? item.steps?.length ?? 0;

  const handlePress = useCallback(() => {
    onOpen(item.id);
  }, [onOpen, item.id]);

  const handleHeartPress = useCallback(() => {
    onToggleFavorite(item.id);
  }, [onToggleFavorite, item.id]);

  return (
    <View
      style={[
        styles.gridCell,
        maxCellWidth != null ? { maxWidth: maxCellWidth } : null,
      ]}
    >
      <Card onPress={handlePress} padding={0} shadow="card">
        <View>
          <HeroImage uri={item.image_url} height={150} rounded={Radius.lg} />
          <HeartButton favorited={favorited} onPress={handleHeartPress} />
          <NoteBadge show={hasNote} />
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
              label={t("common.stepCount", { n: stepsCount })}
              size="sm"
            />
          </View>
        </View>
      </Card>
    </View>
  );
});

interface NoteCardProps {
  item: NotedRecipe;
  lang: Lang;
  onOpen: (id: number) => void;
  styles: FavoritesStyles;
}

const NoteCard = memo(function NoteCard({
  item,
  lang,
  onOpen,
  styles,
}: NoteCardProps) {
  const lr = useLocalizedRecipe();
  const handlePress = useCallback(() => {
    onOpen(item.recipe.id);
  }, [onOpen, item.recipe.id]);

  return (
    <Card padding={Space.md} onPress={handlePress}>
      <View style={styles.noteRow}>
        <View style={styles.noteMain}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {lr.title(item.recipe)}
          </Text>
          <Text style={styles.noteSnippet} numberOfLines={2}>
            {item.note}
          </Text>
        </View>
        <Text style={styles.noteDate}>
          {formatNoteDate(lang, item.updatedAt)}
        </Text>
      </View>
    </Card>
  );
});

/**
 * The Favorites tab: all locally favorited recipes as a card grid. Data is
 * re-loaded from SQLite on mount AND on every focus, so un-hearting a recipe
 * on the detail screen is reflected here immediately (no snapshot-on-mount
 * staleness). All colors resolve per scheme via useThemeColors().
 */
export default function FavoritesScreen() {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const t = useT();
  const headerRights = useHeaderActionsRights();
  const { lang } = useLang();
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const barPad = usePinnedBarPad();

  // Tablet (width >= 768): two columns. Phones: one column. (Matches browse.)
  const numColumns = width >= 768 ? 2 : 1;
  const maxCellWidth = numColumns > 1 ? (width - Space.lg) / numColumns : undefined;

  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  // Ids of recipes carrying a personal note (card badges) + the joined
  // recipe+note rows for the "Your notes" section.
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

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Reload the favorites list + the noted-recipe rows from SQLite and derive
  // both id sets directly (avoiding redundant SQLite queries). Purely local,
  // so this works offline. Runs on mount AND on every focus so the list never
  // goes stale after un-hearting a recipe or editing a note on the detail screen.
  const load = useCallback(async () => {
    if (firstLoadRef.current) setState("loading");
    try {
      const [recipes, noted] = await Promise.all([
        getFavoriteRecipes(),
        getNotedRecipes(),
      ]);
      const nextFavIds = recipes.map((r) => r.id);
      const nextNoteIds = noted.map((n) => n.recipe.id);
      setFavorites(recipes);
      setFavoriteIds((prev) =>
        setMatchesIds(prev, nextFavIds) ? prev : new Set(nextFavIds),
      );
      setNoteIds((prev) =>
        setMatchesIds(prev, nextNoteIds) ? prev : new Set(nextNoteIds),
      );
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

  const handleOpenRecipe = useCallback((id: number) => {
    router.push(`/recipe/${id}`);
  }, []);

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
      const ids = await getFavoriteIds();
      setFavoriteIds((prev) =>
        setMatchesIds(prev, ids) ? prev : new Set(ids),
      );
    } catch (error) {
      console.warn("[RecipeReal] refreshing favorite ids failed:", error);
    }
  }, []);

  const skeletonRows = useMemo(() => {
    const indexes = Array.from({ length: SKELETON_COUNT }, (_, i) => i);
    const out: number[][] = [];
    for (let i = 0; i < indexes.length; i += numColumns) {
      out.push(indexes.slice(i, i + numColumns));
    }
    return out;
  }, [numColumns]);

  const renderFavoriteItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => (
      <FavoriteCard
        item={item}
        favorited={favoriteIds.has(item.id)}
        hasNote={noteIds.has(item.id)}
        onOpen={handleOpenRecipe}
        onToggleFavorite={handleToggleFavorite}
        styles={styles}
        maxCellWidth={maxCellWidth}
      />
    ),
    [
      favoriteIds,
      noteIds,
      handleOpenRecipe,
      handleToggleFavorite,
      styles,
      maxCellWidth,
    ],
  );

  const renderNoteItem: ListRenderItem<NotedRecipe> = useCallback(
    ({ item }) => (
      <NoteCard
        item={item}
        lang={lang}
        onOpen={handleOpenRecipe}
        styles={styles}
      />
    ),
    [lang, handleOpenRecipe, styles],
  );

  const listHeader = useMemo(
    () => (
      <>
        <ScreenCaption text={t("favorites.subtitle")} />
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
      </>
    ),
    [
      t,
      state,
      styles.tabsRow,
      selectTab,
      favorites.length,
      tab,
      notedRecipes.length,
    ],
  );

  const listContentStyle = useMemo(
    () => [
      styles.content,
      { paddingTop: barPad, paddingBottom: chromeBottomPad },
    ],
    [styles.content, barPad, chromeBottomPad],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
        progressBackgroundColor={colors.surface}
      />
    ),
    [refreshing, handleRefresh, colors.accent, colors.surface],
  );

  const favoritesEmptyOrStatus = useMemo(() => {
    if (state === "loading") {
      return (
        <View style={styles.list}>
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
      );
    }
    if (state === "error") {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.muted}>{t("favorites.couldNotLoad")}</Text>
          <Button title={t("common.retry")} onPress={load} style={styles.cta} />
        </View>
      );
    }
    return (
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
    );
  }, [state, styles, skeletonRows, numColumns, t, load]);

  const notesEmpty = useMemo(
    () => (
      <View style={styles.center}>
        <Text style={styles.emptyGlyph}>📝</Text>
        <Text style={styles.muted}>{t("favorites.noNotes")}</Text>
      </View>
    ),
    [styles, t],
  );

  const notesFooter = useMemo(
    () =>
      notedRecipes.length > NOTES_PREVIEW_COUNT ? (
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
      ) : null,
    [notedRecipes.length, showAllNotes, t, styles.showAllButton],
  );

  return (
    <View style={styles.container}>
      {state === "ready" && tab === "notes" ? (
        <ScreenFlatList
          key="notes"
          data={visibleNotes}
          keyExtractor={noteKeyExtractor}
          renderItem={renderNoteItem}
          style={FLEX_ONE_STYLE}
          contentContainerStyle={listContentStyle}
          onScroll={chrome.onScroll}
          scrollEventThrottle={chrome.scrollEventThrottle}
          refreshControl={refreshControl}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={notesEmpty}
          ListFooterComponent={notesFooter}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
        />
      ) : (
        <ScreenFlatList
          key={numColumns}
          numColumns={numColumns}
          data={state === "ready" ? favorites : EMPTY_RECIPES}
          keyExtractor={recipeKeyExtractor}
          renderItem={renderFavoriteItem}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          style={FLEX_ONE_STYLE}
          contentContainerStyle={listContentStyle}
          onScroll={chrome.onScroll}
          scrollEventThrottle={chrome.scrollEventThrottle}
          refreshControl={refreshControl}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={favoritesEmptyOrStatus}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
        />
      )}
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("tabs.favorites")}
          hidden={chrome.hidden}
          rights={headerRights}
        />
      </View>
    </View>
  );
}
