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
  /**
   * Minutes literally stated in the step text ("simmer for 8 minutes");
   * null when the text states no time. Drives the Cook Mode step alarm.
   */
  literal_minutes?: number | null;
}

/** One step row of a user-submitted recipe (POST/PATCH /api/recipes). */
export interface UserRecipeStepInput {
  /** English description — required, ≤2000 chars. */
  description: string;
  /** Arabic description — optional. */
  description_ar?: string;
  /** Estimated minutes for this step (0..1440, optional). */
  minutes_estimated?: number;
  /** active | passive | cleanup (defaults server-side to active). */
  step_type?: "active" | "passive" | "cleanup";
}

/** Payload for creating/patching a user-submitted recipe. */
export interface UserRecipeInput {
  /** English title — required. */
  title: string;
  /** Arabic title — optional. */
  title_ar?: string;
  /** Free-text description — optional. */
  description?: string;
  /** Uploaded image URL (POST /api/uploads) — optional; null clears it. */
  image_url?: string | null;
  /** Servings hint — validated but not stored by the server. */
  servings?: number;
  /** Total estimated minutes — required, 1..1440. */
  estimated_minutes: number;
  /** Ingredient strings — 1..60 entries, ≤300 chars each. */
  ingredients: string[];
  /** Step rows — 1..40 entries. */
  steps: UserRecipeStepInput[];
}

export interface CleanupFactors {
  dish_count: number | null;
  grease_level: string | null;
  dishwasher_safe: boolean | null;
}

/**
 * Reality-check block carried by recipe rows: the maintained best-known real
 * cook time vs. the publisher's claim. `gap_pct` is null when the claim is
 * missing (no gap can be computed); the whole block is null/absent when the
 * backend has neither community samples nor an estimate yet.
 */
export interface RealityCheck {
  minutes: number;
  source: "community" | "estimate";
  samples: number;
  claimed_minutes: number;
  gap_minutes: number;
  gap_pct: number | null;
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
  /** Reality-check block (real time vs. claimed); null when unknown. */
  reality?: RealityCheck | null;
  /**
   * Cooking-mode time-contract totals (server `time` block): per-step AI
   * minute sums split active/passive, total incl. cleanup. Present only on
   * payloads where the backend loaded steps with AI minutes; light rail
   * rows carry null/omit it.
   */
  time?: {
    time_total_minutes: number;
    time_active_minutes: number;
    time_passive_minutes: number;
  } | null;
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
  /**
   * Owning user id for user-submitted recipes; null for imported
   * (Food.com) rows. Present on current backend rows, optional on
   * SQLite-cached copies.
   */
  owner_id?: number | null;
  /** Where the row came from: "foodcom" (imported) or "user" (submitted). */
  source_type?: "foodcom" | "user" | string | null;
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

/** The curated rails served by GET /api/home (light rows, may be empty) plus
 *  the reality rail merged in from GET /api/reality (client-side). */
export interface HomeRails {
  top_rated: Recipe[];
  easy_wins: Recipe[];
  most_loved: Recipe[];
  hands_off: Recipe[];
  /** "Most underestimated" recipes (GET /api/reality?mode=under), merged into
   *  the home payload by the client and mirrored alongside the other rails. */
  most_underestimated: Recipe[];
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
  recipe: {
    id: number;
    title: string;
    community_avg_minutes: number | null;
    image_url?: string | null;
  };
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

// ---- User recipes, notes & profile -------------------------------------------

/** Author block attached to each community recipe note. */
export interface RecipeNoteUser {
  id: number;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
}

/** One community note row (GET /api/recipes/{id}/notes). */
export interface RecipeNote {
  id: number;
  body: string;
  created_at: string;
  user: RecipeNoteUser;
}

/** The signed-in user's public profile (GET /api/users/me/profile). */
export interface PublicProfile {
  id: number;
  name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** One page of community notes: rows plus whether more pages exist. */
export interface RecipeNotesPage {
  notes: RecipeNote[];
  hasMore: boolean;
}

// ---- Community posts --------------------------------------------------------

/** Post kinds served by GET /api/posts?kind=. */
export type PostKind = "try" | "fail" | "question";

/** Author block attached to each community post / comment. */
export interface PostUser {
  id: number;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
}

/** Light recipe reference attached to a post (null when the post is standalone). */
export interface PostRecipe {
  id: number;
  title: string;
  title_ar: string | null;
  image_url: string | null;
}

/** One community post row (GET /api/posts, 20/page newest-first). */
export interface Post {
  id: number;
  kind: PostKind;
  body: string;
  image_url: string | null;
  created_at: string;
  user: PostUser;
  recipe: PostRecipe | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

/** One comment row of a post (GET /api/posts/{id}/comments, oldest-first). */
export interface PostComment {
  id: number;
  body: string;
  created_at: string;
  user: PostUser;
}

/** Toggle result of POST /api/posts/{id}/like. */
export interface PostLikeResult {
  liked: boolean;
  likes_count: number;
}

/** Payload for POST /api/posts. */
export interface PostInput {
  kind: PostKind;
  body: string;
  recipe_id?: number;
  image_url?: string;
}

/** One page of community posts: rows plus whether more pages exist. */
export interface PostsPage {
  posts: Post[];
  hasMore: boolean;
}

/** One page of post comments: rows plus whether more pages exist. */
export interface PostCommentsPage {
  comments: PostComment[];
  hasMore: boolean;
}

/** Counters block of GET /api/users/me/profile. */
export interface ProfileCounts {
  recipes: number;
  public_notes: number;
  posts: number;
  likes_received: number;
}

/** The signed-in user's full profile (user + counters). */
export interface MyProfile {
  user: {
    id: number;
    display_name: string | null;
    name: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  counts: ProfileCounts;
}
