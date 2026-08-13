/** Shared domain types for the RecipeReal mobile client. */

export type StepType = "prep" | "cook" | "cleanup" | string;

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
  ingredients: string[];
  steps: string[];
  publisher_time_minutes: number | null;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
  /** Model-based cleanup estimate (Week 4). */
  cleanup_estimate_minutes?: number | null;
  /** Cleanup-burden factors backing the estimate (Week 4). */
  cleanup_factors?: CleanupFactors;
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
