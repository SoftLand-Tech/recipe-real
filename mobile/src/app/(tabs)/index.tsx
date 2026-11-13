import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PinnedHeaderBar,
  useChromeContentBottomPad,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";

import {
  fetchCategories,
  fetchHomeRails,
  fetchRealityRail,
  getCookSessions,
  hasToken,
  searchRecipes,
} from "@/api/client";
import { writeMirroredBrowse } from "@/utils/browseMirror";
import { track } from "@/analytics";
import {
  countCachedRecipes,
  flushPendingCookSessions,
  getCachedRecipeSummaries,
  getFavoriteIds,
  getNotedRecipeIds,
  refreshPaceCalibrations,
  repairCachedStepsIfNeeded,
  seedCacheFirstPage,
  seedCacheRemainingPages,
  AUTO_SEED_PAGES,
  toggleFavorite,
  upsertRecipes,
} from "@/db/database";
import type { CookSessionSummary, HomeRails, Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Button,
  Card,
  Chip,
  HeartButton,
  HeroImage,
  NoteBadge,
  SectionHeader,
  SkeletonCard,
  TimeChip,
  fmtMinutes,
  useHeaderActionsRights,} from "@/components/ui";
import { CATEGORIES } from "@/utils/categorize";
import { localizedCategory } from "@/utils/categories";
import { bestMinutes } from "@/utils/recipeTime";
import { maybeSweepCache } from "@/utils/cacheSweep";

type LoadState = "loading" | "ready" | "error";

/** Cards per curated rail. */
const RAIL_SIZE = 10;

/** Craving chips rendered in the "Browse by craving" rail. */
const CRAVING_CHIP_LIMIT = 12;

/** Cards in the "Recently cooked" rail (start of the session history). */
const RECENTLY_COOKED_LIMIT = 6;

/** AsyncStorage mirror of the last successful /api/home payload for instant paint. */
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
 * Maximum time (in ms) to wait for initial server rails when AsyncStorage has
 * no mirror (first launch) before falling back to rendering the offline SQLite cache.
 * Avoids hanging on skeletons during flaky network conditions up to the 15s axios timeout.
 */
const RAILS_DEADLINE_MS = 2500;

/**
 * Extra delay (after the first interactions settle) before the deferred
 * auth-backed loads fire — keeps the pace calibration rewrite and the
 * cook-session fetch out of the first-paint burst entirely.
 */
const DEFERRED_AUTH_DATA_DELAY_MS = 800;

