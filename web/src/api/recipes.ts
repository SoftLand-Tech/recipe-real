/**
 * Recipe browse/search API + shared row normalizers — OWNED BY SLICE BROWSE.
 *
 * Ported from mobile's @/api/http.ts + client.ts (the wire contract):
 * wherever a helper would be identical to mobile's it lives HERE, never in
 * api/http.ts (foundation-owned). The web app is online-first, so mobile's
 * SQLite/AsyncStorage cache layers are intentionally NOT ported; a small
 * in-memory TTL cache covers the session for the server-cached category list.
 */
import { get } from "@/api/http";
import type {
  CategoryCount,
  CleanupFactors,
  Recipe,
  RecipePage,
  RecipeStep,
  RealityCheck,
  SearchParams,
} from "@/api/types";

// ---- Defensive normalizers (port of mobile @/api/http.ts) -------------------
// The backend serializes decimal columns as strings ("24.00") and may omit
// fields on partial dev payloads, so every numeric/array field is coerced.

/** Coerce a wire value to number|null (decimals arrive as strings). */
export const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Permissive row shape read from untyped JSON. */
type RawRow = { [key: string]: unknown };

/**
 * Parse an Arabic-content array field that may arrive as a raw JSON string
 * (how the API passes the DB json columns through) or an already-decoded
 * array. Anything else → null (English fallback).
 */
function parseArArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    return raw.every((x) => typeof x === "string") ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trimStart();
    if (trimmed.charCodeAt(0) === 91 /* '[' */) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
          ? parsed
          : null;
      } catch {
        // Malformed JSON string → English fallback.
        return null;
      }
    }
  }
  return null;
}

/** Normalize one recipe step defensively (minutes may serialize as strings). */
export function normalizeStep(raw: unknown): RecipeStep {
  const s = (raw ?? {}) as RawRow;
  return {
    ...(s as object),
    description: typeof s.description === "string" ? s.description : "",
    description_ar: s.description_ar == null ? null : String(s.description_ar),
    step_type: s.step_type != null ? String(s.step_type) : "active",
    publisher_minutes: toNum(s.publisher_minutes),
    community_minutes: toNum(s.community_minutes),
    literal_minutes: toNum(s.literal_minutes),
  } as RecipeStep;
}

/**
 * Normalize the reality-check block defensively: decimals may serialize as
 * strings, and a malformed/absent object must read as "unknown" (null) so the
 * badge simply stays hidden. Numeric holes collapse to 0 except gap_pct,
 * which keeps its null meaning ("no claim to compare against").
 */
function normalizeReality(v: unknown): RealityCheck | null {
  if (v == null || typeof v !== "object") return null;
  const r = v as RawRow;
  return {
    minutes: toNum(r.minutes) ?? 0,
    source: r.source === "estimate" ? "estimate" : "community",
    samples: toNum(r.samples) ?? 0,
    claimed_minutes: toNum(r.claimed_minutes) ?? 0,
    gap_minutes: toNum(r.gap_minutes) ?? 0,
    gap_pct: toNum(r.gap_pct),
  };
}

/** Cleanup-burden factors block (server always sends it on card rows). */
function normalizeCleanupFactors(v: unknown): CleanupFactors {
  const f = (v ?? {}) as RawRow;
  return {
    dish_count: toNum(f.dish_count),
    grease_level: f.grease_level == null ? null : String(f.grease_level),
    dishwasher_safe:
      f.dishwasher_safe == null ? null : Boolean(f.dishwasher_safe),
  };
}

/** Cooking-mode time-contract totals; null unless all three are usable. */
function normalizeTimeBlock(v: unknown): Recipe["time"] {
  if (v == null || typeof v !== "object") return null;
  const t = v as RawRow;
  const total = toNum(t.time_total_minutes);
  const active = toNum(t.time_active_minutes);
  const passive = toNum(t.time_passive_minutes);
  if (total == null || active == null || passive == null) return null;
  return {
    time_total_minutes: total,
    time_active_minutes: active,
    time_passive_minutes: passive,
  };
}

/**
 * Normalize one recipe row defensively (search pages, home rails, reality
 * rows, detail). Arabic-only user recipes keep title "" and rely on the
 * localized-title getter (see localizedTitle) for display. Card rows never
 * ship `steps`/`recipe_steps`, so those default to [] rather than undefined.
 */
