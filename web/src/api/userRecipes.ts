/**
 * User-submitted recipe CRUD + composer support APIs — OWNED BY SLICE CREATE.
 *
 * Backend truth (UserRecipeController + RecipeController):
 *   POST   /api/recipes              create (halal-gated; 201 → RecipeResource)
 *   PATCH  /api/recipes/{id}         update (owner-only)
 *   DELETE /api/recipes/{id}         delete (owner-only; 204)
 *   GET    /api/users/me/recipes     own light rows, 12/page
 *   GET    /api/recipes/{id}         edit-mode prefill (public read)
 *   GET    /api/recipes/categories   category chips for the composer
 *
 * The categories helper lives HERE deliberately: api/recipes.ts belongs to
 * slice BROWSE (a stub until that slice lands) — importing from or editing
 * it would couple this slice to unfinished code / violate file ownership.
 *
 * Semantics ported from mobile/src/api/client.ts (createUserRecipe,
 * updateUserRecipe, deleteUserRecipe, fetchMyRecipes, fetchCategories) with
 * the web's axios helpers from @/api/http.
 */
import axios from "axios";

import { del, get, patch, post } from "@/api/http";
import type {
  CategoryCount,
  Paginated,
  Recipe,
  RecipeStep,
  UserRecipeInput,
} from "@/api/types";

/** Coerce a Laravel decimal/null field to a number (mobile's toNum). */
function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---- Halal gate ---------------------------------------------------------------

/**
 * Thrown when the server REJECTS user content (recipe or import publish)
 * because it contains non-halal terms. The 422 body is
 * `{message, terms: ["wine", ...]}` (or `{errors: {halal: [...]}}`) — the
 * offending terms are carried so the UI can surface them verbatim.
 */
export class HalalRejectionError extends Error {
  readonly terms: string[];

  constructor(terms: string[]) {
    super(`Blocked non-halal terms: ${terms.join(", ")}`);
    this.name = "HalalRejectionError";
    this.terms = terms;
  }
}

/** Extract the halal term list from a Laravel 422 `{terms}` / `{errors:{halal}}` body. */
function extractHalalTerms(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) {
    return null;
  }
  const body = error.response.data as
    | { errors?: Record<string, unknown>; terms?: unknown }
    | undefined;
  const halal = body?.errors?.halal ?? body?.terms;
  if (!Array.isArray(halal)) return null;
  const terms = halal.filter(
    (term): term is string => typeof term === "string" && term.length > 0,
  );
  return terms.length > 0 ? terms : null;
}

/** Run `fn`, converting a halal 422 into a HalalRejectionError. */
export async function rethrowHalal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

// ---- Row normalization ----------------------------------------------------------

function normalizeStep(row: unknown): RecipeStep {
  const s = (row ?? {}) as Record<string, unknown>;
  return {
    id: toNum(s.id) ?? 0,
    step_number: toNum(s.step_number) ?? 0,
    description: typeof s.description === "string" ? s.description : "",
    description_ar:
      typeof s.description_ar === "string" ? s.description_ar : null,
    step_type: typeof s.step_type === "string" ? s.step_type : "active",
    publisher_minutes: toNum(s.publisher_minutes),
    community_minutes: toNum(s.community_minutes),
    ai_minutes: toNum(s.ai_minutes),
    literal_minutes: toNum(s.literal_minutes),
  };
}

/**
 * Defensive normalization of a recipe row (mobile's normalizeRecipe, scoped
 * to the fields the composer + my-recipes list consume). Laravel may
 * serialize decimal columns as strings and the local dev DB may omit
 * metadata — never trust the wire shape.
 */
