/**
 * AI recipe import API (/api/recipe-imports) — OWNED BY SLICE CREATE.
 *
 * The flow is PRIVATE-BY-DEFAULT: a source (public URL / image / video) is
 * queued, extracted server-side, and only becomes a public recipe when the
 * owner explicitly POSTs the reviewed draft to .../publish. Halal screening
 * happens server-side; its 422 rejections surface verbatim (as
 * HalalRejectionError, shared with api/userRecipes.ts).
 *
 * Backend truth (RecipeImportController):
 *   POST   /api/recipe-imports               store (multipart; throttle 10/min)
 *   GET    /api/recipe-imports               index (12/page, newest first)
 *   GET    /api/recipe-imports/{id}          show (owner-only, 404 otherwise)
 *   POST   /api/recipe-imports/{id}/retry    re-queue a failed import (≤3/day)
 *   POST   /api/recipe-imports/{id}/publish  publish the reviewed draft
 *   DELETE /api/recipe-imports/{id}          destroy (non-published only)
 *
 * Semantics ported from mobile/src/api/client.ts (createRecipeImport,
 * getRecipeImport, listMyRecipeImports, retryRecipeImport, deleteRecipeImport,
 * publishRecipeImport) on the web's axios helpers.
 */
import { post, del, get } from "@/api/http";
import { rethrowHalal } from "@/api/userRecipes";
import type {
  Recipe,
  RecipeImportDraft,
  RecipeImportRecord,
  UserRecipeInput,
} from "@/api/types";

/**
 * Publish payload: the standard UserRecipeInput plus the import-publisher
 * extras the PublishRecipeImportRequest accepts (category; keywords and
 * nutrition ride through the draft untouched and are not edited on the web).
 */
export type PublishImportInput = UserRecipeInput & {
  category?: string;
};

/** Source files for a new import (browser File objects; multipart upload). */
export interface CreateImportInput {
  /** Public recipe/video URL (any http(s) link the server guard accepts). */
  sourceUrl?: string;
  /** Primary source file: recipe video (mp4/mov/m4v/webm) or image. */
  primary?: File;
  /** Optional extra image attachments (jpg/png/webp/heic, up to 6). */
  extraImages?: File[];
}

// ---- Row normalization -----------------------------------------------------------

/**
 * Defensive normalization of an import row (port of mobile's
 * normalizeRecipeImport): tolerates `{data: {...}}` envelopes, string
 * progress, and partial payloads from older deployments.
 */
function normalizeRecipeImport(payload: unknown): RecipeImportRecord {
  const body = (payload as { data?: unknown } | undefined)?.data ?? payload;
  const row = (body ?? {}) as Record<string, unknown>;
  return {
    id: Number(row.id),
    status:
      typeof row.status === "string"
        ? (row.status as RecipeImportRecord["status"])
        : "failed",
    source_kind: typeof row.source_kind === "string" ? row.source_kind : "url",
    source_platform:
      typeof row.source_platform === "string" ? row.source_platform : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    provider: typeof row.provider === "string" ? row.provider : null,
    provider_model:
      typeof row.provider_model === "string" ? row.provider_model : null,
    stage: typeof row.stage === "string" ? row.stage : null,
    progress: Number(row.progress) || 0,
    draft:
      row.draft && typeof row.draft === "object"
        ? (row.draft as RecipeImportDraft)
        : null,
    warnings: Array.isArray(row.warnings)
      ? row.warnings.filter((item): item is string => typeof item === "string")
      : [],
    confidence:
      row.confidence && typeof row.confidence === "object"
        ? (row.confidence as Record<string, unknown>)
        : null,
    error:
      row.error && typeof row.error === "object"
        ? (row.error as RecipeImportRecord["error"])
        : null,
    recipe_id: row.recipe_id == null ? null : Number(row.recipe_id),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    processed_at:
      typeof row.processed_at === "string" ? row.processed_at : null,
    expires_at:
      typeof row.expires_at === "string" ? row.expires_at : null,
  };
}

// ---- Endpoints -------------------------------------------------------------------

/**
 * Queue a new import (POST /api/recipe-imports, multipart). The video/image
 * files are sent DIRECTLY as primary_file / extra_images[] parts — the import
 * pipeline stores its own assets; the /api/uploads endpoint is only for the
 * composer's cover photo. Long timeout (120s) because large videos upload
 * slowly; the caller handles 429 (throttle 10/min) with a friendly toast.
 */
export async function createRecipeImport(
  input: CreateImportInput,
): Promise<RecipeImportRecord> {
  const form = new FormData();
  if (input.sourceUrl?.trim()) form.append("source_url", input.sourceUrl.trim());
  if (input.primary) form.append("primary_file", input.primary);
  for (const image of input.extraImages ?? []) {
    form.append("extra_images[]", image);
  }
  const data = await post<unknown>("/recipe-imports", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
  });
  return normalizeRecipeImport(data);
}

/** Fetch one import (owner-only; the server 404s other users' rows). */
export async function getRecipeImport(id: number): Promise<RecipeImportRecord> {
  const data = await get<unknown>(`/recipe-imports/${id}`);
  return normalizeRecipeImport(data);
}

/**
 * The signed-in user's imports, newest first (GET /api/recipe-imports,
 * 12/page). Re-surfaces in-flight, ready, and failed imports after the
 * inline poll stops (navigation, timeout, app reload).
 */
export async function listMyRecipeImports(): Promise<RecipeImportRecord[]> {
  const data = await get<unknown>("/recipe-imports");
  const rows = (data as { data?: unknown } | undefined)?.data ?? data;
  return Array.isArray(rows) ? rows.map(normalizeRecipeImport) : [];
}

/** Re-queue a failed import (POST .../retry; capped at 3 retries/24h → 429). */
export async function retryRecipeImport(
  id: number,
): Promise<RecipeImportRecord> {
  const data = await post<unknown>(`/recipe-imports/${id}/retry`);
  return normalizeRecipeImport(data);
}

/** Delete an un-published import (DELETE .../{id}) → 204 (409 once published). */
export async function deleteRecipeImport(id: number): Promise<void> {
  await del(`/recipe-imports/${id}`);
}

/**
 * Publish a reviewed import draft (POST .../publish) → the new public
 * recipe. Halal rejections (422 `{message, terms}`) rethrow as
 * HalalRejectionError so the review form can show the terms verbatim.
 */
export async function publishRecipeImport(
  id: number,
  input: PublishImportInput,
): Promise<Recipe> {
  return rethrowHalal(async () => {
    const data = await post<unknown>(`/recipe-imports/${id}/publish`, input);
    const body = (data as { data?: unknown } | undefined)?.data ?? data;
    const r = (body ?? {}) as Record<string, unknown>;
    return {
      id: Number(r.id),
      title: typeof r.title === "string" ? r.title : "",
    } as Recipe;
  });
}
