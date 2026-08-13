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

export interface Recipe {
  id: number;
  title: string;
  source_url: string | null;
  ingredients: string[];
  steps: string[];
  publisher_time_minutes: number | null;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
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
