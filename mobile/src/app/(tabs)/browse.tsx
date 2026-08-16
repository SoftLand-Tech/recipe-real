import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { fetchCategories, searchRecipes } from "@/api/client";
import { isOfflineError } from "@/api/http";
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
import type { Recipe, SearchParams } from "@/types";
import { useLocalizedRecipe, useT } from "@/i18n";
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
  categoryLabel,
} from "@/utils/categorize";
import { recipeMinutes } from "@/utils/recipeTime";

// LayoutAnimation needs an explicit opt-in on Android's OLD architecture.
// On the New Architecture it's always on and the experimental call is a
// no-op that warns on every invocation — skip it there.
const g = globalThis as typeof globalThis & {
  RN$NewArchEnabled?: boolean;
  RN_newArchEnabled?: boolean;
};
const isNewArch = g.RN$NewArchEnabled === true || g.RN_newArchEnabled === true;
if (Platform.OS === "android" && !isNewArch) {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type LoadState = "loading" | "ready" | "error";

/**
 * Active list filter: the "quick" time filter, a category string (server
 * category or local keyword label), or none. Category chips now come from
 * the server (GET /api/recipes/categories), so the value is an opaque
 * string — the local CATEGORIES labels are the offline fallback.
 */
type ListFilter =
  | { kind: "all" }
  | { kind: "quick" }
  | { kind: "category"; id: string; label: string };

/** Advanced sort options (applied after all filters). */
type SortMode = "default" | "fastest" | "cleanup";

/** Total-time cap options (community avg with publisher fallback; null = Any). */
const TIME_FILTERS = [
  { max: null, labelKey: "filter.any" },
  { max: 15, labelKey: "filter.time15" },
  { max: 30, labelKey: "filter.time30" },
  { max: 45, labelKey: "filter.time45" },
  { max: 60, labelKey: "filter.time60" },
] as const;

/** Cleanup cap options (cleanup_avg_minutes; null = Any). */
const CLEANUP_FILTERS = [
  { max: null, labelKey: "filter.any" },
  { max: 15, labelKey: "filter.cleanupLow" },
  { max: 10, labelKey: "filter.cleanupVeryLow" },
] as const;

const SORT_MODES = [
  { mode: "default", labelKey: "filter.sortDefault" },
  { mode: "fastest", labelKey: "filter.sortFastest" },
  { mode: "cleanup", labelKey: "filter.sortLeastCleanup" },
] as const;

/** Debounce for search/filter changes before hitting the server. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
 * whatever the network does (force-cleared by a setTimeout guard).
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

/**
 * Parse the `filter` param other screens may pass (contract with Home's
 * craving shortcuts): "quick", a local CATEGORIES id (offline fallback), or a
 * REAL server category label — Home's chips are the server categories and
 * their id IS the label. Local ids map to their label so the SAME string is
 * sent to the server (`category` matches case-insensitively) and to the
 * offline filter; raw labels are kept verbatim for the same reason.
 */
function parseParamFilter(value: string | undefined): ListFilter | null {
  if (!value) return null;
  if (value === "quick") return { kind: "quick" };
  const local = CATEGORIES.find((c) => c.id === value);
  if (local) {
    return { kind: "category", id: local.id, label: categoryLabel(local.id) };
  }
  return { kind: "category", id: value, label: value };
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
 * Local (offline-fallback) category matching. When the chip is a known local
 * keyword category, keep the regex-based categorizeTitle behavior; server
 * category strings match the recipe's own `category` column or a title
 * substring (cached rows don't carry the metadata column).
 */
function matchesCategory(
  recipe: Recipe,
  filter: { id: string; label: string },
): boolean {
  const local = CATEGORIES.find((c) => c.id === filter.id);
  if (local && categorizeTitle(recipe.title) === local.id) return true;
  const label = filter.label.toLowerCase();
  if (recipe.category != null && recipe.category.toLowerCase() === label) {
    return true;
  }
  return recipe.title.toLowerCase().includes(label);
}

/**
 * The OFFLINE fallback filter pipeline (server-driven mode is handled by the
 * search effect): search → category/quick → total time → cleanup, then sort.
 * Time filters and the fastest sort use the community average with the
 * publisher claim as fallback (`recipeMinutes`), so a sparse community
 * dataset never empties the list.
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
    // Match the English title OR the Arabic title (Arabic search input).
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.title_ar != null && r.title_ar.toLowerCase().includes(q)),
    );
  }
  if (filter.kind === "quick") {
    out = out.filter((r) => {
      const m = recipeMinutes(r);
      return m != null && m <= 30;
    });
  } else if (filter.kind === "category") {
    out = out.filter((r) => matchesCategory(r, filter));
  }
  if (timeMax != null) {
    out = out.filter((r) => {
      const m = recipeMinutes(r);
      return m != null && m <= timeMax;
    });
  }
  if (cleanupMax != null) {
    out = out.filter(
      (r) =>
        r.cleanup_avg_minutes != null && r.cleanup_avg_minutes <= cleanupMax,
    );
  }
  if (sortMode === "fastest") {
    return sortAscNullsLast(out, recipeMinutes);
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

/** One-star rating label, e.g. "★ 4.8" (only rendered when non-null). */
function ratingLabel(rating: number): string {
  return `★ ${rating.toFixed(1)}`;
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
      // marginEnd so the gap follows the layout direction in RTL.
      marginEnd: Space.xs,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Space.md,
      fontSize: Type.body.fontSize,
      color: colors.ink,
    },
    // Clear (X) button at the END of the search input; marginStart so the gap
    // follows the layout direction in RTL.
    searchClear: {
      marginStart: Space.xs,
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
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    panelTitle: {
      ...Type.body,
      fontWeight: "700",
      color: colors.ink,
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
    offlineBannerWrap: {
      marginHorizontal: Space.lg,
      marginBottom: Space.sm,
    },
    footerSpinner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Space.sm,
      paddingVertical: Space.lg,
    },
    footerText: {
      ...Type.caption,
      color: colors.inkSecondary,
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
  const t = useT();
  return (
    <View style={styles.searchSection}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t("browse.searchPlaceholder")}
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={onChangeSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <IconPressable
              onPress={() => onChangeSearch("")}
              accessibilityLabel={t("browse.clearSearch")}
              hitSlop={8}
              style={styles.searchClear}
            >
              <Ionicons name="close" size={18} color={colors.inkFaint} />
            </IconPressable>
          ) : null}
        </View>
        {/* Filter toggle beside the search bar — the common pattern. Filled
            "options" + accent while open so the active state reads clearly. */}
        <IconPressable
          onPress={onToggleFilters}
          accessibilityLabel={t("browse.toggleFilters")}
          style={styles.filterToggle}
        >
          <Ionicons
            name={showFilters ? "options" : "options-outline"}
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
  const t = useT();
  const lr = useLocalizedRecipe();
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
            {lr.title(item)}
          </Text>
          <TimeChip
            minutes={recipeMinutes(item)}
            label={t("common.focused")}
          />
        </View>
      </Card>
    ),
    [onOpen, styles, t, lr],
  );

  return (
    <View style={styles.favoritesSection}>
      <View style={styles.sectionHeaderPad}>
        <SectionHeader title={t("browse.cookAgain")} />
      </View>
      <FlatList
        horizontal
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
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
 * when `filter` or the chip set changes (server categories land once), which
 * is exactly when the chip tones must update. Chip presses send the category
 * STRING to the server (`category` matches case-insensitively).
 */
interface ChipRowProps {
  chips: { id: string; label: string }[];
  filter: ListFilter;
  onSelect: (filter: ListFilter) => void;
  styles: BrowseStyles;
}

const ChipRow = memo(function ChipRow({
  chips,
  filter,
  onSelect,
  styles,
}: ChipRowProps) {
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterRow}
      contentContainerStyle={styles.filterContent}
    >
      <IconPressable onPress={() => onSelect({ kind: "all" })}>
        <Chip
          label={t("filter.all")}
          tone={filter.kind === "all" ? "accent" : "neutral"}
        />
      </IconPressable>
      {chips.map((chip) => (
        <IconPressable
          key={chip.id}
          onPress={() =>
            onSelect({ kind: "category", id: chip.id, label: chip.label })
          }
        >
          <Chip
            label={chip.label}
            tone={
              filter.kind === "category" &&
              filter.id.toLowerCase() === chip.id.toLowerCase()
                ? "accent"
                : "neutral"
            }
          />
        </IconPressable>
      ))}
      <IconPressable onPress={() => onSelect({ kind: "quick" })}>
        <Chip
          label={t("filter.under30")}
          tone={filter.kind === "quick" ? "accent" : "neutral"}
        />
      </IconPressable>
    </ScrollView>
  );
});

/**
 * The advanced-filters card (total time / cleanup / sort + clear all).
 * Memoized: the setters are stable state setters, so it re-renders only when
 * its own filter values change — never for list churn or panel toggling.
 * Total time + fastest sort round-trip through the server search; the
 * cleanup filter/sort (no server equivalent) is applied client-side over the
 * loaded pages. The header row (title + explicit X) makes the open state and
 * how to close it unmistakable; "Clear all" is a full-width ghost button at
 * the BOTTOM, rendered only while any advanced filter is active.
 */
interface FilterPanelProps {
  timeMax: number | null;
  onTimeMaxChange: (max: number | null) => void;
  cleanupMax: number | null;
  onCleanupMaxChange: (max: number | null) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  onClearAll: () => void;
  onClose: () => void;
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
  onClose,
  styles,
}: FilterPanelProps) {
  const t = useT();
  const colors = useThemeColors();
  const hasActive =
    timeMax != null || cleanupMax != null || sortMode !== "default";
  return (
    <Card style={styles.filterPanel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{t("browse.filtersTitle")}</Text>
        <IconPressable
          onPress={onClose}
          accessibilityLabel={t("browse.closeFilters")}
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color={colors.ink} />
        </IconPressable>
      </View>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>{t("filter.totalTime")}</Text>
        <View style={styles.panelChips}>
          {TIME_FILTERS.map((option) => (
            <IconPressable
              key={`time-${option.max ?? "any"}`}
              onPress={() => onTimeMaxChange(option.max)}
            >
              <Chip
                label={t(option.labelKey)}
                size="sm"
                tone={timeMax === option.max ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>{t("filter.cleanup")}</Text>
        <View style={styles.panelChips}>
          {CLEANUP_FILTERS.map((option) => (
            <IconPressable
              key={`cleanup-${option.max ?? "any"}`}
              onPress={() => onCleanupMaxChange(option.max)}
            >
              <Chip
                label={t(option.labelKey)}
                size="sm"
                tone={cleanupMax === option.max ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      <View style={styles.panelGroup}>
        <Text style={styles.panelLabel}>{t("filter.sort")}</Text>
        <View style={styles.panelChips}>
          {SORT_MODES.map((option) => (
            <IconPressable
              key={option.mode}
              onPress={() => onSortModeChange(option.mode)}
            >
              <Chip
                label={t(option.labelKey)}
                size="sm"
                tone={sortMode === option.mode ? "accent" : "neutral"}
              />
            </IconPressable>
          ))}
        </View>
      </View>
      {hasActive ? (
        <Button
          title={t("filter.clearAll")}
          variant="ghost"
          onPress={onClearAll}
          fullWidth
        />
      ) : null}
    </Card>
  );
});

/**
 * The main list card. Memoized so that when VirtualizedList re-renders its
 * cells (e.g. the panel toggle re-rendering the screen), each card bails out
 * on shallow-equal props: stable `item`, boolean heart state, and stable
 * callbacks. The time chip falls back to the publisher claim; the amber
 * rating chip renders only when the server row carries a rating.
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
  const t = useT();
  const lr = useLocalizedRecipe();
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
          {lr.title(item)}
        </Text>
        <View style={styles.cardChips}>
          <TimeChip
            minutes={recipeMinutes(item)}
            label={t("common.focused")}
          />
          <TimeChip
            minutes={item.cleanup_avg_minutes}
            label={t("common.cleanup")}
          />
          {item.aggregated_rating != null ? (
            <Chip
              tone="amber"
              size="sm"
              label={ratingLabel(item.aggregated_rating)}
            />
          ) : null}
          <Chip
            tone="amber"
            label={t("common.stepCount", { n: stepCount(item) })}
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
  const t = useT();
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = params.filter;

  // Tablet (width >= 768): two columns. Phones: one column.
  const numColumns = width >= 768 ? 2 : 1;
  const columnGap = Space.lg;

  // ---- Local cache source (offline fallback + favorites) --------------------
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);

  // ---- Server-driven list ----------------------------------------------------
  const [serverItems, setServerItems] = useState<Recipe[]>([]);
  const [serverMeta, setServerMeta] = useState<{
    current: number;
    last: number;
  } | null>(null);
  const [serverTotal, setServerTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Offline fallback active: the list renders the LOCAL cached pipeline and
  // the "Offline — showing saved recipes" caption chip shows.
  const [offline, setOffline] = useState(false);
  // Server category chips (null until loaded → local keyword chips render).
  const [serverChips, setServerChips] = useState<{
    id: string;
    label: string;
  }[] | null>(null);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ListFilter>({ kind: "all" });

  // Advanced filters (the "Filters" panel).
  const [showFilters, setShowFilters] = useState(false);
  const [timeMax, setTimeMax] = useState<number | null>(null);
  const [cleanupMax, setCleanupMax] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Deferred-apply pipeline state (offline/local path): chip taps update the
  // chip + show the skeleton immediately, the recomputed list lands a tick
  // later. Also drives the skeleton for the in-flight SERVER search.
  const [visibleRecipes, setVisibleRecipes] = useState<Recipe[]>([]);
  // Start in applying state: until the first search/computation lands, the
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

  /** Load-more footer spinner (server pagination only); stable per state. */
  const ListFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerSpinner}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.footerText}>{t("browse.loadingMore")}</Text>
      </View>
    );
  }, [loadingMore, colors, styles, t]);

  /**
   * Identity-guarded recipes setter: background refreshes routinely return
   * identical rows with fresh array identities, which would re-render (and
   * re-run the filter pipeline over) the whole list for nothing. Fingerprint
   * by id:title:times and skip the setState when nothing changed.
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

  // Mirror of the server item count for stale-closure-free error handling
  // (runSearch must not depend on the serverItems array identity).
  const serverItemsCountRef = useRef(0);
  const commitServerItems = useCallback((next: Recipe[]) => {
    serverItemsCountRef.current = next.length;
    setServerItems(next);
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
      applyRecipes(await getCachedRecipes());
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] background refresh failed:", error);
    }
  }, [applyRecipes]);

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

  // Leaving the screen closes the filters panel, so it never re-opens on
  // return (tab screens stay mounted while navigating elsewhere).
  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowFilters(false);
      };
    }, []),
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
        track("filter_used", { filter: paramFilter });
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
    if (next.kind !== "all") {
      track("filter_used", {
        filter: next.kind === "category" ? next.id : next.kind,
      });
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
   * The cached library backs the OFFLINE fallback (and favorites/cook mode);
   * the on-screen list itself is server-driven. Returns true when previously
   * cached data was shown (so the caller can decide whether a light
   * background refresh is worthwhile).
   */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    setState("loading");
    setErrorMessage(null);
    try {
      const count = await countCachedRecipes();
      if (count === 0) {
        // Cold cache: seed just the first page (a fraction of the dataset) so
        // the fallback library exists quickly; the rest arrives in background.
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
      // The cache only backs the fallback — never blank a working server list.
      if (serverItemsCountRef.current === 0) {
        setErrorMessage(
          error instanceof Error ? error.message : t("common.loadFailedRecipes"),
        );
        setState("error");
      }
      return false;
    }
  }, [continueSeedInBackground, applyRecipes, t]);

  // Map the current UI state to search-endpoint params. "quick" = under 30
  // minutes door-to-door (tightened further by a stricter panel cap); the
  // cleanup sort has no server equivalent and stays client-side.
  const buildSearchParams = useCallback(
    (): SearchParams => ({
      q: search.trim() || undefined,
      category: filter.kind === "category" ? filter.label : undefined,
      maxTime:
        filter.kind === "quick"
          ? Math.min(30, timeMax ?? 30)
          : (timeMax ?? undefined),
      sort: sortMode === "fastest" ? "fastest" : undefined,
    }),
    [search, filter, timeMax, sortMode],
  );

  // Monotonic request id: only the LATEST search/scroll request may commit
  // state, so out-of-order responses never clobber newer results.
  const searchRequestIdRef = useRef(0);

  /**
   * Fetch page 1 from the server search endpoint and replace the list. A
   * GENUINE network failure falls back to the local cached pipeline (with the
   * offline caption chip) whenever the cache has recipes; a server error
   * keeps whatever is already on screen, or surfaces the error state when
   * there is nothing to show. Never crashes.
   */
  const runSearch = useCallback(async () => {
    const requestId = ++searchRequestIdRef.current;
    try {
      const result = await searchRecipes({ ...buildSearchParams(), page: 1 });
      if (requestId !== searchRequestIdRef.current) return;
      commitServerItems(result.recipes);
      setServerMeta({ current: result.currentPage, last: result.lastPage });
      setServerTotal(result.total);
      setOffline(false);
      setErrorMessage(null);
      setState("ready");
      setApplying(false);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      console.warn("[RecipeReal] search failed:", error);
      if (isOfflineError(error)) {
        // Offline WITH a usable cache: local pipeline + banner chip.
        try {
          const cached = await getCachedRecipes();
          if (cached.length > 0) {
            applyRecipes(cached);
            setOffline(true);
            setState("ready");
            setApplying(false);
            return;
          }
        } catch {
          // Fall through to the error state below.
        }
      }
      // Server answered with an error (or offline with an empty cache):
      // keep any content already on screen, else surface the error state.
      setApplying(false);
      if (serverItemsCountRef.current === 0) {
        setErrorMessage(t("common.couldNotLoadRecipes"));
        setState("error");
      }
    }
  }, [buildSearchParams, commitServerItems, applyRecipes, t]);

  /**
   * Server-driven search: q / category / max_time / sort changes debounce
   * 350ms, then page 1 replaces the list. Chip-style filter changes flash
   * the skeleton immediately (instant visual acknowledgment); typing keeps
   * the current results until the new page lands. Leaving offline mode
   * (e.g. after a successful pull-to-refresh) re-runs the search silently.
   */
  const serverFilterKey = `${filter.kind === "category" ? `cat:${filter.id}` : filter.kind}|${timeMax ?? ""}|${sortMode}`;
  const prevServerFilterKeyRef = useRef<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (offline) return; // Local pipeline owns the screen while offline.
    if (
      serverFilterKey !== prevServerFilterKeyRef.current &&
      prevServerFilterKeyRef.current != null
    ) {
      setApplying(true);
    }
    prevServerFilterKeyRef.current = serverFilterKey;
    if (searchDebounceRef.current != null) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      runSearch().catch((error) => {
        console.warn("[RecipeReal] search effect failed:", error);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current != null) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [search, serverFilterKey, offline, runSearch]);

  /**
   * Infinite scroll: while the paginator says more pages exist, fetch the
   * next one and append (deduped by id — server pages can shift slightly).
   * Concurrent triggers are guarded; stale responses are dropped via the
   * shared request id.
   */
  const loadingMoreRef = useRef(false);
  const handleEndReached = useCallback(() => {
    if (offline || loadingMoreRef.current) return;
    if (serverMeta == null || serverMeta.current >= serverMeta.last) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestId = ++searchRequestIdRef.current;
    searchRecipes({ ...buildSearchParams(), page: serverMeta.current + 1 })
      .then((result) => {
        if (requestId !== searchRequestIdRef.current) return;
        setServerItems((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const merged = [
            ...prev,
            ...result.recipes.filter((r) => !seen.has(r.id)),
          ];
          serverItemsCountRef.current = merged.length;
          return merged;
        });
        setServerMeta({ current: result.currentPage, last: result.lastPage });
      })
      .catch((error) => {
        // Best-effort: keep the loaded pages, just log.
        console.warn("[RecipeReal] load more failed:", error);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [offline, serverMeta, buildSearchParams]);

  // Category chips from the server (cached in AsyncStorage by the client;
  // empty/offline → local keyword categories). Loaded once per mount.
  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((rows) => {
        if (cancelled) return;
        setServerChips(
          rows.length > 0
            ? rows.map((row) => ({ id: row.category, label: row.category }))
            : null,
        );
      })
      .catch(() => {
        // Keep the local fallback chips.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chips = useMemo(() => {
    if (serverChips != null) return serverChips;
    return CATEGORIES.map((c) => ({ id: c.id, label: categoryLabel(c.id) }));
  }, [serverChips]);

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
    // Global safety: the spinner never outlives ~10s.
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    const spinnerDone = () => {
      clearTimeout(guard);
      setRefreshing(false);
    };
    // Is there an ACTIVE query for the server list? (Mirrors buildSearchParams:
    // search text, category/quick chip, time cap, or fastest sort.)
    const hasActiveQuery =
      search.trim().length > 0 ||
      filter.kind !== "all" ||
      timeMax != null ||
      sortMode !== "default";
    try {
      if (!offline && hasActiveQuery) {
        // FAST: one API request re-running the CURRENT query.
        await runSearch();
      } else {
        // INSTANT: reload the local fallback source from SQLite.
        applyRecipes(await getCachedRecipes());
      }
    } catch (error) {
      console.warn("[RecipeReal] pull-to-refresh failed:", error);
    } finally {
      spinnerDone();
    }
    // The SLOW multi-page light cache sweep continues WITHOUT the spinner; in
    // the default (unfiltered) online view the server list re-syncs silently.
    refreshInBackground().catch(() => {
      // Best-effort background work.
    });
    if (!offline && !hasActiveQuery) {
      runSearch().catch(() => {
        // Best-effort background work.
      });
    }
  }, [
    offline,
    search,
    filter,
    timeMax,
    sortMode,
    runSearch,
    refreshInBackground,
    applyRecipes,
  ]);

  const handleRetry = useCallback(async () => {
    // Error state: retry the cache pipeline; the debounced search effect
    // picks the server list back up once the cache resolves.
    await loadFromCache();
    void runSearch();
  }, [loadFromCache, runSearch]);

  // Deferred apply (OFFLINE/local path only): chip state (and its accent
  // tone) updates synchronously in the press handler; this effect then flags
  // `applying` (skeleton paints) and recomputes the list one timeout later.
  // In server mode this is a no-op — the search effect owns applying.
  const chipKey = `${filter.kind === "category" ? `cat:${filter.id}` : filter.kind}|${timeMax ?? ""}|${cleanupMax ?? ""}|${sortMode}`;
  const prevChipKeyRef = useRef(chipKey);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!offline) return;
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
  }, [recipes, search, filter, timeMax, cleanupMax, sortMode, chipKey, offline]);

  /**
   * Client-side post-processing of the SERVER pages: the cleanup filter and
   * cleanup sort have no search-endpoint equivalent, so they apply over the
   * pages loaded so far (more matches appear as pagination continues).
   */
  const serverVisible = useMemo(() => {
    let out = serverItems;
    if (cleanupMax != null) {
      out = out.filter(
        (r) =>
          r.cleanup_avg_minutes != null && r.cleanup_avg_minutes <= cleanupMax,
      );
    }
    if (sortMode === "cleanup") {
      out = sortAscNullsLast(out, (r) => r.cleanup_avg_minutes);
    }
    return out;
  }, [serverItems, cleanupMax, sortMode]);

  const displayRecipes = offline ? visibleRecipes : serverVisible;

  const hasAdvancedFilters =
    timeMax != null || cleanupMax != null || sortMode !== "default";

  const hasActiveFilters =
    search.trim().length > 0 ||
    filter.kind !== "all" ||
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
      <ScreenHeader title={t("tabs.browse")} />
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
        <ChipRow
          chips={chips}
          filter={filter}
          onSelect={handleSelectFilter}
          styles={styles}
        />
      )}

      {state === "ready" && offline && (
        <View style={styles.offlineBannerWrap}>
          <Chip tone="amber" size="sm" label={t("browse.offlineCaption")} />
        </View>
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
          onClose={toggleFilters}
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
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.muted}>
            {errorMessage ?? t("common.couldNotLoadRecipes")}
          </Text>
          <Pressable style={styles.retry} onPress={handleRetry}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {state === "ready" && !applying && (
        <FlatList
          key={numColumns === 1 ? "list-1col" : "list-2col"}
          data={displayRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={
            numColumns > 1
              ? { justifyContent: "flex-start", gap: columnGap }
              : undefined
          }
          // Heavy image cards: render small batches so no single frame tries
          // to mount a whole window of photos (fixes the VirtualizedList
          // "slow to update" warning on lower-end devices).
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          updateCellsBatchingPeriod={80}
          removeClippedSubviews
          refreshing={refreshing}
          onRefresh={handleRefresh}
          // Server pagination: fetch the next page near the end of the list.
          onEndReached={offline ? undefined : handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={offline ? null : ListFooter}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>🍳</Text>
              {hasActiveFilters ? (
                <>
                  <Text style={styles.muted}>
                    {search.trim().length > 0
                      ? t("browse.noResultsFor", { query: search.trim() })
                      : t("browse.noMatch")}
                  </Text>
                  <Text style={styles.emptyCount}>
                    {t("browse.countOf", {
                      shown: displayRecipes.length,
                      total: offline ? recipes.length : serverTotal,
                    })}
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>{t("common.emptyRecipes")}</Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}
