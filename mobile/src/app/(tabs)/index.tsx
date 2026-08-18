import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  fetchCategories,
  fetchHomeRails,
  fetchRealityRail,
  searchRecipes,
} from "@/api/client";
import { isOfflineError } from "@/api/http";
import { track } from "@/analytics";
import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipes,
  getNotedRecipeIds,
  refreshCacheLight,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
} from "@/db/database";
import type { HomeRails, Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Card,
  Chip,
  HeroImage,
  NoteBadge,
  SectionHeader,
  SkeletonCard,
  TimeChip,
} from "@/components/ui";
import { CATEGORIES } from "@/utils/categorize";
import { recipeMinutes } from "@/utils/recipeTime";

type LoadState = "loading" | "ready" | "error";

/** Cards per curated rail. */
const RAIL_SIZE = 10;

/** Craving chips rendered in the "Browse by craving" rail. */
const CRAVING_CHIP_LIMIT = 12;

/** Debounce for the hero's inline search before hitting the server. */
const HERO_SEARCH_DEBOUNCE_MS = 350;

/** Minimum trimmed chars before the hero search fires. */
const HERO_SEARCH_MIN_CHARS = 2;

/** Page size for the hero's inline search result row. */
const HERO_SEARCH_PER_PAGE = 8;

/** Snap interval of the hero results row: rail card width (160) + gutter. */
const HERO_SEARCH_SNAP_INTERVAL = 160 + Space.md;

/** Mirror of the last successful /api/home payload for instant paint. */
const HOME_RAILS_KEY = "recipereal.homeRails";

/** Rail-content fingerprint (per-rail recipe ids) for the no-op guard. */
function railsFingerprint(rails: HomeRails): string {
  return (
    [
      "top_rated",
      "easy_wins",
      "most_loved",
      "hands_off",
      "most_underestimated",
    ] as const
  )
    .map((rail) => (rails[rail] ?? []).map((r) => r.id).join(","))
    .join("|");
}

/**
 * Fill any rail missing from an older saved mirror (pre-reality payloads have
 * no `most_underestimated`) with an empty array so downstream readers never
 * see undefined.
 */
function railsWithDefaults(rails: Partial<HomeRails>): HomeRails {
  return {
    top_rated: rails.top_rated ?? [],
    easy_wins: rails.easy_wins ?? [],
    most_loved: rails.most_loved ?? [],
    hands_off: rails.hands_off ?? [],
    most_underestimated: rails.most_underestimated ?? [],
  };
}

