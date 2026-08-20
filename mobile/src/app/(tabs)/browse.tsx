import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  BigScreenTitle,
  PinnedHeaderBar,
  useChromeContentBottomPad,
  useCollapseScroll,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";
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
  getNotedRecipeIds,
  refreshCacheLight,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
  toggleFavorite,
} from "@/db/database";
import type { Recipe, SearchParams } from "@/types";
import { useLang, useLocalizedRecipe, useT } from "@/i18n";
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
  NoteBadge,
  TimeChip,
  fmtMinutes,
  useHeaderActionsRights,
} from "@/components/ui";
import {
  CATEGORIES,
  categorizeTitle,
  categoryLabel,
} from "@/utils/categorize";
import { localizedCategory } from "@/utils/categories";
import { recipeMinutes, bestMinutes } from "@/utils/recipeTime";

// LayoutAnimation works out of the box on the New Architecture (Expo SDK
// 57+); the legacy setLayoutAnimationEnabledExperimental opt-in is only
// needed on old-arch Android and warns on new arch, so it is not called.

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

/** Total-time cap options (community avg with publisher fallback; null = Any).
 *  DECLUTTERED: the ≤ 15 option was dropped — Any/≤30/≤45/≤60 is enough. */
const TIME_FILTERS = [
  { max: null, labelKey: "filter.any" },
  { max: 30, labelKey: "filter.time30" },
  { max: 45, labelKey: "filter.time45" },
  { max: 60, labelKey: "filter.time60" },
] as const;

const SORT_MODES = [
  { mode: "default", labelKey: "filter.sortDefault" },
  { mode: "fastest", labelKey: "filter.sortFastest" },
  { mode: "cleanup", labelKey: "filter.sortLeastCleanup" },
] as const;

/** Visible category chips (DECLUTTERED: capped so the row stays one glance). */
const CATEGORY_CHIP_LIMIT = 8;

/** Debounce for search/filter changes before hitting the server. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * AsyncStorage flag set by the detail screen after a successful quick-time
 * submit. On the next focus, browse re-syncs its server-driven grid once
 * (the flag is cleared either way), so the list shows the recomputed
 * community averages instead of pinning the pre-submit values.
 */
const QUICK_TIME_STALE_KEY = "recipereal.quickTimeStale";
/** How long a quick-time stale flag stays actionable, in ms. */
const QUICK_TIME_STALE_TTL_MS = 60_000;

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
      // Vertical breathing room between grid rows (the columnWrapper gap
      // covers the horizontal gutter).
      rowGap: Space.sm,
      paddingBottom: Space.xxl,
    },
    // Immersive photo grid: each cell flexes to half the row; the
    // columnWrapper gap provides the Space.sm gutter (no separators).
    photoCard: {
      flex: 1,
    },
    // HeroImage takes a fixed `height` prop; "auto" (merged LAST in its
    // style array) yields to the 3:4 aspect so the photo derives its height
    // from the cell width at every size/orientation.
    photoHero: {
      height: "auto",
      aspectRatio: 3 / 4,
    },
    photoOverlay: {
      gap: Space.xs,
    },
    photoTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    photoMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.sm,
    },
    photoMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.xs,
    },
    photoMetaText: {
      ...Type.caption,
      fontWeight: "600",
      // Pure white over the bottom scrim — the correct overlay color in
      // both schemes (the scrim darkens, never tints).
      color: "#FFFFFF",
    },
    photoFallbackBody: {
      aspectRatio: 3 / 4,
      backgroundColor: colors.surfaceSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: Radius.lg,
      alignItems: "center",
      justifyContent: "center",
      padding: Space.md,
      gap: Space.sm,
    },
    photoGlyph: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    photoFallbackTitle: {
      ...Type.bodySm,
      fontWeight: "600",
      color: colors.ink,
      textAlign: "center",
    },
    photoFallbackMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.sm,
    },
    photoFallbackRating: {
      ...Type.caption,
      fontWeight: "600",
      color: colors.inkSecondary,
    },
    skeletonBlock: {
      flex: 1,
      aspectRatio: 3 / 4,
      backgroundColor: colors.surfaceSoft,
      borderRadius: Radius.lg,
    },
    // Dismissible summary chips shown above the grid while a discrete
    // filter is active (reuses existing chip/panel labels).
    activeChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: Space.xs,
      marginHorizontal: Space.lg,
      marginBottom: Space.sm,
    },
    activeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: Radius.pill,
      paddingVertical: Space.xs,
      paddingHorizontal: Space.md,
    },
    activeChipText: {
      ...Type.caption,
      fontWeight: "600",
      color: colors.accent,
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
      // Literal white on the accent pill — surface goes dark in dark mode.
      color: "#FFFFFF",
      fontWeight: "700",
    },
    pinnedBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
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
  /** Opens the recipe composer — the "+" pill at the END of the row. */
  onCreate: () => void;
  /** Attached to the TextInput so `?focus=1` can autofocus it on mount. */
  inputRef: RefObject<TextInput | null>;
  colors: ThemeColors;
  styles: BrowseStyles;
}