export function normalizeRecipe(raw: unknown): Recipe {
  const r = (raw ?? {}) as RawRow;
  const factors = r.cleanup_factors;
  const stepsRaw = r.recipe_steps;
  return {
    id: toNum(r.id) ?? 0,
    title: typeof r.title === "string" ? r.title : "",
    source_url: typeof r.source_url === "string" ? r.source_url : null,
    image_url:
      r.image_url != null && String(r.image_url).trim() !== ""
        ? String(r.image_url).trim()
        : null,
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients.filter((x): x is string => typeof x === "string")
      : [],
    steps: Array.isArray(r.steps)
      ? r.steps.filter((x): x is string => typeof x === "string")
      : [],
    title_ar: r.title_ar == null ? null : String(r.title_ar),
    ingredients_ar: parseArArray(r.ingredients_ar),
    steps_ar: parseArArray(r.steps_ar),
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    servings: toNum(r.servings),
    prep_time_minutes: toNum(r.prep_time_minutes),
    cook_time_minutes: toNum(r.cook_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
    cleanup_estimate_minutes: toNum(r.cleanup_estimate_minutes),
    ...(factors != null ? { cleanup_factors: normalizeCleanupFactors(factors) } : {}),
    reality: normalizeReality(r.reality),
    time: normalizeTimeBlock(r.time),
    aggregated_rating: toNum(r.aggregated_rating),
    review_count: toNum(r.review_count),
    category: r.category != null ? String(r.category) : null,
    keywords: Array.isArray(r.keywords)
      ? r.keywords.filter((x): x is string => typeof x === "string")
      : null,
    description: r.description == null ? null : String(r.description),
    calories: toNum(r.calories),
    protein_g: toNum(r.protein_g),
    fat_g: toNum(r.fat_g),
    owner_id: r.owner_id == null ? null : toNum(r.owner_id),
    source_type: r.source_type != null ? String(r.source_type) : null,
    ...(Array.isArray(stepsRaw) ? { recipe_steps: stepsRaw.map(normalizeStep) } : {}),
  };
}

// ---- Laravel paginator envelope ----------------------------------------------

/** Defensive paginator payload shape (meta may be missing/odd). */
interface PagedRecipesResponse {
  data?: unknown;
  meta?: {
    current_page?: unknown;
    last_page?: unknown;
    total?: unknown;
  };
}

/** Coerce an unknown paginator field to a positive integer, else null. */
function toPositiveInt(v: unknown): number | null {
  const n = toNum(v);
  return n != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Normalize a paginator payload into a RecipePage. When `meta` is missing,
 * estimate: a short page means we're on the last one (mirrors mobile).
 */
function normalizePage(
  payload: PagedRecipesResponse | undefined,
  page: number,
  perPage: number,
): RecipePage {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const recipes = rows.map(normalizeRecipe);
  const meta = payload?.meta;
  const metaLast = toPositiveInt(meta?.last_page);
  const metaTotal = toNum(meta?.total);

  return {
    recipes,
    currentPage: toPositiveInt(meta?.current_page) ?? page,
    lastPage: metaLast ?? (recipes.length < perPage ? page : page + 1),
    total: metaTotal != null && metaTotal >= 0 ? metaTotal : recipes.length,
  };
}

// ---- Public search endpoint (GET /recipes/search) -----------------------------

/** Page size for the server-driven browse list (server clamps to 1..50). */
export const SEARCH_PER_PAGE = 20;

/**
 * One page of LIGHT recipe rows from the public search endpoint. `per_page`
 * is clamped server-side to 1..50 (default 20); `sort` must be one of
 * relevance|top_rated|fastest|most_loved (the server defaults to relevance
 * when `q` is present, else top_rated). Param names mirror mobile exactly
 * (q / category / max_time / sort / page / per_page).
 */
export async function fetchSearchPage(
  query: SearchParams = {},
): Promise<RecipePage> {
  const page = query.page ?? 1;
  const perPage = query.perPage ?? SEARCH_PER_PAGE;
  const data = await get<PagedRecipesResponse>("/recipes/search", {
    params: {
      ...(query.q ? { q: query.q } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.maxTime != null ? { max_time: query.maxTime } : {}),
      ...(query.sort ? { sort: query.sort } : {}),
      page,
      per_page: perPage,
    },
  });
  return normalizePage(data, page, perPage);
}

// ---- Category chips (GET /recipes/categories) ---------------------------------

/** Session-local staleness window for the category chips (server caches 1h). */
const CATEGORIES_TTL_MS = 60 * 60 * 1000;
let categoriesCache: { at: number; rows: CategoryCount[] } | null = null;

/** Defensive CategoryCount row filter (never trust a partial dev payload). */
function validCategoryRows(rows: unknown): CategoryCount[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const c = (row ?? {}) as RawRow;
      return {
        category:
          typeof c.category === "string" ? c.category.trim() : "",
        count: toNum(c.count) ?? 0,
      };
    })
    .filter((c) => c.category.length > 0);
}

/**
 * Top real recipe categories with counts (GET /api/recipes/categories).
 * Served from a 1-hour server cache; mirrored in-memory for the session.
 * Any failure (or empty response) resolves to the last known rows or an
 * empty array so callers can fall back silently — mirrors mobile.
 */
