import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

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
import {
  Radius,
  Space,
  Type,
  useThemeColors,
  type ThemeColors,
} from "@/theme";
import {
  Button,
  Card,
  Chip,
  HeroImage,
  HeartButton,
  IconPressable,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  TimeChip,
} from "@/components/ui";
import {
  CATEGORIES,
  categorizeTitle,
  type CategoryId,
} from "@/utils/categorize";

// LayoutAnimation needs an explicit opt-in on Android (no-op elsewhere).
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type LoadState = "loading" | "ready" | "error";

/** Active list filter: a category, the "quick" time filter, or none. */
type ListFilter = "all" | CategoryId | "quick";

/** Advanced sort options (applied after all filters). */
type SortMode = "default" | "fastest" | "cleanup";

/** Total-time cap options (community_avg_minutes; null = Any). */
const TIME_FILTERS = [
  { max: null, label: "Any" },
  { max: 15, label: "≤ 15 min" },
  { max: 30, label: "≤ 30 min" },
  { max: 45, label: "≤ 45 min" },
  { max: 60, label: "≤ 60 min" },
] as const;

/** Cleanup cap options (cleanup_avg_minutes; null = Any). */
const CLEANUP_FILTERS = [
  { max: null, label: "Any" },
  { max: 15, label: "Low (≤ 15 min)" },
  { max: 10, label: "Very low (≤ 10 min)" },
] as const;

const SORT_MODES = [
  { mode: "default", label: "Default" },
  { mode: "fastest", label: "Fastest" },
  { mode: "cleanup", label: "Least cleanup" },
] as const;

/**
 * Parse the `filter` param other screens may pass (contract with Home's
 * craving shortcuts): a CATEGORIES id or "quick". Anything else is ignored.
 */
function parseParamFilter(value: string | undefined): ListFilter | null {
  if (!value) return null;
  if (value === "quick") return "quick";
  return CATEGORIES.some((c) => c.id === value) ? (value as CategoryId) : null;
}

/** Sort ascending with nulls last (missing timings sink instead of floating). */
function sortAscNullsLast<T>(
  list: readonly T[],
  key: (item: T) => number | null,
): T[] {
  return list.slice().sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka == null && kb == null) return 0;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka - kb;
  });
}

/**
 * The full filter pipeline: search → category/quick → total time → cleanup,
 * then sort. "Default" keeps the source order, which is already title-ASC
 * (getCachedRecipes orders by title COLLATE NOCASE ASC).
 */
function computeVisibleRecipes(
  source: Recipe[],
  search: string,
  filter: ListFilter,
  timeMax: number | null,
  cleanupMax: number | null,
  sortMode: SortMode,
): Recipe[] {
  const q = search.trim().toLowerCase();
  let out = source;
  if (q) {
    out = out.filter((r) => r.title.toLowerCase().includes(q));
  }
  if (filter === "quick") {
    out = out.filter(
      (r) => r.community_avg_minutes != null && r.community_avg_minutes <= 30,
    );
  } else if (filter !== "all") {
    out = out.filter((r) => categorizeTitle(r.title) === filter);
  }
  if (timeMax != null) {
    out = out.filter(
      (r) =>
        r.community_avg_minutes != null && r.community_avg_minutes <= timeMax,
    );
  }
  if (cleanupMax != null) {
    out = out.filter(
      (r) =>
        r.cleanup_avg_minutes != null && r.cleanup_avg_minutes <= cleanupMax,
    );
  }
  if (sortMode === "fastest") {
    return sortAscNullsLast(out, (r) => r.community_avg_minutes);
  }
  if (sortMode === "cleanup") {
    return sortAscNullsLast(out, (r) => r.cleanup_avg_minutes);
  }
  return out;
}

/** Number of steps attached to a recipe (joined rows, else embedded). */
function stepCount(item: Recipe): number {
  return item.recipe_steps?.length ?? item.steps?.length ?? 0;
}

/**
 * Theme-scoped styles for the browse screen and its subcomponents. Created
 * once per palette (useMemo in the screen), so passing the same object as a
 * prop keeps the memoized children stable across unrelated re-renders.
 */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    searchSection: {
      paddingHorizontal: Space.lg,
      paddingBottom: Space.md,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.sm,
    },
    // Square-ish pill button beside the search field; matches the search
    // wrap's surface (static style, fixed size — Android paint rules).
    filterToggle: {
      width: 44,
      height: 44,
      borderRadius: Radius.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.hairline,
      alignItems: "center",
      justifyContent: "center",
    },
    searchWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.hairline,
      borderRadius: Radius.pill,
      paddingHorizontal: Space.md,
    },
    searchGlyph: {
      fontSize: 16,
      color: colors.inkFaint,
      marginRight: Space.xs,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Space.md,
      fontSize: Type.body.fontSize,
      color: colors.ink,
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
      color: colors.ink,
    },
    cardChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Space.xs,
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
      color: colors.ink,
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
    filterPanel: {
      marginHorizontal: Space.lg,
      marginBottom: Space.sm,
      padding: Space.md,
      gap: Space.md,
    },
    panelGroup: {
      gap: Space.xs,
    },
    panelLabel: {
      ...Type.bodySm,
      fontWeight: "700",
      color: colors.inkSecondary,
    },
    panelChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Space.xs,
    },
    clearAll: {
      alignSelf: "flex-start",
    },
    emptyCount: {
      ...Type.caption,
      color: colors.inkFaint,
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
  });
}