function setMatchesIds(prev: Set<number>, ids: number[]): boolean {
  if (prev.size !== ids.length) return false;
  for (let i = 0; i < ids.length; i++) {
    if (!prev.has(ids[i])) return false;
  }
  return true;
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

/** 1-based day of the year — drives the deterministic daily featured pick. */
function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/** Relative-date caption ("2d ago") over the shared rel.* keys. */
function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("rel.now");
  if (mins < 60) return t("rel.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("rel.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("rel.daysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("rel.weeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("rel.monthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Photo-first home: rails/featured only ever show recipes with an image. */
function hasPhoto(recipe: Recipe): boolean {
  return (
    typeof recipe.image_url === "string" && recipe.image_url.trim().length > 0
  );
}

/**
 * Cook-session rows carry only a light recipe reference (id/title/image). Wrap
 * one as a minimal Recipe so the "Recently cooked" rail reuses HomeCard.
 */
function sessionRecipe(session: CookSessionSummary): Recipe {
  return {
    id: session.recipe.id,
    title: session.recipe.title ?? "",
    source_url: null,
    image_url: session.recipe.image_url ?? null,
    ingredients: [],
    steps: [],
    publisher_time_minutes: null,
    community_avg_minutes: session.recipe.community_avg_minutes ?? null,
    cleanup_avg_minutes: null,
  };
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const t = useT();
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const barPad = usePinnedBarPad();
  const headerRights = useHeaderActionsRights();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Server-driven rails (GET /api/home, 30-min versioned server cache —
  // any timing write bumps the version, so reads after a cook are fresh).
  // The LAST successful payload is also mirrored to AsyncStorage, so the
  // instant first paint shows the SAME rails the server will refresh — the
  // old flow painted client-computed rails from the recipe cache first,
  // then swapped to different server rails when loaded ("recipes changed!").
  const [serverRails, setServerRails] = useState<HomeRails | null>(null);

  // Tracks whether the initial server rails fetch has settled (loaded, failed, or timed out).
  // When no AsyncStorage mirror exists (cold start), skeletons show until this settles
  // to prevent flashing the offline "Top picks" layout for ~0.5s before server rails arrive.
  const [initialRailsSettled, setInitialRailsSettled] = useState(false);

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

  // Ids of favorited recipes — drives the featured hero's heart overlay.
  // Same cadence as noteIds (mount + focus) so hearts stay in sync with
  // toggles made on Browse / the detail screen.
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  // "For your pace" gate: true only when the user has pace calibrations.
  const [hasPace, setHasPace] = useState(false);

  // Start of the signed-in user's cook-session history ("Recently cooked").
  // Null = signed out / fetch failed → the section hides entirely.
  const [recentSessions, setRecentSessions] = useState<
    CookSessionSummary[] | null
  >(null);

  const reloadNoteIds = useCallback(async () => {
    try {
      const ids = await getNotedRecipeIds();
      setNoteIds((prev) => (setMatchesIds(prev, ids) ? prev : new Set(ids)));
    } catch (error) {
      console.warn("[RecipeReal] home noted ids load failed:", error);
    }
  }, []);

  const reloadFavoriteIds = useCallback(async () => {
    try {
      const ids = await getFavoriteIds();
      setFavoriteIds((prev) => (setMatchesIds(prev, ids) ? prev : new Set(ids)));
    } catch (error) {
      console.warn("[RecipeReal] home favorites load failed:", error);
    }
  }, []);

  // "Recently cooked" data (cheap 10-row page). Extracted so both the
  // deferred mount load below and the focus effect share it.
  const reloadRecentSessions = useCallback(async () => {
    if (!(await hasToken())) {
      setRecentSessions((prev) => (prev === null ? prev : null));
      return;
    }
    try {
      const page = await getCookSessions({ maxPages: 1, perPage: 10 });
      setRecentSessions(page.data);
    } catch {
      setRecentSessions(null);
    }
  }, []);

  const didMountFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      reloadNoteIds();
      reloadFavoriteIds();
      if (!didMountFocusRef.current) {
        didMountFocusRef.current = true;
        return;
      }
      // Reload on subsequent focuses so a cook finished (or an offline queue
      // flushed) while Home was in the background appears in the rail on
      // return — mount-only left it invisible until a restart.
      void reloadRecentSessions();
    }, [reloadNoteIds, reloadFavoriteIds, reloadRecentSessions]),
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
        pinnedBar: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        },
        // Brand chip in the bar. The webp is pre-trimmed to the mark, whose
        // blob already carries its own rounding — a borderRadius here would
        // clip the yellow outline's corners. Explicit width AND height (no
        // aspectRatio reliance) so the chip can never render unconstrained.
        barLogo: {
          width: 46,
          height: 45,
          resizeMode: "contain",
        },
        center: {
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Space.lg,
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
          // Literal white on the accent pill — surface goes dark in dark mode.
          color: "#FFFFFF",
          fontWeight: "700",
        },
        skeletonCard: {
          width: 160,
        },
      }),
    [colors],
  );

  const serverRailsRef = useRef<HomeRails | null>(null);
  const initialRailsSettledRef = useRef(false);
  const recipesRef = useRef<Recipe[]>([]);
  useEffect(() => {
    serverRailsRef.current = serverRails;
    initialRailsSettledRef.current = initialRailsSettled;
    recipesRef.current = recipes;
  }, [serverRails, initialRailsSettled, recipes]);

  // ---- Curated rails (computed client-side over the cached recipes) --------

  // Deterministic daily rotation: the pseudo-random key shifts by one day at
  // a time, so the same library yields a different-but-stable top 10 per day.
  const topPicks = useMemo(() => {
    if (serverRails != null) return [];
    if (recipes.length === 0) return [];
    const todayIndex = Math.floor(Date.now() / 86_400_000);
    return [...recipes]
      .filter(hasPhoto)
      .sort(
        (a, b) =>
          ((a.id * 31 + todayIndex) % recipes.length) -
          ((b.id * 31 + todayIndex) % recipes.length),
      )
      .slice(0, RAIL_SIZE);
  }, [serverRails, recipes]);

  // Featured recipe of the day: deterministic pick (dayOfYear % length) from
  // the reality "most underestimated" rail, falling back to "Top rated", and
  // to the offline cached top picks when no server rails ever loaded (and initial
  // rails fetch has settled).
  const featured = useMemo(() => {
    if (serverRails == null && !initialRailsSettled) {
      return null;
    }
    const pool = (
      serverRails
        ? serverRails.most_underestimated.length > 0
          ? serverRails.most_underestimated
          : serverRails.top_rated
        : topPicks
    ).filter(hasPhoto);
    if (pool.length === 0) return null;
    return pool[dayOfYear() % pool.length];
  }, [serverRails, topPicks, initialRailsSettled]);

  // Track the featured impression once per shown recipe.
  const featuredTrackedRef = useRef<number | null>(null);
  useEffect(() => {
    if (featured == null || featuredTrackedRef.current === featured.id) return;
    featuredTrackedRef.current = featured.id;
    track("home_featured_viewed", { recipe_id: featured.id });
  }, [featured]);

  // Featured hero heart: toggle the local favorite and re-sync the snapshot.
  const handleToggleFavorite = useCallback(
    async (recipe: Recipe) => {
      try {
        // Full recipe: server rails may reference recipes the local cache
        // has never stored; the db layer caches a light copy on first heart.
        const favorited = await toggleFavorite(recipe);
        track("favorite_toggled", { recipe_id: recipe.id, favorited });
        await reloadFavoriteIds();
      } catch (error) {
        console.warn("[RecipeReal] home toggle favorite failed:", error);
      }
    },
    [reloadFavoriteIds],
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

  // Background continuation after a cold first-page seed: stream a CAPPED
  // starter set (~1k — fast first open, light on cellular data) into the
  // cache, then reload. The full library stays a manual Deep sync.
  // Non-blocking on purpose.
  const continueSeedInBackground = useCallback(async () => {
    try {
      await seedCacheRemainingPages({ pages: AUTO_SEED_PAGES });
      if (serverRailsRef.current == null) {
        setRecipesIfChanged(await getCachedRecipeSummaries(20));
      }
    } catch (error) {
      console.warn("[RecipeReal] home background seed continuation failed:", error);
    }
  }, [setRecipesIfChanged]);

  // Background refresh: light upsert (no step re-download) + reload from
  // cache. Routed through maybeSweepCache so Home and Browse share a
  // single-flight, at-most-once-an-hour sweep instead of competing.
  const refreshInBackground = useCallback(async () => {
    try {
      await maybeSweepCache();
      if (serverRailsRef.current == null) {
        setRecipesIfChanged(await getCachedRecipeSummaries(20));
      }
    } catch (error) {
      // Background refresh failures are non-fatal.
      console.warn("[RecipeReal] home background refresh failed:", error);
    }
  }, [setRecipesIfChanged]);

  /**
   * Load the curated rails: starts GET /api/home + GET /api/reality (mode=under)
   * immediately in parallel with AsyncStorage.getItem(HOME_RAILS_KEY) — cached
   * rails paint first only if the network hasn't resolved yet. On failure/empty
   * payload the SAVED rails stay; only when nothing was ever saved do the
   * client-side cached rails render (offline cold start).
   */
  const loadRails = useCallback(async () => {
    let networkResolved = false;
    const networkPromise = Promise.all([
      fetchHomeRails(),
      fetchRealityRail(),
    ]);
    const savedPromise = AsyncStorage.getItem(HOME_RAILS_KEY)
      .then((saved) => {
        if (networkResolved || !saved) return;
        try {
          const parsed = JSON.parse(saved) as Partial<HomeRails>;
          const any =
            parsed.top_rated?.length ||
            parsed.easy_wins?.length ||
            parsed.most_loved?.length ||
            parsed.hands_off?.length ||
            parsed.most_underestimated?.length;
          if (any) {
            const nextRails = railsWithDefaults(parsed);
            serverRailsRef.current = nextRails;
            initialRailsSettledRef.current = true;
            setServerRails(nextRails);
            setInitialRailsSettled(true);
            track("home_rails_loaded", { source: "saved" });
          }
        } catch {
          // Corrupt/unreadable mirror — ignore, fetch fresh below.
        }
      })
      .catch(() => {
        // Corrupt/unreadable mirror — ignore.
      });

    // 2. Revalidate from the server (+ the reality rail in parallel).
    try {
      const [fetched, mostUnderestimated] = await networkPromise;
      networkResolved = true;
      const rails: HomeRails = { ...fetched, most_underestimated: mostUnderestimated };
      // Anything the user saw on Home is openable offline: mirror every rail
      // recipe into the local cache (light, no steps). This runs AFTER the
      // fetch resolves, outside any other serialized section — upsertRecipes
      // takes the write mutex itself. Deduped by id (rails overlap). An
      // all-empty payload dedupes to [] and upsertRecipes no-ops. Fire and
      // forget: a cache write failure must never disturb the rails paint.
      const seenRailIds = new Set<number>();
      const railRecipes = [
        ...rails.top_rated,
        ...rails.easy_wins,
        ...rails.most_loved,
        ...rails.hands_off,
        ...rails.most_underestimated,
      ].filter((r) => {
        if (seenRailIds.has(r.id)) return false;
        seenRailIds.add(r.id);
        return true;
      });
      upsertRecipes(railRecipes, { withSteps: false }).catch(() => {
        // Best-effort offline mirror.
      });
      const any =
        rails.top_rated.length > 0 ||
        rails.easy_wins.length > 0 ||
        rails.most_loved.length > 0 ||
        rails.hands_off.length > 0 ||
        rails.most_underestimated.length > 0;
      if (any) {
        serverRailsRef.current = rails;
        initialRailsSettledRef.current = true;
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
        setInitialRailsSettled(true);
        track("home_rails_loaded", { source: "server" });
        AsyncStorage.setItem(HOME_RAILS_KEY, JSON.stringify(rails)).catch(
          () => {
            // Mirror is best-effort.
          },
        );
        return;
      }
    } catch (error) {
      networkResolved = true;
      await savedPromise;
      // Offline / server error: keep whatever is on screen (saved rails
      // or the cached-recipe rails).
      console.warn("[RecipeReal] home rails fetch failed:", error);
      initialRailsSettledRef.current = true;
      setInitialRailsSettled(true);
      return;
    }
    // Server answered with an all-empty payload (no data yet anywhere):
    // clear to the cached rails.
    serverRailsRef.current = null;
    initialRailsSettledRef.current = true;
    setServerRails(null);
    setInitialRailsSettled(true);
    track("home_rails_loaded", { source: "cache" });
  }, []);

  // A quick-time submit on the recipe screen flags fresh averages; Home
  // loads its rails mount-only, so revalidate them on return when the flag
  // is present (consume-once — cleared whether or not the reload runs).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("recipereal.quickTimeStale")
        .then((raw) => {
          if (raw == null) return;
          AsyncStorage.removeItem("recipereal.quickTimeStale").catch(() => {});
          void loadRails().catch(() => {
            // Best-effort background work.
          });
        })
        .catch(() => {
          // Best-effort: a failed read just skips the re-sync.
        });
    }, [loadRails]),
  );

  const loadFromCache = useCallback(async (): Promise<boolean> => {
    // Stale-while-revalidate: keep the current rails on screen during a
    // reload; skeletons are only for a true cold start (nothing to show).
    if (recipesRef.current.length === 0) setState("loading");
    setErrorMessage(null);
    try {
      const count = await countCachedRecipes();
      if (count === 0) {
        // Cold cache: seed just the first page so the rails render quickly;
        // the remaining pages arrive in the background.
        const first = await seedCacheFirstPage();
        if (serverRailsRef.current == null) {
          setRecipes(first);
        }
        setState("ready");
        continueSeedInBackground();
        return false;
      }
      if (serverRailsRef.current == null && initialRailsSettledRef.current) {
        setRecipesIfChanged(await getCachedRecipeSummaries(20));
      }
      setState("ready");
      return true;
    } catch (error) {
      console.warn("[RecipeReal] home loadFromCache failed:", error);
      // Localized copy only — a raw error.message would be English in the
      // Arabic UI ("Network Error").
      setErrorMessage(t("common.loadFailedRecipes"));
      setState("error");
      return false;
    }
  }, [continueSeedInBackground, setRecipesIfChanged, t]);

  // Fallback summaries load: only runs if server rails settled as null (offline
  // or empty server payload) and recipes haven't been loaded yet.
  useEffect(() => {
    if (
      serverRails == null &&
      initialRailsSettled &&
      recipesRef.current.length === 0
    ) {
      getCachedRecipeSummaries(20)
        .then((rows) => {
          if (serverRailsRef.current == null) {
            setRecipesIfChanged(rows);
            setState("ready");
          }
        })
        .catch(() => {
          // Best-effort offline fallback.
        });
    }
  }, [serverRails, initialRailsSettled, setRecipesIfChanged]);

  useEffect(() => {
    track("home_viewed");

    // Race initial server rails fetch against a short deadline to prevent hanging on skeletons.
    const deadlineTimer = setTimeout(() => {
      initialRailsSettledRef.current = true;
      setInitialRailsSettled(true);
    }, RAILS_DEADLINE_MS);

    // Server rails load in parallel with the cache (the cache also backs the
    // fallback rails, favorites, and cook mode).
    loadRails()
      .catch((error) => {
        console.warn("[RecipeReal] home rails load failed:", error);
      })
      .finally(() => {
        clearTimeout(deadlineTimer);
        initialRailsSettledRef.current = true;
        setInitialRailsSettled(true);
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
              if (serverRailsRef.current == null) {
                setRecipesIfChanged(await getCachedRecipeSummaries(20));
              }
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

    return () => {
      clearTimeout(deadlineTimer);
    };
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

  // "For your pace" gate + "Recently cooked" data: both auth-backed, both
  // degrade to hidden on any failure (401 included). DEFERRED past the first
  // paint (runAfterInteractions + a short delay): these feed conditional
  // sections that simply appear a beat later — nothing on screen (skeletons,
  // error or empty states) waits on them, so they must not compete with the
  // mount burst. The cook-session call is capped to a single 10-row page:
  // it only feeds the 6-item "Recently cooked" rail (Pace's own full-history
  // sweep lives in pace.tsx and is untouched).
  //
  // The sessions reload ALSO runs on every focus (see above): a cook
  // finished (or an offline queue flushed) while Home was in the background
  // must appear in the rail on return — mount-only left it invisible until
  // a restart.
  useEffect(() => {
    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      delayTimer = setTimeout(async () => {
        if (cancelled) return;
        if (!(await hasToken())) {
          if (!cancelled) {
            setHasPace(false);
            setRecentSessions(null);
          }
          return;
        }
        if (cancelled) return;
        refreshPaceCalibrations()
          .then((items) => {
            if (!cancelled) setHasPace(items.length > 0);
          })
          .catch(() => {
            if (!cancelled) setHasPace(false);
          });
        void reloadRecentSessions();
      }, DEFERRED_AUTH_DATA_DELAY_MS);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (delayTimer) clearTimeout(delayTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch Browse tab default page 1 + categories + warm images after interactions settle:
  useEffect(() => {
    if (!initialRailsSettled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      // 1. Silent prefetch of default searchRecipes({ page: 1 })
      searchRecipes({ page: 1 })
        .then((page) => {
          if (cancelled || !page?.recipes?.length) return;
          writeMirroredBrowse(page).catch(() => {});
          // 2. Warm top-6 image URLs via expo-image Image.prefetch (best-effort)
          const topImages = page.recipes
            .slice(0, 6)
            .map((r) => r.image_url)
            .filter(
              (url): url is string =>
                typeof url === "string" && url.trim().length > 0,
            );
          for (const url of topImages) {
            try {
              ExpoImage.prefetch(url);
            } catch {
              // Best-effort image prefetch
            }
          }
        })
        .catch(() => {
          // Best-effort prefetch
        });

      // 3. Prefetch fetchCategories()
      fetchCategories().catch(() => {});
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [initialRailsSettled]);

  // "Recently cooked": the first sessions as light pseudo-recipes plus a
  // relative-date caption per card (rel.* keys).
  const recentItems = useMemo(() => {
    const items: Recipe[] = [];
    const captions = new Map<number, string>();
    for (const session of recentSessions ?? []) {
      if (items.length >= RECENTLY_COOKED_LIMIT) break;
      if (session.recipe == null || !(session.recipe.id > 0)) continue;
      // Photo-first home: sessions whose recipe has no image stay in the
      // Pace history instead of breaking the rail with gray cards.
      if (session.recipe.image_url == null) continue;
      items.push(sessionRecipe(session));
      captions.set(session.recipe.id, relativeDate(t, session.created_at));
    }
    return { items, captions };
  }, [recentSessions, t]);

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
      // FAST primary work: the rails endpoint is server-cached (timing
      // writes bust it), so this lands quickly — the spinner clears the
      // moment it does.
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

  // Skeletons show when:
  // 1. Neither server rails nor cached recipes can paint anything yet (cold start).
  // 2. OR when server rails are not yet loaded and initial rails fetch has not settled
  //    (prevents flashing the offline cache layout for ~0.5s on first launch with empty mirror).
  const showSkeletons =
    serverRails == null &&
    (!initialRailsSettled || (state === "loading" && recipes.length === 0));

  const getRecentCaption = useCallback(
    (item: Recipe) => recentItems.captions.get(item.id),
    [recentItems.captions],
  );

  // "Recently cooked" rail: shared by both the server-rails and offline
  // layouts (it is auth-backed, not rails-backed), hidden when empty.
  const recentlyCookedRail =
    recentItems.items.length > 0 ? (
      <HomeRail
        title={t("home.recentlyCooked")}
        items={recentItems.items}
        noteIds={noteIds}
        captionFor={getRecentCaption}
      />
    ) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: barPad, paddingBottom: chromeBottomPad },
        ]}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >

        <HomeSearchEntry />

        {featured != null ? (
          <FeaturedHero
            recipe={featured}
            favorited={favoriteIds.has(featured.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : null}

        {showSkeletons && (
          <SkeletonRail />
        )}

        {state === "error" && serverRails == null && initialRailsSettled && (
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
          initialRailsSettled &&
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
          // Order: "Quick tonight" (easy wins) → "For your pace" (calibrated
          // users only) → "Recently cooked" (signed-in only) → the reality
          // leaderboard → cravings. All five rails are still FETCHED and
          // mirrored (payload shape untouched); top_rated serves as the
          // featured hero's fallback pool.
          <>
            <HomeRail
              title={t("home.quickTonight")}
              items={serverRails.easy_wins}
              noteIds={noteIds}
            />
            {hasPace && serverRails.most_loved.length > 0 ? (
              <HomeRail
                title={t("home.forYourPace")}
                subtitle={t("home.forYourPaceSub")}
                items={serverRails.most_loved}
                noteIds={noteIds}
              />
            ) : null}
            {recentlyCookedRail}
            {/* Reality leaderboard — hidden silently when the reality fetch
                failed (HomeRail renders null for empty items). */}
            <HomeRail
              title={t("home.realityRail")}
              subtitle={t("home.realityRailSub")}
              items={serverRails.most_underestimated ?? []}
              noteIds={noteIds}
            />
            <CategoryRail
              chips={cravingChips}
              onCategoryPress={handleCategoryPress}
            />
          </>
        ) : state === "ready" && recipes.length > 0 && initialRailsSettled ? (
          // ---- Fallback: rails computed over the offline cache ----
          <>
            <HomeRail title={t("home.topPicks")} items={topPicks} noteIds={noteIds} />
            {recentlyCookedRail}
            <CategoryRail
              chips={cravingChips}
              onCategoryPress={handleCategoryPress}
            />
          </>
        ) : null}
      </ScrollView>
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title="RecipeReal"
          titleContent={
            <Image
              source={require("../../../assets/images/recipereallogo.webp")}
              style={styles.barLogo}
              accessibilityLabel="RecipeReal"
            />
          }
          hidden={chrome.hidden}
          rights={headerRights}
        />
      </View>
    </View>
  );
}

// ---- Local building blocks --------------------------------------------------

/**
 * Tappable search entry — the first thing under the bar on Home. Lands in
 * Browse with the field focused. The bar carries the brand title, bell and
 * avatar, so this is the ONLY header-ish element left in the content.
 */
const HomeSearchEntry = memo(function HomeSearchEntry() {
  const colors = useThemeColors();
  const t = useT();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginHorizontal: Space.lg,
          marginBottom: Space.lg,
        },
        // Full-width tappable pill (44pt). Static style only (no function
        // styles on Pressables — Android paint rules).
        pill: {
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingHorizontal: Space.lg,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
        },
        glyph: {
          fontSize: 18,
          color: colors.inkFaint,
        },
        label: {
          ...Type.bodySm,
          color: colors.inkFaint,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="search"
        onPress={() => router.push("/browse?focus=1")}
        style={styles.pill}
      >
        <Text style={styles.glyph}>⌕</Text>
        <Text style={styles.label} numberOfLines={1}>
          {t("home.heroPrompt")}
        </Text>
      </Pressable>
    </View>
  );
});

/**
 * Featured recipe of the day — the centerpiece card. A deterministic daily
 * pick (chosen by the parent from the reality "most underestimated" rail,
 * with "Top rated" as fallback): 16:9 photo with the heart overlay, title,
 * the REAL total in huge timing teal, the active/passive/cleanup breakdown
 * chips (only when the row carries the time contract), the reality source
 * caption, and a "Start cooking" CTA. The whole card and the CTA both land
 * on the recipe detail screen (which owns the jump into Cook Mode).
 */
const FeaturedHero = memo(function FeaturedHero({
  recipe,
  favorited,
  onToggleFavorite,
}: {
  recipe: Recipe;
  favorited: boolean;
  onToggleFavorite: (recipe: Recipe) => void;
}) {
  const colors = useThemeColors();
  const t = useT();
  const lr = useLocalizedRecipe();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: Space.lg,
          marginBottom: Space.md,
          borderRadius: Radius.xl,
        },
        // 16:9 by aspect ratio: the style entry overrides HeroImage's
        // numeric height prop (later entries win in RN style arrays).
        heroImage: {
          height: undefined,
          aspectRatio: 16 / 9,
        },
        body: {
          padding: Space.lg,
          gap: Space.sm,
        },
        title: {
          ...Type.h2,
          color: colors.ink,
        },
        totalLabel: {
          ...Type.overline,
          color: colors.inkFaint,
        },
        // THE honest-time number: huge, and timing teal per the palette
        // contract (colors.timing for calibration info).
        totalValue: {
          ...Type.h1,
          color: colors.timing,
          fontWeight: "800",
        },
        breakdown: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.xs,
        },
        sourceCaption: {
          ...Type.caption,
          color: colors.inkFaint,
        },
      }),
    [colors],
  );

  // REAL total: the single best-known display figure (reality → community
  // → publisher), identical to the detail screen's "Really takes" stat.
  const total = bestMinutes(recipe);

  // Time-contract breakdown: rail rows usually ship no `time` block — then
  // the whole chips row hides. Only the values actually present render.
  const activeMin = recipe.time?.time_active_minutes ?? 0;
  const passiveMin = recipe.time?.time_passive_minutes ?? 0;
  const cleanupMin =
    recipe.cleanup_avg_minutes ?? recipe.cleanup_estimate_minutes ?? 0;

  return (
    <Card
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      padding={0}
      shadow="card"
      style={styles.card}
    >
      <View>
        <HeroImage
          uri={recipe.image_url}
          height={0}
          rounded={Radius.xl}
          style={styles.heroImage}
        />
        <HeartButton
          favorited={favorited}
          size="lg"
          onPress={() => onToggleFavorite(recipe)}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {lr.title(recipe)}
        </Text>
        {total != null ? (
          <View>
            <Text style={styles.totalLabel}>{t("detail.statReally")}</Text>
            <Text style={styles.totalValue}>{fmtMinutes(total)}</Text>
          </View>
        ) : null}
        {activeMin > 0 || passiveMin > 0 || cleanupMin > 0 ? (
          <View style={styles.breakdown}>
            {activeMin > 0 ? (
              <Chip
                tone="timing"
                size="sm"
                label={`${t("stepType.active")} ${fmtMinutes(activeMin)}`}
              />
            ) : null}
            {passiveMin > 0 ? (
              <Chip
                tone="neutral"
                size="sm"
                label={`${t("stepType.passive")} ${fmtMinutes(passiveMin)}`}
              />
            ) : null}
            {cleanupMin > 0 ? (
              <Chip
                tone="amber"
                size="sm"
                label={`${t("stepType.cleanup")} ${fmtMinutes(cleanupMin)}`}
              />
            ) : null}
          </View>
        ) : null}
        {recipe.reality != null ? (
          <Text style={styles.sourceCaption} numberOfLines={1}>
            {recipe.reality.source === "community"
              ? t("detail.realityFrom", { n: recipe.reality.samples })
              : t("detail.realityEstimate")}
          </Text>
        ) : null}
        <Button
          title={t("cook.startCooking")}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
        />
      </View>
    </Card>
  );
});

/**
 * "See all" header action for each rail: a quiet caption-toned pressable that
 * jumps to the Browse tab. Static style only (no function styles on
 * Pressables — see Android paint rules).
 */
const SeeAllAction = memo(function SeeAllAction() {
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
});

/** Compact rail card: hero image, 2-line title, time + rating chips. */
const HomeCard = memo(function HomeCard({
  item,
  hasNote,
  caption,
}: {
  item: Recipe;
  hasNote: boolean;
  /** Optional muted line under the title (e.g. "Cooked 2d ago"). */
  caption?: string;
}) {
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
        caption: {
          ...Type.caption,
          color: colors.inkFaint,
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
        {caption ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
        <View style={styles.chips}>
          <TimeChip
            minutes={bestMinutes(item)}
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
});

const railKeyExtractor = (item: Recipe) => String(item.id);
const getRailItemLayout = (
  _data: ArrayLike<Recipe> | null | undefined,
  index: number,
) => ({
  length: 160,
  offset: 172 * index,
  index,
});

const railStyles = StyleSheet.create({
  section: {
    marginBottom: Space.md,
  },
  sectionHeaderPad: {
    paddingHorizontal: Space.lg,
  },
  railContent: {
    paddingHorizontal: 0,
    gap: Space.md,
  },
  categoryContent: {
    paddingHorizontal: 0,
    gap: Space.sm,
    alignItems: "center",
  },
  skeletonCard: {
    width: 160,
  },
});

/** One curated rail: section header ("See all" → Browse) + horizontal cards. */
const HomeRail = memo(function HomeRail({
  title,
  subtitle,
  items,
  noteIds,
  captionFor,
}: {
  title: string;
  subtitle?: string;
  items: Recipe[];
  noteIds: Set<number>;
  /** Per-card muted caption (e.g. the "cooked when" line). */
  captionFor?: (item: Recipe) => string | undefined;
}) {
  const renderItem: ListRenderItem<Recipe> = useCallback(
    ({ item }) => (
      <HomeCard
        item={item}
        hasNote={noteIds.has(item.id)}
        caption={captionFor?.(item)}
      />
    ),
    [noteIds, captionFor],
  );

  if (items.length === 0) return null;
  return (
    <View style={railStyles.section}>
      <View style={railStyles.sectionHeaderPad}>
        <SectionHeader title={title} subtitle={subtitle} action={<SeeAllAction />} />
      </View>
      <FlatList
        horizontal
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        data={items}
        keyExtractor={railKeyExtractor}
        getItemLayout={getRailItemLayout}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={railStyles.railContent}
      />
    </View>
  );
});

/**
 * Category chips row — every craving is one tap away in Browse. The chips are
 * the REAL server categories when available (already capped to
 * CRAVING_CHIP_LIMIT by the parent); the local keyword categories render as
 * the offline fallback.
 */
const CategoryRail = memo(function CategoryRail({
  chips,
  onCategoryPress,
}: {
  chips: { id: string; label: string }[];
  onCategoryPress: (id: string, label: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  return (
    <View style={railStyles.section}>
      <View style={railStyles.sectionHeaderPad}>
        <SectionHeader title={t("home.browseByCraving")} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={railStyles.categoryContent}
      >
        {chips.map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => onCategoryPress(chip.id, chip.label)}
          >
            {/* Display-only localization: the chip's id (the ?filter= value)
                still carries the ORIGINAL English string for Browse matching. */}
            <Chip label={localizedCategory(chip.label, lang)} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

const SKELETON_ITEMS = [0, 1, 2, 3];
const skeletonKeyExtractor = (item: number) => `skel-${item}`;
const renderSkeletonItem = () => (
  <View style={railStyles.skeletonCard}>
    <SkeletonCard hasImage />
  </View>
);

/** Loading placeholder: four skeleton cards in a rail shape. */
const SkeletonRail = memo(function SkeletonRail() {
  const t = useT();
  return (
    <View style={railStyles.section}>
      <View style={railStyles.sectionHeaderPad}>
        <SectionHeader title={t("home.topPicks")} />
      </View>
      <FlatList
        horizontal
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        data={SKELETON_ITEMS}
        keyExtractor={skeletonKeyExtractor}
        renderItem={renderSkeletonItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={railStyles.railContent}
        scrollEnabled={false}
      />
    </View>
  );
});