function normalizeRecipe(row: unknown): Recipe {
  const r = (row ?? {}) as Record<string, unknown>;
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const realityMinutes = toNum(r.reality_minutes);
  const realitySource =
    r.reality_source === "community" || r.reality_source === "estimate"
      ? r.reality_source
      : null;
  const recipe: Recipe = {
    id: toNum(r.id) ?? 0,
    title: typeof r.title === "string" ? r.title : "",
    title_ar: typeof r.title_ar === "string" ? r.title_ar : null,
    source_url: typeof r.source_url === "string" ? r.source_url : null,
    image_url: typeof r.image_url === "string" ? r.image_url : null,
    description: typeof r.description === "string" ? r.description : undefined,
    ingredients: strList(r.ingredients),
    ingredients_ar: r.ingredients_ar ? strList(r.ingredients_ar) : null,
    steps: strList(r.steps),
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
    servings: toNum(r.servings),
    prep_time_minutes: toNum(r.prep_time_minutes),
    cook_time_minutes: toNum(r.cook_time_minutes),
    ingredients_structured:
      r.ingredients_structured && typeof r.ingredients_structured === "object"
        ? (r.ingredients_structured as Recipe["ingredients_structured"])
        : null,
    owner_id: toNum(r.owner_id),
    source_type:
      typeof r.source_type === "string"
        ? (r.source_type as Recipe["source_type"])
        : null,
    recipe_steps: Array.isArray(r.recipe_steps)
      ? r.recipe_steps.map(normalizeStep)
      : undefined,
  };
  if (realityMinutes != null && realitySource != null) {
    const claimed = recipe.publisher_time_minutes;
    recipe.reality = {
      minutes: realityMinutes,
      source: realitySource,
      samples: toNum(r.reality_samples) ?? 0,
      claimed_minutes: claimed ?? realityMinutes,
      gap_minutes: claimed != null ? realityMinutes - claimed : 0,
      gap_pct:
        claimed != null && claimed > 0
          ? Math.round(((realityMinutes - claimed) / claimed) * 100)
          : null,
    };
  }
  return recipe;
}

/** Unwrap a RecipeResource response (`{data: {...}}` or the raw resource). */
function unwrapRecipeResource(payload: unknown): Recipe {
  const body = payload as { data?: unknown } | undefined;
  return normalizeRecipe(body?.data ?? payload);
}

// ---- CRUD -----------------------------------------------------------------------

/** Create a user-submitted recipe (POST /api/recipes, authed) → the recipe. */
export async function createUserRecipe(
  input: UserRecipeInput,
): Promise<Recipe> {
  return rethrowHalal(async () => {
    const data = await post<unknown>("/recipes", input);
    return unwrapRecipeResource(data);
  });
}

/** Update the signed-in user's recipe (PATCH /api/recipes/{id}, owner-only). */
export async function updateUserRecipe(
  id: number,
  input: UserRecipeInput,
): Promise<Recipe> {
  return rethrowHalal(async () => {
    const data = await patch<unknown>(`/recipes/${id}`, input);
    return unwrapRecipeResource(data);
  });
}

/** Delete the signed-in user's recipe (DELETE /api/recipes/{id}) → 204. */
export async function deleteUserRecipe(id: number): Promise<void> {
  await del(`/recipes/${id}`);
}

/** One page of the signed-in user's light recipe rows (12/page, newest first). */
export async function fetchMyRecipes(
  page = 1,
): Promise<Paginated<Recipe>> {
  const data = await get<Paginated<Recipe>>("/users/me/recipes", {
    params: { page },
  });
  return {
    ...data,
    data: Array.isArray(data?.data) ? data.data.map(normalizeRecipe) : [],
  };
}

/**
 * Fetch a recipe for edit-mode prefill (GET /api/recipes/{id}, public read —
 * the ownership check happens server-side on PATCH). 404s (and any other
 * failure) reject as axios errors for the page to map to a bilingual
 * "couldn't load" state.
 */
export async function getRecipeForEdit(id: number | string): Promise<Recipe> {
  const data = await get<{ data?: unknown }>(`/recipes/${id}`);
  return normalizeRecipe(data?.data ?? data);
}

// ---- Category chips ---------------------------------------------------------------

/** In-memory staleness window for the category chips (server caches 1h too). */
const CATEGORIES_TTL_MS = 60 * 60 * 1000;
let categoriesCache: { at: number; rows: CategoryCount[] } | null = null;

/** Defensive CategoryCount row filter (never trust a partial dev payload). */
function validCategoryRows(rows: unknown): CategoryCount[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const c = row as { category?: unknown; count?: unknown };
      return {
        category:
          typeof c?.category === "string" ? c.category.trim() : "",
        count: toNum(c?.count) ?? 0,
      };
    })
    .filter((c) => c.category.length > 0);
}

/**
 * Top real recipe categories (GET /api/recipes/categories) for the composer's
 * category picker. Any failure — or an empty response — resolves to an empty
 * list so the composer simply hides the picker instead of degrading.
 */
export async function fetchComposerCategories(): Promise<CategoryCount[]> {
  if (
    categoriesCache &&
    Date.now() - categoriesCache.at < CATEGORIES_TTL_MS
  ) {
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
    // Offline / server error: fall through to the stale cache, then empty.
  }
  return categoriesCache?.rows ?? [];
}