type BrowseStyles = ReturnType<typeof createStyles>;

/**
 * Search input + filter toggle. Memoized so it re-renders only when the
 * search text or the toggle/active-filter state changes — the rest of the
 * screen (chips, favorites, list) is skipped while typing or toggling.
 */
interface SearchBarProps {
  search: string;
  onChangeSearch: (text: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasAdvancedFilters: boolean;
  colors: ThemeColors;
  styles: BrowseStyles;
}

const SearchBar = memo(function SearchBar({
  search,
  onChangeSearch,
  showFilters,
  onToggleFilters,
  hasAdvancedFilters,
  colors,
  styles,
}: SearchBarProps) {
  return (
    <View style={styles.searchSection}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes"
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={onChangeSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        {/* Filter toggle beside the search bar — the common pattern. */}
        <IconPressable
          onPress={onToggleFilters}
          accessibilityLabel="Toggle filters"
          style={styles.filterToggle}
        >
          <Ionicons
            name="options"
            size={20}
            color={
              showFilters || hasAdvancedFilters
                ? colors.accent
                : colors.inkSecondary
            }
          />
        </IconPressable>
      </View>
    </View>
  );
});

/**
 * "Cook again" horizontal favorites rail. Memoized: `favoriteRecipes` keeps a
 * stable identity between unrelated state changes (it is only replaced by
 * reloadFavorites), so the rail is skipped while e.g. the filter panel
 * toggles.
 */
interface FavoritesRailProps {
  favoriteRecipes: Recipe[];
  onOpen: (id: number) => void;
  styles: BrowseStyles;
}

const FavoritesRail = memo(function FavoritesRail({
  favoriteRecipes,
  onOpen,
  styles,
}: FavoritesRailProps) {
  const renderItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => (
      <Card
        onPress={() => onOpen(item.id)}
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
    [onOpen, styles],
  );

  return (
    <View style={styles.favoritesSection}>
      <View style={styles.sectionHeaderPad}>
        <SectionHeader title="Cook again" />
      </View>
      <FlatList
        horizontal
        data={favoriteRecipes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.favoritesContent}
      />
    </View>
  );
});

/**
 * Horizontal category/quick-filter chip row. Memoized: it re-renders only
 * when `filter` changes, which is exactly when the chip tones must update.
 */
interface ChipRowProps {
  filter: ListFilter;
  onSelect: (filter: ListFilter) => void;
  styles: BrowseStyles;
}

const ChipRow = memo(function ChipRow({
  filter,
  onSelect,
  styles,
}: ChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterRow}
      contentContainerStyle={styles.filterContent}
    >
      <IconPressable onPress={() => onSelect("all")}>
        <Chip label="All" tone={filter === "all" ? "accent" : "neutral"} />
      </IconPressable>
      {CATEGORIES.map((category) => (
        <IconPressable
          key={category.id}
          onPress={() => onSelect(category.id)}
        >
          <Chip
            label={category.label}
            tone={filter === category.id ? "accent" : "neutral"}
          />
        </IconPressable>
      ))}
      <IconPressable onPress={() => onSelect("quick")}>
        <Chip
          label="Under 30 min"
          tone={filter === "quick" ? "accent" : "neutral"}
        />
      </IconPressable>
    </ScrollView>
  );
});

/**
 * The advanced-filters card (total time / cleanup / sort + clear all).
 * Memoized: the setters are stable state setters, so it re-renders only when
 * its own filter values change — never for list churn or panel toggling.
 */
interface FilterPanelProps {
  timeMax: number | null;
  onTimeMaxChange: (max: number | null) => void;
  cleanupMax: number | null;
  onCleanupMaxChange: (max: number | null) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  onClearAll: () => void;
  styles: BrowseStyles;
}