const SearchBar = memo(function SearchBar({
  search,
  onChangeSearch,
  showFilters,
  onToggleFilters,
  hasAdvancedFilters,
  onCreate,
  inputRef,
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
            ref={inputRef}
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
        {/* Create recipe — completes the row: search, filters, then add. */}
        <IconPressable
          onPress={onCreate}
          accessibilityLabel={t("browse.addRecipe")}
          style={styles.filterToggle}
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </IconPressable>
      </View>
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
  const { lang } = useLang();
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
            // Display-only localization: the chip's id/label in the filter
            // still carries the ORIGINAL English string for server matching.
            label={localizedCategory(chip.label, lang)}
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
 * The advanced-filters card (total time / sort + clear all).
 * Memoized: the setters are stable state setters, so it re-renders only when
 * its own filter values change — never for list churn or panel toggling.
 * Total time + fastest sort round-trip through the server search. The cleanup
 * filter/sort (no server equivalent) still applies client-side over the
 * loaded pages when armed by state, but its chip row was removed from the
 * panel — one less decision on screen (fewer choices, same mechanics).
 * The header row (title + explicit X) makes the open state and how to close
 * it unmistakable; "Clear all" is a full-width ghost button at the BOTTOM,
 * rendered only while any advanced filter is active.
 */
interface FilterPanelProps {
  timeMax: number | null;
  onTimeMaxChange: (max: number | null) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  onClearAll: () => void;
  onClose: () => void;
  styles: BrowseStyles;
}

const FilterPanel = memo(function FilterPanel({
  timeMax,
  onTimeMaxChange,
  sortMode,
  onSortModeChange,
  onClearAll,
  onClose,
  styles,
}: FilterPanelProps) {
  const t = useT();
  const colors = useThemeColors();
  const hasActive = timeMax != null || sortMode !== "default";
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
 * One immersive photo-grid cell. Memoized so that when VirtualizedList
 * re-renders its cells (e.g. the panel toggle re-rendering the screen), each
 * card bails out on shallow-equal props: stable `item`, boolean heart state,
 * and stable callbacks. The photo fills the 3:4 cell edge-to-edge with a
 * bottom scrim; title + a one-line meta row (time via recipeMinutes →
 * fmtMinutes, ★ rating when present) overlay it in white. Recipes without an
 * image render a designed placeholder cell — the same 3:4 grid shape, no
 * scrim — with a soft accent glyph circle, centered title and the same
 * TimeChip + rating row, so imageless recipes keep appearing intentionally.
 */
interface PhotoCardProps {
  item: Recipe;
  favorited: boolean;
  hasNote: boolean;
  onOpen: (id: number) => void;
  /** Full recipe so hearting an uncached search result can cache it. */
  onToggleFavorite: (recipe: Recipe) => void;
  styles: BrowseStyles;
}

const PhotoCard = memo(function PhotoCard({
  item,
  favorited,
  hasNote,
  onOpen,
  onToggleFavorite,
  styles,
}: PhotoCardProps) {
  const t = useT();
  const colors = useThemeColors();
  const lr = useLocalizedRecipe();
  const minutes = bestMinutes(item);
  const hasImage =
    typeof item.image_url === "string" && item.image_url.trim().length > 0;
  return (
    <Card
      onPress={() => onOpen(item.id)}
      padding={0}
      shadow="card"
      style={styles.photoCard}
    >
      {hasImage ? (
        <HeroImage
          uri={item.image_url}
          // Nominal value — the photoHero style (height "auto" + 3:4
          // aspect) wins the style merge and sizes the photo from the cell.
          height={240}
          rounded={Radius.lg}
          withScrim
          style={styles.photoHero}
        >
          <View style={styles.photoOverlay}>
            <Text style={styles.photoTitle} numberOfLines={2}>
              {lr.title(item)}
            </Text>
            <View style={styles.photoMeta}>
              {minutes != null ? (
                <View style={styles.photoMetaItem}>
                  <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.photoMetaText}>
                    {fmtMinutes(minutes)}
                  </Text>
                </View>
              ) : null}
              {item.aggregated_rating != null ? (
                <Text style={styles.photoMetaText}>
                  {ratingLabel(item.aggregated_rating)}
                </Text>
              ) : null}
            </View>
          </View>
        </HeroImage>
      ) : (
        <View style={styles.photoFallbackBody}>
          <View style={styles.photoGlyph}>
            <Ionicons
              name="restaurant-outline"
              size={24}
              color={colors.accent}
            />
          </View>
          <Text style={styles.photoFallbackTitle} numberOfLines={3}>
            {lr.title(item)}
          </Text>
          <View style={styles.photoFallbackMeta}>
            <TimeChip minutes={minutes} label={t("common.focused")} />
            {item.aggregated_rating != null ? (
              <Text style={styles.photoFallbackRating}>
                {ratingLabel(item.aggregated_rating)}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {/* Overlays anchor to the physical top corners of the photo-sized
          card: HeartButton owns top-end, NoteBadge top-start. */}
      <HeartButton
        favorited={favorited}
        onPress={() => onToggleFavorite(item)}
      />
      <NoteBadge show={hasNote} />
    </Card>
  );
});

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const headerRights = useHeaderActionsRights();
  const params = useLocalSearchParams<{ filter?: string; focus?: string }>();
  const paramFilter = params.filter;
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const barPad = usePinnedBarPad();
  const collapse = useCollapseScroll({ existingOnScroll: chrome.onScroll });

  // ---- Local cache source (offline fallback + favorites) --------------------
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  // Ids of recipes carrying a personal note — drives the pencil badge on cards.
  const [noteIds, setNoteIds] = useState<Set<number>>(new Set());

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
  // Ref into the (memoized) SearchBar's TextInput — used by `?focus=1`.
  const searchInputRef = useRef<TextInput>(null);
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
      // Ids only — the hearts on cards. Full favorite rows live on the
      // Favorites tab ("Cook again" rail removed from Browse by request).
      setFavoriteIds(new Set(await getFavoriteIds()));
    } catch (error) {
      console.warn("[RecipeReal] loading favorites failed:", error);
    }
  }, []);

  // Reload the noted-recipe id set from SQLite. Same cadence as the favorites
  // reload (mount + focus), so notes saved/cleared on the detail screen are
  // reflected in the card badges as soon as the user returns. Best-effort.
  const reloadNoteIds = useCallback(async () => {
    try {
      setNoteIds(new Set(await getNotedRecipeIds()));
    } catch (error) {
      console.warn("[RecipeReal] loading noted recipe ids failed:", error);
    }
  }, []);

  // Refresh the favorites + notes snapshots whenever the screen regains focus,
  // so un-hearting or note edits on the detail screen are reflected here
  // instead of staying stale until the next mount. These are cheap SQLite
  // reads, so no guard on the initial load is needed.
  useFocusEffect(
    useCallback(() => {
      reloadFavorites();
      reloadNoteIds();
    }, [reloadFavorites, reloadNoteIds]),
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

  // `?focus=1` (deep-link contract): focus the search field on mount. The
  // rAF hop waits for the first layout so the ref is attached by the
  // memoized SearchBar before focus fires.
  useEffect(() => {
    if (params.focus !== "1") return;
    const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [params.focus]);

  const handleToggleFavorite = useCallback(
    async (recipe: Recipe) => {
      try {
        // Pass the full recipe: search results can be uncached locally, and
        // the db layer upserts a light copy so the favorites FK never fails.
        const favorited = await toggleFavorite(recipe);
        track("favorite_toggled", { recipe_id: recipe.id, favorited });
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
    const source =
      serverChips ??
      CATEGORIES.map((c) => ({ id: c.id, label: categoryLabel(c.id) }));
    return source.slice(0, CATEGORY_CHIP_LIMIT);
  }, [serverChips]);

  useEffect(() => {
    // Favorites + notes are independent of the cache load: pull them in
    // parallel. (They also refresh on focus — see useFocusEffect above.)
    reloadFavorites();
    reloadNoteIds();
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

  // Quick-time staleness: the detail screen flags a fresh submit; on the next
  // focus, re-run the server search once (silently) so the grid reflects the
  // recomputed community averages. The flag is cleared regardless of age.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(QUICK_TIME_STALE_KEY)
        .then((raw) => {
          if (raw == null) return;
          const flaggedAt = Number(raw);
          AsyncStorage.removeItem(QUICK_TIME_STALE_KEY).catch(() => {});
          if (!offline && Number.isFinite(flaggedAt)) {
            const fresh = Date.now() - flaggedAt < QUICK_TIME_STALE_TTL_MS;
            if (fresh) {
              runSearch().catch(() => {
                // Best-effort background work.
              });
            }
          }
        })
        .catch(() => {
          // Best-effort: a failed read just skips the re-sync.
        });
    }, [offline, runSearch]),
  );

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
      <PhotoCard
        item={item}
        favorited={favoriteIds.has(item.id)}
        hasNote={noteIds.has(item.id)}
        onOpen={handleOpenRecipe}
        onToggleFavorite={handleToggleFavorite}
        styles={styles}
      />
    ),
    [favoriteIds, noteIds, handleOpenRecipe, handleToggleFavorite, styles],
  );

  // Dismissible summary chips for the active discrete filters (i18n FROZEN:
  // reuses the existing chip/panel labels; the search text already has its
  // own clear button inside the field, so it is not duplicated here).
  const activeFilterChips: {
    key: string;
    label: string;
    onClear: () => void;
  }[] = [];
  if (filter.kind === "category") {
    activeFilterChips.push({
      key: "cat",
      label: filter.label,
      onClear: () => setFilter({ kind: "all" }),
    });
  } else if (filter.kind === "quick") {
    activeFilterChips.push({
      key: "quick",
      label: t("filter.under30"),
      onClear: () => setFilter({ kind: "all" }),
    });
  }
  if (timeMax != null) {
    const option = TIME_FILTERS.find((o) => o.max === timeMax);
    activeFilterChips.push({
      key: "time",
      label: option ? t(option.labelKey) : fmtMinutes(timeMax),
      onClear: () => setTimeMax(null),
    });
  }

  const showSkeletons =
    (state === "loading" && recipes.length === 0) ||
    (state === "ready" && applying);

  // Big title + search scroll AWAY with the feed (iOS large-title pattern);
  // shown statically only while the real list isn't mounted (loading /
  // error / applying), where they sit at scroll-top anyway.
  const headerBlock = (
    <>
      <BigScreenTitle title={t("tabs.browse")} />
      <SearchBar
        search={search}
        onChangeSearch={setSearch}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        hasAdvancedFilters={hasAdvancedFilters}
        onCreate={() => router.push("/recipe-composer")}
        inputRef={searchInputRef}
        colors={colors}
        styles={styles}
      />
    </>
  );

  return (
    <View style={styles.container}>
      {/* The chips + filter panels stay pinned under the bar (persistent
          filters); only the big title + search scroll with the list. */}
      <View style={{ flex: 1, paddingTop: barPad }}>
        {!(state === "ready" && !applying) ? headerBlock : null}
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
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            onClearAll={handleClearAdvanced}
            onClose={toggleFilters}
            styles={styles}
          />
        )}

        {state === "ready" && activeFilterChips.length > 0 && (
          <View style={styles.activeChipRow}>
            {activeFilterChips.map((chip) => (
              <View key={chip.key} style={styles.activeChip}>
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <IconPressable
                  onPress={chip.onClear}
                  accessibilityLabel={t("filter.clearAll")}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={14} color={colors.accent} />
                </IconPressable>
              </View>
            ))}
          </View>
        )}

        {showSkeletons && (
          <FlatList
            data={[0, 1, 2, 3, 4, 5]}
            keyExtractor={(item) => `skel-${item}`}
            numColumns={2}
            renderItem={() => <View style={styles.skeletonBlock} />}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={{ gap: Space.sm }}
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
            data={displayRecipes}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            numColumns={2}
            contentContainerStyle={[styles.listContent, { paddingBottom: chromeBottomPad }]}
            columnWrapperStyle={{ gap: Space.sm }}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            updateCellsBatchingPeriod={80}
            removeClippedSubviews
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onScroll={collapse.onScroll}
            scrollEventThrottle={collapse.scrollEventThrottle}
            ListHeaderComponent={headerBlock}
            onEndReached={offline ? undefined : handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={offline ? null : ListFooter}
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
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("tabs.browse")}
          collapse={collapse.scrollY}
          rights={headerRights}
        />
      </View>
    </View>
  );
}
