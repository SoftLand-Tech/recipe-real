/**
 * Community recipe notes API (slice RECIPE).
 *
 * Port of mobile/src/api/client.ts's notes surface:
 *   - fetchRecipeNotes — GET /api/recipes/{id}/notes (public, 20/page,
 *     newest first) normalized into RecipeNotesPage.
 *   - postRecipeNote — POST /api/recipes/{id}/notes (authed, halal-gated:
 *     a 422 carrying offending terms throws HalalRejectionError).
 *   - deleteRecipeNote — DELETE /api/recipes/{id}/notes/{noteId} (owner).
 *   - reportRecipeNote — POST /api/recipes/{id}/notes/{noteId}/report
 *     (authed, idempotent).
 */
import axios from "axios";

import { del, get, post } from "@/api/http";
import type { RecipeNote, RecipeNotesPage } from "@/api/types";

/** Page size of the public notes endpoint (server-fixed at 20). */
const NOTES_PER_PAGE = 20;

/**
 * Thrown when a note POST is rejected by the halal gate (422): the server
 * lists the offending terms, which the compose row surfaces inline.
 */
export class HalalRejectionError extends Error {
  /** The offending terms reported by the server. */
  readonly terms: string[];

  constructor(terms: string[]) {
    super(`Blocked non-halal terms: ${terms.join(", ")}`);
    this.name = "HalalRejectionError";
    this.terms = terms;
  }
}

/** Extract the halal term list from a Laravel 422 `{errors: {halal: [...]}}`. */
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

/** Normalize one note row defensively (user block may be partial in dev). */
function normalizeNote(n: unknown): RecipeNote {
  const r = (n ?? {}) as Record<string, unknown>;
  const u = (r.user ?? {}) as Record<string, unknown>;
  return {
    id: Number(r.id),
    body: typeof r.body === "string" ? r.body : "",
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    user: {
      id: Number(u.id),
      display_name: (u.display_name as string | null | undefined) ?? null,
      name: ((u.display_name ?? u.name) as string | null | undefined) ?? null,
      avatar_url: (u.avatar_url as string | null | undefined) ?? null,
    },
  };
}

/**
 * One page of a recipe's PUBLIC community notes. `hasMore` prefers the
 * paginator meta, falling back to a full-page heuristic (mirrors mobile).
 */
export async function fetchRecipeNotes(
  recipeId: number,
  page = 1,
): Promise<RecipeNotesPage> {
  const data = await get<{ data?: unknown; meta?: {
    current_page?: unknown;
    last_page?: unknown;
  } }>(`/recipes/${recipeId}/notes`, { params: { page } });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const notes = rows.map(normalizeNote);
  const current = Number(data?.meta?.current_page) || page;
  const last = Number(data?.meta?.last_page) || current;
  return { notes, hasMore: current < last || notes.length >= NOTES_PER_PAGE };
}

/**
 * Post a community note → the created note. A halal 422 maps to
 * HalalRejectionError; other errors (including 401) rethrow as-is for the
 * caller's inline states.
 */
export async function postRecipeNote(
  recipeId: number,
  body: string,
): Promise<RecipeNote> {
  try {
    const data = await post<unknown>(`/recipes/${recipeId}/notes`, { body });
    return normalizeNote((data as { data?: unknown } | null)?.data ?? data);
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/** Delete your own community note → 204. */
export async function deleteRecipeNote(
  recipeId: number,
  noteId: number,
): Promise<void> {
  await del(`/recipes/${recipeId}/notes/${noteId}`);
}

/** Report a community note (authed, idempotent). */
export async function reportRecipeNote(
  recipeId: number,
  noteId: number,
): Promise<void> {
  await post(`/recipes/${recipeId}/notes/${noteId}/report`);
}