export async function fetchCategories(): Promise<CategoryCount[]> {
  if (categoriesCache && Date.now() - categoriesCache.at < CATEGORIES_TTL_MS) {
    return categoriesCache.rows;
  }
  try {
    const data = await get<{ data?: unknown }>("/recipes/categories");
    const rows = validCategoryRows(data?.data);
    if (rows.length > 0) {
      categoriesCache = { at: Date.now(), rows };
      return rows;
    }
  } catch {
    // Offline / server error: fall through to stale-or-empty (callers hide
    // the chips rather than failing the page).
  }
  return categoriesCache?.rows ?? [];
}

// ---- Fridge ingredient filter (the signature feature) -------------------------
// Ported from mobile browse.tsx: staple IDs resolve to their singular
// English stem (matching the server's FTS prefix queries for every recipe);
// custom items pass through verbatim. The selected items become a single
// space-joined `q` on the search endpoint — recipes containing ALL of them
// rank first.

/** Bilingual pantry/fridge staples for quick ingredient filtering. */
export const FRIDGE_STAPLES = [
  { id: "chicken", en: "chicken", ar: "دجاج", labelKey: "browse.ingChicken" },
  { id: "rice", en: "rice", ar: "أرز", labelKey: "browse.ingRice" },
  { id: "beef", en: "beef", ar: "لحم", labelKey: "browse.ingBeef" },
  { id: "eggs", en: "egg", ar: "بيض", labelKey: "browse.ingEggs" },
  { id: "pasta", en: "pasta", ar: "معكرونة", labelKey: "browse.ingPasta" },
  { id: "potato", en: "potato", ar: "بطاطس", labelKey: "browse.ingPotato" },
  { id: "tomato", en: "tomato", ar: "طماطم", labelKey: "browse.ingTomato" },
  { id: "lentils", en: "lentil", ar: "عدس", labelKey: "browse.ingLentils" },
] as const;

/** Maximum simultaneously selected fridge ingredients (mobile parity). */
export const MAX_FRIDGE_ITEMS = 5;

const FRIDGE_STAPLE_MAP = new Map<string, (typeof FRIDGE_STAPLES)[number]>(
  FRIDGE_STAPLES.map((s) => [s.id, s]),
);

/** Normalize ingredient text: lowercase, strip Arabic diacritics/tatweel,
 *  unify alef/yaa/taa variants — so "دجاج" matches "دَجاج" etc. */
export function normalizeFridgeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map fridge filter entries to search tokens: staple IDs resolve to their
 * singular English stem, custom items pass through verbatim (mobile parity).
 */
export function resolveFridgeSearchTokens(items: string[]): string[] {
  return items
    .map((item) => FRIDGE_STAPLE_MAP.get(item)?.en ?? item.trim())
    .filter((token) => token.length > 0);
}

/**
 * The single `q` sent to the search endpoint for a fridge selection
 * (space-joined tokens; the server's FTS prefix-matches all of them).
 */
export function fridgeQuery(items: string[]): string {
  return resolveFridgeSearchTokens(items).join(" ");
}

/** Whether a fridge entry is one of the known staples. */
export function isFridgeStaple(item: string): boolean {
  return FRIDGE_STAPLE_MAP.has(item);
}

/** The staple row for an id, if any (for localized labels). */
export function fridgeStaple(
  item: string,
): (typeof FRIDGE_STAPLES)[number] | undefined {
  return FRIDGE_STAPLE_MAP.get(item);
}

// ---- Time helpers (port of mobile utils/recipeTime.ts) -------------------------

/**
 * Best-known total cook minutes for FILTERING/SORTING: community consensus,
 * else the publisher claim. (The server's max_time filter additionally
 * COALESCEs reality_minutes ahead of these; this client helper covers the
 * card/badge glance, not filter parity.)
 */
export function recipeMinutes(recipe: Recipe | null): number | null {
  return recipe?.community_avg_minutes ?? recipe?.publisher_time_minutes ?? null;
}

/**
 * Best-known total cook minutes for DISPLAY: the Reality Index figure when
 * the backend maintains one (real cook sessions or an AI estimate), else the
 * community consensus, else the publisher claim. The single "what does this
 * recipe really take?" number every card leads with.
 */
export function bestMinutes(recipe: Recipe | null): number | null {
  return recipe?.reality?.minutes ?? recipeMinutes(recipe);
}

// ---- Localized display helpers --------------------------------------------------

/**
 * Localized recipe title (port of mobile's useLocalizedRecipe().title):
 * Arabic UI prefers title_ar with title fallback (user recipes may be
 * Arabic-only); English UI prefers title with title_ar fallback.
 */
export function localizedTitle(
  recipe: Pick<Recipe, "title" | "title_ar"> | null | undefined,
  lang: string,
): string {
  if (recipe == null) return "";
  return lang === "ar"
    ? (recipe.title_ar ?? recipe.title ?? "")
    : (recipe.title ?? recipe.title_ar ?? "");
}
