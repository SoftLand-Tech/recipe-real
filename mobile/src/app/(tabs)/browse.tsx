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
  InteractionManager,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  PinnedHeaderBar,
  useChromeContentBottomPad,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import { fetchCategories, peekCachedSearch, searchRecipes } from "@/api/client";
import { isOfflineError } from "@/api/http";
import { getMirroredBrowseSync, readMirroredBrowse } from "@/utils/browseMirror";
import { track } from "@/analytics";
import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipeSummaries,
  getFavoriteIds,
  getNotedRecipeIds,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
  toggleFavorite,
} from "@/db/database";
import { maybeSweepCache } from "@/utils/cacheSweep";
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

function setMatchesIds(prev: Set<number>, ids: number[]): boolean {
  if (prev.size !== ids.length) return false;
  for (let i = 0; i < ids.length; i++) {
    if (!prev.has(ids[i])) return false;
  }
  return true;
}

/**
 * The OFFLINE fallback filter pipeline (server-driven mode is handled by the
 * search effect): single-pass filter (search + category/quick + total time +
 * cleanup), then sort. Time filters and the fastest sort use the community
 * average with the publisher claim as fallback (`recipeMinutes`), so a sparse
 * community dataset never empties the list.
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
  const isQuick = filter.kind === "quick";
  const isCat = filter.kind === "category";
  const catLocalId = isCat
    ? (CATEGORIES.find((c) => c.id === filter.id)?.id ?? null)
    : null;
  const catLabelLower = isCat ? filter.label.toLowerCase() : "";

  const hasFilter =
    q.length > 0 || isQuick || isCat || timeMax != null || cleanupMax != null;

  const out = hasFilter
    ? source.filter((r) => {
        if (q) {
          // Match the English title OR the Arabic title (Arabic search input).
          const matchesEn = r.title.toLowerCase().includes(q);
          const matchesAr =
            r.title_ar != null && r.title_ar.toLowerCase().includes(q);
          if (!matchesEn && !matchesAr) return false;
        }
        if (isQuick) {
          const m = recipeMinutes(r);
          if (m == null || m > 30) return false;
        } else if (isCat) {
          const matched =
            (catLocalId != null && categorizeTitle(r.title) === catLocalId) ||
            (r.category != null && r.category.toLowerCase() === catLabelLower) ||
            r.title.toLowerCase().includes(catLabelLower);
          if (!matched) return false;
        }
        if (timeMax != null) {
          const m = recipeMinutes(r);
          if (m == null || m > timeMax) return false;
        }
        if (cleanupMax != null) {
          if (
            r.cleanup_avg_minutes == null ||
            r.cleanup_avg_minutes > cleanupMax
          ) {
            return false;
          }
        }
        return true;
      })
    : source;

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
      paddingTop: Space.sm,
      paddingBottom: Space.sm,
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
      // Full-bleed immersive grid — cards run edge to edge (matches the
      // other tabs). Text blocks (search, chips, captions, empty states)
      // carry their own horizontal padding so they never touch the edge.
      paddingHorizontal: 0,
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
      marginBottom: Space.xs,
    },
    filterContent: {
      paddingHorizontal: Space.lg,
      gap: Space.sm,
      alignItems: "center",
    },
    filterPanelWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 20,
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

const COLUMN_WRAPPER_STYLE = { gap: Space.sm } as const;
const FLEX_ONE_STYLE = { flex: 1 } as const;
const SKELETON_ROW_STYLE = { flexDirection: "row", gap: Space.sm } as const;
const SKELETON_ROWS = [0, 1, 2] as const;
const recipeKeyExtractor = (item: Recipe) => String(item.id);

export default function BrowseScreen() {
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const t = useT();
  const headerRights = useHeaderActionsRights();
  const params = useLocalSearchParams<{ filter?: string; focus?: string }>();
  const paramFilter = params.filter;
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const barPad = usePinnedBarPad();
  // Scroll-guard: a drag that ends over a PhotoCard must not push the detail
  // route. RN Web can deliver onPress after a scroll gesture; ignore taps
  // while scrolling / momentum is active. Track last scroll timestamp in
  // onScroll with zero timers; keep timer only on drag/momentum endpoints.
  const scrollingRef = useRef(false);
  const lastScrollTsRef = useRef(0);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markScrolling = useCallback(() => {
    scrollingRef.current = true;
    if (scrollEndTimerRef.current != null) {
      clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = setTimeout(() => {
      scrollEndTimerRef.current = null;
      scrollingRef.current = false;
    }, 300);
  }, []);
  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current != null) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);
  const handleBrowseScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollTsRef.current = Date.now();
      chrome.onScroll(event);
    },
    [chrome],
  );

  // Synchronous cache hydration on mount:
  // When no query/filter/sort is active and params.filter is absent, check SWR
  // cache first, then in-memory mirror. If present, hydrate immediately so Browse
  // mounts directly in "ready" state with real cards, skipping skeleton flash.
  const initialData = useMemo(() => {
    if (paramFilter) return null;
    const swr = peekCachedSearch({ page: 1 });
    if (swr && swr.recipes.length > 0) {
      return {
        recipes: swr.recipes,
        meta: { current: swr.currentPage, last: swr.lastPage },
        total: swr.total,
      };
    }
    const mirror = getMirroredBrowseSync();
    if (mirror && mirror.recipes.length > 0) {
      return {
        recipes: mirror.recipes,
        meta: { current: mirror.currentPage, last: mirror.lastPage },
        total: mirror.total,
      };
    }
    return null;
  }, [paramFilter]);

  // ---- Local cache source (offline fallback + favorites) --------------------
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>(initialData ? "ready" : "loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  // Ids of recipes carrying a personal note — drives the pencil badge on cards.
  const [noteIds, setNoteIds] = useState<Set<number>>(new Set());

  // ---- Server-driven list ----------------------------------------------------
  const [serverItems, setServerItems] = useState<Recipe[]>(initialData?.recipes ?? []);
  const [serverMeta, setServerMeta] = useState<{
    current: number;
    last: number;
  } | null>(initialData?.meta ?? null);
  const [serverTotal, setServerTotal] = useState(initialData?.total ?? 0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Offline fallback active: the list renders the LOCAL cached pipeline and
  // the "Offline — showing saved recipes" caption chip shows.
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);
  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);
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
  const [applying, setApplying] = useState(initialData == null);

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

  const hasServerQueryOrFilterRef = useRef(false);
  // Mirror of the server item count for stale-closure-free error handling
  // (runSearch must not depend on the serverItems array identity).
  const serverItemsCountRef = useRef(initialData?.recipes.length ?? 0);
  const commitServerItems = useCallback((next: Recipe[]) => {
    serverItemsCountRef.current = next.length;
    setServerItems(next);
  }, []);

  // If SWR / in-memory mirror was absent (cold launch without prefetch),
  // read the persistent AsyncStorage mirror immediately:
  useEffect(() => {
    if (initialData != null || paramFilter) return;
    let cancelled = false;
    readMirroredBrowse()
      .then((mirrored) => {
        if (cancelled || !mirrored || mirrored.recipes.length === 0) return;
        // Only hydrate if we are still at 0 server items and no filter has been picked
        if (serverItemsCountRef.current === 0 && !hasServerQueryOrFilterRef.current) {
          commitServerItems(mirrored.recipes);
          setServerMeta({ current: mirrored.currentPage, last: mirrored.lastPage });
          setServerTotal(mirrored.total);
          setState("ready");
          setApplying(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialData, paramFilter, commitServerItems]);

  // Background continuation after a cold first-page seed: stream the remaining
  // seed pages into the cache, then reload the list if offline. Non-blocking on
  // purpose — if it fails mid-way we keep showing whatever already loaded.
  const continueSeedInBackground = useCallback(async () => {
    try {
      await seedCacheRemainingPages();
      if (offlineRef.current) {
        applyRecipes(await getCachedRecipeSummaries());
      }
    } catch (error) {
      console.warn("[RecipeReal] background seed continuation failed:", error);
    }
  }, [applyRecipes]);

  // Background refresh: light upsert (no step re-download) + reload from cache
  // when offline. The sweep runs through maybeSweepCache()'s single-flight/hourly
  // guard so Home and Browse never fire duplicate multi-page sweeps at startup.
  const refreshInBackground = useCallback(async () => {
    try {
      await maybeSweepCache();
      if (offlineRef.current) {
        applyRecipes(await getCachedRecipeSummaries());
      }
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
      const ids = await getFavoriteIds();
      setFavoriteIds((prev) => (setMatchesIds(prev, ids) ? prev : new Set(ids)));
    } catch (error) {
      console.warn("[RecipeReal] loading favorites failed:", error);
    }
  }, []);

  // Reload the noted-recipe id set from SQLite. Same cadence as the favorites
  // reload (mount + focus), so notes saved/cleared on the detail screen are
  // reflected in the card badges as soon as the user returns. Best-effort.
  const reloadNoteIds = useCallback(async () => {
    try {
      const ids = await getNotedRecipeIds();
      setNoteIds((prev) => (setMatchesIds(prev, ids) ? prev : new Set(ids)));
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
  const showFiltersRef = useRef(showFilters);
  useEffect(() => {
    showFiltersRef.current = showFilters;
  }, [showFilters]);
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (showFiltersRef.current) {
          setShowFilters(false);
        }
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
    if (scrollingRef.current || Date.now() - lastScrollTsRef.current < 300) {
      return;
    }
    router.push(`/recipe/${id}`);
  }, []);

  /**
   * Load recipes from the cache, seeding progressively on a cold cache.
   * The cached library backs the OFFLINE fallback (and favorites/cook mode);
   * the on-screen list itself is server-driven. Returns true when previously
   * cached data was shown (so the caller can decide whether a light
   * background refresh is worthwhile).
   */
  const loadFromCache = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      const silent = options?.silent === true;
      if (!silent && serverItemsCountRef.current === 0) {
        setState("loading");
        setErrorMessage(null);
      }
      try {
        const count = await countCachedRecipes();
        if (count === 0) {
          // Cold cache: seed just the first page (a fraction of the dataset) so
          // the fallback library exists quickly; the rest arrives in background.
          const first = await seedCacheFirstPage();
          if (offlineRef.current) {
            applyRecipes(first);
          }
          if (!silent || offlineRef.current) {
            setState("ready");
          }
          continueSeedInBackground();
          return false;
        }
        if (offlineRef.current) {
          applyRecipes(await getCachedRecipeSummaries());
        }
        if (!silent || offlineRef.current) {
          setState("ready");
        }
        return true;
      } catch (error) {
        console.warn("[RecipeReal] loadFromCache failed:", error);
        // The cache only backs the fallback — never blank a working server list.
        if (!silent && serverItemsCountRef.current === 0) {
          setErrorMessage(
            error instanceof Error ? error.message : t("common.loadFailedRecipes"),
          );
          setState("error");
        }
        return false;
      }
    },
    [continueSeedInBackground, applyRecipes, t],
  );

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
  const buildSearchParamsRef = useRef(buildSearchParams);
  useEffect(() => {
    buildSearchParamsRef.current = buildSearchParams;
    hasServerQueryOrFilterRef.current =
      search.trim().length > 0 ||
      filter.kind !== "all" ||
      timeMax != null ||
      sortMode !== "default";
  }, [buildSearchParams, search, filter.kind, timeMax, sortMode]);

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
  const runSearch = useCallback(
    async (options?: { bypassCache?: boolean }) => {
      const requestId = ++searchRequestIdRef.current;
      try {
        const result = await searchRecipes({
          ...buildSearchParamsRef.current(),
          page: 1,
          bypassCache: options?.bypassCache,
        });
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
            let cached = await getCachedRecipeSummaries();
            if (cached.length === 0) {
              const count = await countCachedRecipes();
              if (count === 0) {
                cached = await seedCacheFirstPage();
              } else {
                cached = await getCachedRecipeSummaries();
              }
            }
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
    },
    [commitServerItems, applyRecipes, t],
  );

  /**
   * Server-driven search: initial mount and discrete chip/filter/sort taps
   * fire immediately; only typing in `search` debounces 350ms. Chip-style
   * filter changes flash the skeleton immediately (instant visual
   * acknowledgment); typing keeps the current results until the new page lands.
   */
  const serverFilterKey = `${filter.kind === "category" ? `cat:${filter.id}` : filter.kind}|${timeMax ?? ""}|${sortMode}`;
  const prevServerFilterKeyRef = useRef<string | null>(null);
  const prevSearchRef = useRef<string>(search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (offline) return; // Local pipeline owns the screen while offline.
    const isFilterChange =
      serverFilterKey !== prevServerFilterKeyRef.current &&
      prevServerFilterKeyRef.current != null;
    if (isFilterChange) {
      setApplying(true);
    }
    prevServerFilterKeyRef.current = serverFilterKey;

    const searchChanged = search !== prevSearchRef.current;
    prevSearchRef.current = search;

    if (searchDebounceRef.current != null) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (searchChanged) {
      searchDebounceRef.current = setTimeout(() => {
        searchDebounceRef.current = null;
        runSearch({ bypassCache: true }).catch((error) => {
          console.warn("[RecipeReal] search effect failed:", error);
        });
      }, SEARCH_DEBOUNCE_MS);
    } else {
      runSearch({ bypassCache: isFilterChange }).catch((error) => {
        console.warn("[RecipeReal] search effect failed:", error);
      });
    }

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
    searchRecipes({
      ...buildSearchParamsRef.current(),
      page: serverMeta.current + 1,
    })
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
  }, [offline, serverMeta]);

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

    // Move heavy SQLite cache checking, seed continuation, and repair behind
    // interactions so the initial Browse mount never competes with SQLite writes
    // or seed downloads.
    const task = InteractionManager.runAfterInteractions(() => {
      loadFromCache({ silent: true }).then((hadCachedData) => {
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
                if (offlineRef.current) {
                  applyRecipes(await getCachedRecipeSummaries());
                }
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
    });

    return () => {
      task.cancel();
    };
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
    try {
      if (!offline) {
        // FAST: one API request re-running the CURRENT query, bypassing SWR cache.
        await runSearch({ bypassCache: true });
      } else {
        // INSTANT: reload the local fallback source from SQLite.
        applyRecipes(await getCachedRecipeSummaries());
      }
    } catch (error) {
      console.warn("[RecipeReal] pull-to-refresh failed:", error);
    } finally {
      spinnerDone();
    }
    // The SLOW multi-page light cache sweep continues WITHOUT the spinner.
    refreshInBackground().catch(() => {
      // Best-effort background work.
    });
  }, [offline, runSearch, refreshInBackground, applyRecipes]);

  const handleRetry = useCallback(async () => {
    // Error state: retry the cache pipeline; the debounced search effect
    // picks the server list back up once the cache resolves.
    await loadFromCache();
    void runSearch({ bypassCache: true });
  }, [loadFromCache, runSearch]);

  // Quick-time staleness: the detail screen flags a fresh submit; on the next
  // focus, re-run the server search once (silently) so the grid reflects the
  // recomputed community averages. The flag is consume-once (no TTL — a
  // submit 10 minutes ago is still newer than the grid painted before it)
  // and cleared regardless.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(QUICK_TIME_STALE_KEY)
        .then((raw) => {
          if (raw == null) return;
          AsyncStorage.removeItem(QUICK_TIME_STALE_KEY).catch(() => {});
          if (!offline) {
            runSearch({ bypassCache: true }).catch(() => {
              // Best-effort background work.
            });
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

  const activeFilterChips = useMemo(() => {
    const out: {
      key: string;
      label: string;
      onClear: () => void;
    }[] = [];
    if (filter.kind === "category") {
      out.push({
        key: "cat",
        label: filter.label,
        onClear: () => setFilter({ kind: "all" }),
      });
    } else if (filter.kind === "quick") {
      out.push({
        key: "quick",
        label: t("filter.under30"),
        onClear: () => setFilter({ kind: "all" }),
      });
    }
    if (timeMax != null) {
      const option = TIME_FILTERS.find((o) => o.max === timeMax);
      out.push({
        key: "time",
        label: option ? t(option.labelKey) : fmtMinutes(timeMax),
        onClear: () => setTimeMax(null),
      });
    }
    return out;
  }, [filter, timeMax, t]);

  const showSkeletons =
    (state === "loading" && recipes.length === 0) ||
    (state === "ready" && applying);

  const handleCreate = useCallback(() => router.push("/recipe-composer"), []);

  const [headerHeight, setHeaderHeight] = useState(0);
  const handleHeaderLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = Math.round(e.nativeEvent.layout.height);
      setHeaderHeight((prev) => (prev === h ? prev : h));
    },
    [],
  );

  const cellHeight = useMemo(
    () => Math.round(((width - Space.sm) / 2) * (4 / 3)) + Space.sm,
    [width],
  );
  const getItemLayout = useCallback(
    (_data: ArrayLike<Recipe> | null | undefined, index: number) => ({
      length: cellHeight,
      offset: barPad + headerHeight + Space.sm + cellHeight * index,
      index,
    }),
    [barPad, cellHeight, headerHeight],
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      { paddingTop: barPad, paddingBottom: chromeBottomPad },
    ],
    [styles.listContent, barPad, chromeBottomPad],
  );

  // Everything below the pinned bar scrolls TOGETHER: big title, search,
  // category chips, offline banner, active-filter chips. Nothing is pinned
  // between the bar and the title (v1 put the chips there — felt like a gap).
  const headerBlock = useMemo(
    () => (
      <View onLayout={handleHeaderLayout}>
        <SearchBar
          search={search}
          onChangeSearch={setSearch}
          showFilters={showFilters}
          onToggleFilters={toggleFilters}
          hasAdvancedFilters={hasAdvancedFilters}
          onCreate={handleCreate}
          inputRef={searchInputRef}
          colors={colors}
          styles={styles}
        />
        {state === "ready" ? (
          <ChipRow
            chips={chips}
            filter={filter}
            onSelect={handleSelectFilter}
            styles={styles}
          />
        ) : null}
        {state === "ready" && offline ? (
          <View style={styles.offlineBannerWrap}>
            <Chip tone="amber" size="sm" label={t("browse.offlineCaption")} />
          </View>
        ) : null}
        {state === "ready" && activeFilterChips.length > 0 ? (
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
        ) : null}
      </View>
    ),
    [
      handleHeaderLayout,
      search,
      showFilters,
      toggleFilters,
      hasAdvancedFilters,
      handleCreate,
      colors,
      styles,
      state,
      chips,
      filter,
      handleSelectFilter,
      offline,
      t,
      activeFilterChips,
    ],
  );

  const emptyComponent = useMemo(
    () => (
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
    ),
    [
      styles,
      hasActiveFilters,
      search,
      t,
      displayRecipes.length,
      offline,
      recipes.length,
      serverTotal,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Full-bleed scroller: the FlatList owns the WHOLE screen and the
          top padding lives on the SCROLL CONTENT — a static padded wrapper
          here is what left a dead band at the top while scrolled (content
          could never fill the space the bar vacates). Non-list states
          (skeleton/error) use a padded wrapper since they don't scroll. */}
      {state === "ready" && !applying ? (
        <FlatList
          data={displayRecipes}
          keyExtractor={recipeKeyExtractor}
          renderItem={renderItem}
          getItemLayout={headerHeight > 0 ? getItemLayout : undefined}
          numColumns={2}
          style={FLEX_ONE_STYLE}
          contentContainerStyle={listContentStyle}
          columnWrapperStyle={COLUMN_WRAPPER_STYLE}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={80}
          removeClippedSubviews
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onScroll={handleBrowseScroll}
          onScrollBeginDrag={markScrolling}
          onScrollEndDrag={markScrolling}
          onMomentumScrollBegin={markScrolling}
          onMomentumScrollEnd={markScrolling}
          scrollEventThrottle={chrome.scrollEventThrottle}
          ListHeaderComponent={headerBlock}
          onEndReached={offline ? undefined : handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={offline ? null : ListFooter}
          ListEmptyComponent={emptyComponent}
        />
      ) : (
        <View style={{ flex: 1, paddingTop: barPad }}>
          {headerBlock}
          {showSkeletons && (
            <View style={styles.listContent}>
              {SKELETON_ROWS.map((row) => (
                <View key={`skel-row-${row}`} style={SKELETON_ROW_STYLE}>
                  <View style={styles.skeletonBlock} />
                  <View style={styles.skeletonBlock} />
                </View>
              ))}
            </View>
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
        </View>
      )}

      {/* Filter DROPDOWN: ephemeral overlay hanging below the bar — opening
          it no longer pushes the grid down. */}
      {state === "ready" && showFilters ? (
        <View
          style={[styles.filterPanelWrap, { top: barPad }]}
          pointerEvents="box-none"
        >
          <FilterPanel
            timeMax={timeMax}
            onTimeMaxChange={setTimeMax}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            onClearAll={handleClearAdvanced}
            onClose={toggleFilters}
            styles={styles}
          />
        </View>
      ) : null}

      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("tabs.browse")}
          hidden={chrome.hidden}
          rights={headerRights}
        />
      </View>
    </View>
  );
}