/**
 * Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
 * whatever the network does (force-cleared by a setTimeout guard).
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

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
  const t = useT();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Server-driven rails (GET /api/home, 5-min server cache). The LAST
  // successful payload is also mirrored to AsyncStorage, so the instant
  // first paint shows the SAME rails the server will refresh — the old
  // flow painted client-computed rails from the recipe cache first, then
  // swapped to different server rails when loaded ("recipes changed!").
  const [serverRails, setServerRails] = useState<HomeRails | null>(null);

  // Server category chips for "Browse by craving" (GET /api/recipes/categories,
  // AsyncStorage-cached with a stale fallback in the client — same pattern as
  // Browse). Null until loaded → the local keyword categories render as the
  // offline fallback.
  const [serverChips, setServerChips] = useState<{
    id: string;
    label: string;
  }[] | null>(null);

  // Ids of recipes carrying a personal note — drives the pencil badge on the
  // rail cards. Purely local SQLite; loaded on mount and refreshed on focus so
  // notes saved on the detail screen badge the rails when the user returns.
  const [noteIds, setNoteIds] = useState<Set<number>>(new Set());

  const reloadNoteIds = useCallback(async () => {
    try {
      setNoteIds(new Set(await getNotedRecipeIds()));
    } catch (error) {
      console.warn("[RecipeReal] home noted ids load failed:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadNoteIds();
    }, [reloadNoteIds]),
  );

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

  // "Surprise me" pool: the first 10 of whichever top-rated rail is live
  // (the server rails when loaded, else the cached top picks) — the chip
  // stays disabled until this has entries.
  const surprisePool = useMemo(
    () =>
      (serverRails != null ? serverRails.top_rated : topPicks).slice(
        0,
        RAIL_SIZE,
      ),
    [serverRails, topPicks],
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

  /**
   * Load the curated rails: the last server payload from
   * AsyncStorage paints instantly (identical content to what the refresh
   * will bring), then GET /api/home revalidates while GET /api/reality
   * (mode=under) fills the "Most underestimated" rail in parallel — a reality
   * fetch failure simply leaves that rail empty (hidden). On failure/empty
   * payload the SAVED rails stay; only when nothing was ever saved do the
   * client-side cached rails render (offline cold start).
   */
  const loadRails = useCallback(async () => {
    // 1. Instant paint from the saved payload.
    try {
      const saved = await AsyncStorage.getItem(HOME_RAILS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<HomeRails>;
        const any =
          parsed.top_rated?.length ||
          parsed.easy_wins?.length ||
          parsed.most_loved?.length ||
          parsed.hands_off?.length ||
          parsed.most_underestimated?.length;
        if (any) {
          setServerRails(railsWithDefaults(parsed));
          track("home_rails_loaded", { source: "saved" });
        }
      }
    } catch {
      // Corrupt/unreadable mirror — ignore, fetch fresh below.
    }
    // 2. Revalidate from the server (+ the reality rail in parallel).
    try {
      const [fetched, mostUnderestimated] = await Promise.all([
        fetchHomeRails(),
        fetchRealityRail(),
      ]);
      const rails: HomeRails = { ...fetched, most_underestimated: mostUnderestimated };
      const any =
        rails.top_rated.length > 0 ||
        rails.easy_wins.length > 0 ||
        rails.most_loved.length > 0 ||
        rails.hands_off.length > 0 ||
        rails.most_underestimated.length > 0;
      if (any) {
        // No-op guard: when the payload carries the same recipe ids per
        // rail as what's on screen (saved mirror), skip the state update —
        // re-setting identical-looking objects still re-renders every card
        // and can flash image placeholders.
        setServerRails((current) => {
          if (current && railsFingerprint(current) === railsFingerprint(rails)) {
            return current;
          }
          return rails;
        });
        track("home_rails_loaded", { source: "server" });
        AsyncStorage.setItem(HOME_RAILS_KEY, JSON.stringify(rails)).catch(
          () => {
            // Mirror is best-effort.
          },
        );
        return;
      }
    } catch (error) {
      // Offline / server error: keep whatever is on screen (saved rails
      // or the cached-recipe rails).
      console.warn("[RecipeReal] home rails fetch failed:", error);
      return;
    }
    // Server answered with an all-empty payload (no data yet anywhere):
    // clear to the cached rails.
    setServerRails(null);
    track("home_rails_loaded", { source: "cache" });
  }, []);

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
        error instanceof Error ? error.message : t("common.loadFailedRecipes"),
      );
      setState("error");
      return false;
    }
  }, [continueSeedInBackground, recipes, setRecipesIfChanged, t]);

  useEffect(() => {
    track("home_viewed");
    // Server rails load in parallel with the cache (the cache also backs the
    // fallback rails, favorites, and cook mode).
    loadRails().catch((error) => {
      console.warn("[RecipeReal] home rails load failed:", error);
    });
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

  // Category chips from the server (real Food.com categories), loaded once per
  // mount. Empty/offline → the local keyword categories remain the fallback.
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

  const cravingChips = useMemo(() => {
    const source =
      serverChips ??
      CATEGORIES.map((c) => ({ id: c.id as string, label: t(`cat.${c.id}`) }));
    return source.slice(0, CRAVING_CHIP_LIMIT);
  }, [serverChips, t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Global safety: the spinner never outlives ~10s.
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    try {
      // FAST primary work: the rails endpoint is 5-min cached server-side, so
      // this lands quickly — the spinner clears the moment it does.
      await loadRails();
    } finally {
      clearTimeout(guard);
      setRefreshing(false);
    }
    // The SLOW multi-page light cache sweep continues WITHOUT the spinner.
    refreshInBackground().catch(() => {
      // Best-effort background work.
    });
  }, [loadRails, refreshInBackground]);

  // Category chips land in Browse ALREADY FILTERED: the `filter` param carries
  // the REAL category LABEL for server chips (their id IS the label, e.g.
  // "Chicken") or a local keyword id for the offline fallback ("pasta") —
  // Browse's param parsing accepts both and matches labels case-insensitively.
  const handleCategoryPress = useCallback((id: string, label: string) => {
    track("home_category_tapped", { category: id, label });
    router.push({ pathname: "/browse", params: { filter: id } });
  }, []);

  // Skeletons only when NEITHER the server rails nor the cached recipes can
  // paint anything yet (true cold start).
  const showSkeletons =
    serverRails == null && state === "loading" && recipes.length === 0;

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
        <HomeHero topRated={surprisePool} noteIds={noteIds} />

        {showSkeletons && (
          <SkeletonRail />
        )}

        {state === "error" && serverRails == null && (
          <View style={styles.center}>
            <Text style={styles.emptyGlyph}>🍲</Text>
            <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
            <Text style={styles.muted}>
              {errorMessage ?? t("common.couldNotLoadRecipes")}
            </Text>
            <Pressable style={styles.retry} onPress={loadFromCache}>
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        )}

        {state === "ready" &&
          serverRails == null &&
          recipes.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>🍳</Text>
              <Text style={styles.muted}>{t("common.emptyRecipes")}</Text>
              <Pressable style={styles.retry} onPress={loadFromCache}>
                <Text style={styles.retryText}>{t("common.retry")}</Text>
              </Pressable>
            </View>
          )}

        {serverRails != null ? (
          // ---- Server-driven rails (GET /api/home + reality rail) ----
          // DECLUTTERED: only three rails render — reality ("Most
          // underestimated"), "Top rated", and "Browse by craving". The
          // easy-wins / most-loved / hands-off rails are still FETCHED and
          // mirrored (the HomeRails payload shape is untouched); they are
          // simply not rendered (fewer choices on screen).
          <>
            {/* Reality rail first — hidden silently when the reality fetch
                failed (HomeRail renders null for empty items). */}
            <HomeRail
              title={t("home.realityRail")}
              subtitle={t("home.realityRailSub")}
              items={serverRails.most_underestimated ?? []}
              noteIds={noteIds}
            />
            <HomeRail
              title={t("home.railTopRated")}
              items={serverRails.top_rated}
              noteIds={noteIds}
            />
            <CategoryRail
              chips={cravingChips}
              onCategoryPress={handleCategoryPress}
            />
          </>
        ) : state === "ready" && recipes.length > 0 ? (
          // ---- Fallback: rails computed over the offline cache ----
          <>
            <HomeRail title={t("home.topPicks")} items={topPicks} noteIds={noteIds} />
            <CategoryRail
              chips={cravingChips}
              onCategoryPress={handleCategoryPress}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---- Local building blocks --------------------------------------------------

/**
 * The hero "what do you want to cook?" moment at the top of Home: headline,
 * a BIG live search field (debounced server search — results render as a
 * snap-scroll row of the SAME HomeCard the rails use, directly under the
 * field inside the panel), and quick filter chips that land in Browse
 * already filtered (same `filter` param contract as the craving chips).
 * The chips hide while search results are showing and return when the
 * field is cleared. Replaces the old ScreenHeader and carries the top
 * safe-area inset itself.
 */
function HomeHero({
  topRated,
  noteIds,
}: {
  topRated: Recipe[];
  noteIds: Set<number>;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  // Why the mini-search failed: offline (network) vs anything else — both
  // render a caption under the field, but offline says so.
  const [failed, setFailed] = useState<"offline" | "error" | null>(null);

  // Monotonic request id: only the LATEST debounced search may commit
  // state, so out-of-order responses never clobber newer results (same
  // stale-guard as Browse's search).
  const searchRequestIdRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Was ScreenHeader's job: top safe-area inset + page gutters so the
        // panel aligns with the rails below.
        wrap: {
          paddingTop: insets.top + Space.md,
          paddingHorizontal: Space.lg,
          marginBottom: Space.xxl,
        },
        panel: {
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: Space.xxl,
          gap: Space.lg,
        },
        headline: {
          ...Type.h2,
          color: colors.ink,
        },
        // BIG search-field look (same warm pill). Static styles only (no
        // function styles on Pressables — Android paint rules).
        searchField: {
          minHeight: 60,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingHorizontal: Space.xl,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        searchGlyph: {
          fontSize: 22,
          color: colors.inkFaint,
        },
        searchInput: {
          flex: 1,
          paddingVertical: Space.md,
          fontSize: Type.body.fontSize,
          color: colors.ink,
        },
        // Clear (✕) button at the END of the input; marginStart so the gap
        // follows the layout direction in RTL.
        searchClear: {
          marginStart: Space.xs,
        },
        searchClearGlyph: {
          fontSize: 16,
          color: colors.inkFaint,
        },
        // Muted caption under the field (no results / search failure).
        searchCaption: {
          ...Type.caption,
          color: colors.inkSecondary,
        },
        resultsContent: {
          gap: Space.md,
        },
        chips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
        },
        // Static enabled/disabled pair (no function styles on Pressables —
        // Android paint rules): the surprise chip dims until rails load.
        surpriseEnabled: {},
        surpriseDisabled: {
          opacity: 0.4,
        },
      }),
    [colors, insets.top],
  );

  // Debounced live search: ≥2 trimmed chars fires page 1 with a small
  // per_page (the row only needs a handful of cards) after 350ms. Clearing
  // the field resets the mini-search and brings the quick chips back.
  useEffect(() => {
    const q = query.trim();
    if (q.length < HERO_SEARCH_MIN_CHARS) {
      // Invalidate any in-flight request so a late response can't repopulate
      // results after the field was cleared.
      searchRequestIdRef.current++;
      if (searchDebounceRef.current != null) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      setResults([]);
      setFailed(null);
      setSearching(false);
      return;
    }
    if (searchDebounceRef.current != null) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      setSearching(true);
      track("home_search_performed", { query: q });
      const requestId = ++searchRequestIdRef.current;
      searchRecipes({ q, page: 1, perPage: HERO_SEARCH_PER_PAGE })
        .then((page) => {
          if (requestId !== searchRequestIdRef.current) return; // stale
          setResults(page.recipes);
          setFailed(null);
          setSearching(false);
        })
        .catch((error) => {
          if (requestId !== searchRequestIdRef.current) return; // stale
          console.warn("[RecipeReal] home hero search failed:", error);
          setResults([]);
          setFailed(isOfflineError(error) ? "offline" : "error");
          setSearching(false);
        });
    }, HERO_SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current != null) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [query]);

  // Active mini-search: results (or their captions) show and the quick
  // chips hide while the trimmed query is long enough to search.
  const searchActive = query.trim().length >= HERO_SEARCH_MIN_CHARS;

  const openQuick = useCallback((id: string) => {
    track("home_hero_chip_tapped", { filter: id });
    router.push({ pathname: "/browse", params: { filter: id } });
  }, []);

  // "Surprise me": jump to a random recipe from the ALREADY-LOADED
  // top-rated rail — no extra fetch, instant navigation.
  const surpriseReady = topRated.length > 0;
  const handleSurprise = useCallback(() => {
    if (topRated.length === 0) return;
    const pick = topRated[Math.floor(Math.random() * topRated.length)];
    track("home_surprise_tapped", { recipe_id: pick.id });
    router.push(`/recipe/${pick.id}`);
  }, [topRated]);

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Text style={styles.headline}>{t("home.heroPrompt")}</Text>
        <View style={styles.searchField}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t("browse.searchPlaceholder")}
            placeholderTextColor={colors.inkFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : null}
          {query.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => setQuery("")}
              accessibilityLabel={t("browse.clearSearch")}
              style={styles.searchClear}
            >
              <Text style={styles.searchClearGlyph}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        {searchActive ? (
          failed === "offline" ? (
            <Text style={styles.searchCaption}>
              {t("browse.offlineCaption")}
            </Text>
          ) : failed === "error" ? (
            <Text style={styles.searchCaption}>{t("home.noResultsMini")}</Text>
          ) : results.length > 0 ? (
            <FlatList
              horizontal
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <HomeCard item={item} hasNote={noteIds.has(item.id)} />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resultsContent}
              snapToInterval={HERO_SEARCH_SNAP_INTERVAL}
              decelerationRate="fast"
            />
          ) : !searching ? (
            <Text style={styles.searchCaption}>{t("home.noResultsMini")}</Text>
          ) : null
        ) : (
          <View style={styles.chips}>
            <Pressable hitSlop={4} onPress={() => openQuick("quick")}>
              <Chip tone="accent" label={t("filter.under30")} />
            </Pressable>
            <Pressable hitSlop={4} onPress={() => openQuick("pasta")}>
              <Chip tone="accent" label={t("cat.pasta")} />
            </Pressable>
            <Pressable hitSlop={4} onPress={() => openQuick("curry")}>
              <Chip tone="accent" label={t("cat.curry")} />
            </Pressable>
            <Pressable
              hitSlop={4}
              onPress={handleSurprise}
              disabled={!surpriseReady}
              style={
                surpriseReady
                  ? styles.surpriseEnabled
                  : styles.surpriseDisabled
              }
            >
              <Chip
                tone="timing"
                label={t("home.surprise")}
                icon={<Text>🎲</Text>}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * "See all" header action for each rail: a quiet caption-toned pressable that
 * jumps to the Browse tab. Static style only (no function styles on
 * Pressables — see Android paint rules).
 */
function SeeAllAction() {
  const colors = useThemeColors();
  const { dir } = useLang();
  const t = useT();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressable: {
          paddingVertical: Space.xs,
          // Extra hit area toward the section text (the reading start side):
          // paddingLeft/paddingRight don't flip, so pick per direction.
          ...(dir === "rtl"
            ? { paddingRight: Space.sm }
            : { paddingLeft: Space.sm }),
        },
        label: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "600",
        },
      }),
    [colors, dir],
  );
  return (
    <Pressable
      onPress={() => router.push("/browse")}
      hitSlop={8}
      style={styles.pressable}
    >
      <Text style={styles.label}>{t("common.seeAll")}</Text>
    </Pressable>
  );
}