const FilterPanel = memo(function FilterPanel({
  timeMax,
  onTimeMaxChange,
  cleanupMax,
  onCleanupMaxChange,
  sortMode,
  onSortModeChange,
  onClearAll,
  styles,
}: FilterPanelProps) {
  return (
    <Card style={styles.filterPanel}>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>Total time</Text>
        <View style={styles.panelChips}>
          {TIME_FILTERS.map((option) => (
            <IconPressable
              key={option.label}
              onPress={() => onTimeMaxChange(option.max)}
            >
              <Chip
                label={option.label}
                size="sm"
                tone={timeMax === option.max ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>Cleanup</Text>
        <View style={styles.panelChips}>
          {CLEANUP_FILTERS.map((option) => (
            <IconPressable
              key={option.label}
              onPress={() => onCleanupMaxChange(option.max)}
            >
              <Chip
                label={option.label}
                size="sm"
                tone={cleanupMax === option.max ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>Sort</Text>
        <View style={styles.panelChips}>
          {SORT_MODES.map((option) => (
            <IconPressable
              key={option.mode}
              onPress={() => onSortModeChange(option.mode)}
            >
              <Chip
                label={option.label}
                size="sm"
                tone={sortMode === option.mode ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      <Button
        title="Clear all"
        variant="ghost"
        onPress={onClearAll}
        style={styles.clearAll}
      />
    </Card>
  );
});

/**
 * The main list card. Memoized so that when VirtualizedList re-renders its
 * cells (e.g. the panel toggle re-rendering the screen), each card bails out
 * on shallow-equal props: stable `item`, boolean heart state, and stable
 * callbacks.
 */
interface RecipeCardProps {
  item: Recipe;
  favorited: boolean;
  onOpen: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  numColumns: number;
  styles: BrowseStyles;
}

const RecipeCard = memo(function RecipeCard({
  item,
  favorited,
  onOpen,
  onToggleFavorite,
  numColumns,
  styles,
}: RecipeCardProps) {
  return (
    <Card
      onPress={() => onOpen(item.id)}
      padding={0}
      shadow="card"
      style={numColumns > 1 ? styles.cardColumn : styles.card}
    >
      <View>
        <HeroImage uri={item.image_url} height={150} rounded={Radius.lg} />
        <HeartButton
          favorited={favorited}
          onPress={() => onToggleFavorite(item.id)}
        />
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
});

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = params.filter;

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

  // Advanced filters (the "Filters" panel).
  const [showFilters, setShowFilters] = useState(false);
  const [timeMax, setTimeMax] = useState<number | null>(null);
  const [cleanupMax, setCleanupMax] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Deferred-apply pipeline state: chip taps update the chip + show the
  // skeleton immediately, the recomputed list lands a tick later.
  const [visibleRecipes, setVisibleRecipes] = useState<Recipe[]>([]);
  // Start in applying state: until the first deferred computation lands, the
  // skeleton shows instead of a one-frame "No recipes available yet" flash.
  const [applying, setApplying] = useState(true);

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Hoisted so both FlatLists see a stable component type: an inline arrow in
  // ItemSeparatorComponent creates a NEW component type every render, which
  // remounts every separator on every keystroke.
  const Separator = useCallback(
    () => <View style={{ height: columnGap }} />,
    [columnGap],
  );

  /**
   * Identity-guarded recipes setter: background refreshes routinely return
   * identical rows with fresh array identities, which would re-render (and
   * re-run the filter pipeline over) the whole list for nothing. Fingerprint
   * by id:title:community_avg and skip the setState when nothing changed.
   */
  const recipesFingerprintRef = useRef("");
  const applyRecipes = useCallback((next: Recipe[]) => {
    const fingerprint = next
      .map(
      (r) =>
        `${r.id}:${r.title}:${r.community_avg_minutes}:${r.cleanup_avg_minutes}:${r.image_url}`,
    )
      .join("|");
    if (fingerprint === recipesFingerprintRef.current) return;
    recipesFingerprintRef.current = fingerprint;
    setRecipes(next);
  }, []);

  // Background continuation after a cold first-page seed: stream the remaining
  // seed pages into the cache, then reload the list. Non-blocking on purpose —
  // if it fails mid-way we keep showing whatever already loaded.
  const continueSeedInBackground = useCallback(async () => {
    try {
      await seedCacheRemainingPages();
      applyRecipes(await getCachedRecipes());
    } catch (error) {
      console.warn("[RecipeReal] background seed continuation failed:", error);
    }
  }, [applyRecipes]);

  // Background refresh: light upsert (no step re-download) + reload from cache.
  const refreshInBackground = useCallback(async () => {
    try {
      await refreshCacheLight();
      // Reload the FULL library: search is applied client-side; a search-filtered
// reload would truncate the list source permanently (cleared search couldn't
// bring the rest back).
applyRecipes(await getCachedRecipes());
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] background refresh failed:", error);
    }
  }, [search, applyRecipes]);

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

  // Refresh the favorites snapshot whenever the screen regains focus, so
  // un-hearting on the detail screen is reflected here instead of staying
  // stale until the next mount (the reported bug). These are cheap SQLite
  // reads, so no guard on the initial load is needed.
  useFocusEffect(
    useCallback(() => {
      reloadFavorites();
    }, [reloadFavorites]),
  );

  // Param-driven filter (contract with Home's "browse by craving" shortcuts):
  // /browse?filter=<category id | quick> selects that chip. Applied on focus
  // whenever the param VALUE changes since we last saw it — so the initial
  // deep link filters the list, repeated pushes re-filter, but a param that
  // merely persisted across focuses never overrides a manually cleared chip.
  const lastParamFilterRef = useRef<string | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (paramFilter === lastParamFilterRef.current) return;
      lastParamFilterRef.current = paramFilter;
      const parsed = parseParamFilter(paramFilter);
      if (parsed) {
        setFilter(parsed);
        track("filter_used", { filter: parsed });
      }
    }, [paramFilter]),
  );

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

  const handleClearAdvanced = useCallback(() => {
    setTimeMax(null);
    setCleanupMax(null);
    setSortMode("default");
  }, []);

  // Animated open/close: LayoutAnimation animates the panel's mount/unmount
  // and the surrounding layout shift natively instead of a hard jump.
  const toggleFilters = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFilters((v) => !v);
  }, []);

  const handleOpenRecipe = useCallback((id: number) => {
    router.push(`/recipe/${id}`);
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
        applyRecipes(first);
        setState("ready");
        continueSeedInBackground();
        return false;
      }
      applyRecipes(await getCachedRecipes());
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
  }, [continueSeedInBackground, applyRecipes]);

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
              applyRecipes(await getCachedRecipes());
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

  // Deferred apply: chip state (and its accent tone) updates synchronously in
  // the press handler; this effect then flags `applying` (skeleton paints) and
  // recomputes the list one timeout later, so the chip acknowledgment and the
  // skeleton always paint BEFORE the (potentially large) list churn. Search
  // typing recomputes the same way but without the skeleton flash. Rapid
  // changes cancel the pending apply — only the last one lands.
  const chipKey = `${filter}|${timeMax ?? ""}|${cleanupMax ?? ""}|${sortMode}`;
  const prevChipKeyRef = useRef(chipKey);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const chipChanged = chipKey !== prevChipKeyRef.current;
    prevChipKeyRef.current = chipKey;
    if (chipChanged) {
      setApplying(true);
    }
    if (applyTimerRef.current != null) {
      clearTimeout(applyTimerRef.current);
    }
    applyTimerRef.current = setTimeout(() => {
      applyTimerRef.current = null;
      setVisibleRecipes(
        computeVisibleRecipes(
          recipes,
          search,
          filter,
          timeMax,
          cleanupMax,
          sortMode,
        ),
      );
      setApplying(false);
    }, 0);
    return () => {
      if (applyTimerRef.current != null) {
        clearTimeout(applyTimerRef.current);
        applyTimerRef.current = null;
      }
    };
  }, [recipes, search, filter, timeMax, cleanupMax, sortMode, chipKey]);

  const hasAdvancedFilters =
    timeMax != null || cleanupMax != null || sortMode !== "default";

  const hasActiveFilters =
    search.trim().length > 0 ||
    filter !== "all" ||
    timeMax != null ||
    cleanupMax != null;

  const renderItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => (
      <RecipeCard
        item={item}
        favorited={favoriteIds.has(item.id)}
        onOpen={handleOpenRecipe}
        onToggleFavorite={handleToggleFavorite}
        numColumns={numColumns}
        styles={styles}
      />
    ),
    [numColumns, favoriteIds, handleOpenRecipe, handleToggleFavorite, styles],
  );

  const showSkeletons =
    (state === "loading" && recipes.length === 0) ||
    (state === "ready" && applying);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScreenHeader title="Browse" />
      <SearchBar
        search={search}
        onChangeSearch={setSearch}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        hasAdvancedFilters={hasAdvancedFilters}
        colors={colors}
        styles={styles}
      />

      {state === "ready" && favoriteRecipes.length > 0 && (
        <FavoritesRail
          favoriteRecipes={favoriteRecipes}
          onOpen={handleOpenRecipe}
          styles={styles}
        />
      )}

      {state === "ready" && (
        <ChipRow filter={filter} onSelect={handleSelectFilter} styles={styles} />
      )}

      {state === "ready" && showFilters && (
        <FilterPanel
          timeMax={timeMax}
          onTimeMaxChange={setTimeMax}
          cleanupMax={cleanupMax}
          onCleanupMaxChange={setCleanupMax}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onClearAll={handleClearAdvanced}
          styles={styles}
        />
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
          ItemSeparatorComponent={Separator}
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

      {state === "ready" && !applying && (
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
          ItemSeparatorComponent={Separator}
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
