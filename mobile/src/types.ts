/** Shared domain types for the RecipeReal mobile client. */

export type StepType = "active" | "passive" | "cleanup" | string;

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RecipeStep {
  id: number;
  step_number: number;
  description: string;
  /** Arabic translation of the description; null when untranslated. */
  description_ar?: string | null;
  step_type: StepType;
  publisher_minutes: number | null;
  community_minutes: number | null;
}

export interface CleanupFactors {
  dish_count: number | null;
  grease_level: string | null;
  dishwasher_safe: boolean | null;
}

export interface Recipe {
  id: number;
  title: string;
  source_url: string | null;
  image_url?: string | null;
  ingredients: string[];
  steps: string[];
  /** Arabic translations; null when the backend has no translation. */
  title_ar?: string | null;
  ingredients_ar?: string[] | null;
  steps_ar?: string[] | null;
  publisher_time_minutes: number | null;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
  /** Model-based cleanup estimate (Week 4). */
  cleanup_estimate_minutes?: number | null;
  /** Cleanup-burden factors backing the estimate (Week 4). */
  cleanup_factors?: CleanupFactors;
  /**
   * Food.com metadata (server-driven browse/home rows). All nullable — the
   * local dev DB has metadata only partially, and SQLite-cached rows don't
   * persist these columns, so every reader must treat them as optional.
   */
  aggregated_rating?: number | null;
  review_count?: number | null;
  category?: string | null;
  keywords?: string[] | null;
  description?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  /** Present on the detail / seed payloads. */
  recipe_steps?: RecipeStep[];
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface GetRecipesParams {
  page?: number;
  search?: string;
  maxTime?: number;
}

// ---- Server-driven browse & home --------------------------------------------

/** Sort orders accepted by GET /api/recipes/search. */
export type SearchSort = "relevance" | "top_rated" | "fastest" | "most_loved";

/** Query params for the public search endpoint (GET /api/recipes/search). */
export interface SearchParams {
  q?: string;
  category?: string;
  maxTime?: number;
  sort?: SearchSort;
  page?: number;
  perPage?: number;
}

/** One row of GET /api/recipes/categories (top real Food.com categories). */
export interface CategoryCount {
  category: string;
  count: number;
}

/** The four curated rails served by GET /api/home (light rows, may be empty). */
export interface HomeRails {
  top_rated: Recipe[];
  easy_wins: Recipe[];
  most_loved: Recipe[];
  hands_off: Recipe[];
}

/** Response of POST /api/recipes/{id}/quick-time (community_avg may be a string). */
export interface QuickTimeResult {
  ok: boolean;
  recipe_id: number;
  minutes_submitted: number;
  community_avg_minutes: number | null;
}

// ---- Cook Mode (Week 2) ----------------------------------------------------

export type Feedback = "faster" | "as_expected" | "slower";

export interface TimingSubmissionInput {
  recipe_step_id: number;
  actual_minutes: number;
}

export interface CookSessionPayload {
  recipe_id: number;
  total_actual_minutes: number;
  cleanup_minutes: number | null;
  feedback: Feedback | null;
  idempotency_key: string;
  timing_submissions: TimingSubmissionInput[];
}

export interface CookSessionSummary {
  id: number;
  recipe: { id: number; title: string; community_avg_minutes: number | null };
  total_actual_minutes: number | null;
  cleanup_minutes: number | null;
  feedback: Feedback | null;
  created_at: string;
}

// ---- Personal Pace Calibration (Week 3) ------------------------------------

export interface PaceCalibration {
  step_type: string;
  personal_avg_minutes: number | null;
  community_avg_minutes: number | null;
  multiplier: number;
  confidence: number;
}

// ---- Billing & Usage (Week 5) -----------------------------------------------

export type BillingPlan = "monthly" | "yearly";

export interface Usage {
  premium: boolean;
  views_this_month: number;
  limit: number;
}