/** Compact rail card: hero image, 2-line title, time + rating chips. */
function HomeCard({ item, hasNote }: { item: Recipe; hasNote: boolean }) {
  const colors = useThemeColors();
  const t = useT();
  const lr = useLocalizedRecipe();
  const { dir } = useLang();
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
        chips: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.xs,
        },
        // "+{gap}%" reality badge over the photo. Static style only (no
        // function styles — Android paint rules); anchored to the physical
        // top-end corner per direction so it never collides with the
        // top-start NoteBadge.
        realityChip: {
          position: "absolute",
          top: Space.sm,
          ...(dir === "rtl"
            ? { left: Space.sm }
            : { right: Space.sm }),
        },
      }),
    [colors, dir],
  );
  // Reality gap on the card corner: rounded, shown only when a gap was
  // computed (gap_pct is null when the recipe has no claimed time).
  const realityGap = item.reality?.gap_pct;
  return (
    <Card
      onPress={() => router.push(`/recipe/${item.id}`)}
      padding={0}
      shadow="card"
      style={styles.card}
    >
      <View>
        <HeroImage uri={item.image_url} height={110} rounded={Radius.lg} />
        <NoteBadge show={hasNote} />
        {realityGap != null ? (
          <View style={styles.realityChip} pointerEvents="none">
            {/* Timing info reads teal per the palette contract (colors.timing). */}
            <Chip
              tone="timing"
              size="sm"
              label={`+${Math.round(realityGap)}%`}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {lr.title(item)}
        </Text>
        <View style={styles.chips}>
          <TimeChip
            minutes={recipeMinutes(item)}
            label={t("common.focused")}
          />
          {item.aggregated_rating != null ? (
            <Chip
              tone="amber"
              size="sm"
              label={t("common.ratingChip", {
                rating: item.aggregated_rating.toFixed(1),
              })}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** One curated rail: section header ("See all" → Browse) + horizontal cards. */
function HomeRail({
  title,
  subtitle,
  items,
  noteIds,
}: {
  title: string;
  subtitle?: string;
  items: Recipe[];
  noteIds: Set<number>;
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
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HomeCard item={item} hasNote={noteIds.has(item.id)} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      />
    </View>
  );
}

/**
 * Category chips row — every craving is one tap away in Browse. The chips are
 * the REAL server categories when available (already capped to
 * CRAVING_CHIP_LIMIT by the parent); the local keyword categories render as
 * the offline fallback.
 */
function CategoryRail({
  chips,
  onCategoryPress,
}: {
  chips: { id: string; label: string }[];
  onCategoryPress: (id: string, label: string) => void;
}) {
  const t = useT();
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
        <SectionHeader title={t("home.browseByCraving")} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      >
        {chips.map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => onCategoryPress(chip.id, chip.label)}
          >
            <Chip label={chip.label} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Loading placeholder: four skeleton cards in a rail shape. */
function SkeletonRail() {
  const t = useT();
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
        <SectionHeader title={t("home.topPicks")} />
      </View>
      <FlatList
        horizontal
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
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
