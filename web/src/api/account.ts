/**
 * Own-profile + account-lifecycle API — owned by slice ACCOUNT.
 *
 * Ports the profile half of mobile/src/api/client.ts onto the web http layer
 * (same endpoints, same payload semantics, defensive normalization kept so
 * partial dev payloads never crash a screen):
 *   - GET    /users/me/profile   → { user, counts } (authed)
 *   - PATCH  /users/me/profile   → display_name / bio / avatar_url (authed)
 *   - POST   /users/me/avatar    → multipart `image` (authed, DEDICATED
 *                                  endpoint — the file goes straight up, not
 *                                  through the generic /uploads helper)
 *   - DELETE /account            → 204, Play-policy account deletion (authed)
 *   - GET    /users/{id}/recipes → paginated public recipe cards
 *   - GET    /recipes/{id}       → one recipe (favorites page, by id)
 *   - POST   /posts/{id}/report  → "report user" reports their newest post,
 *                                  exactly like the mobile profile menu.
 *
 * 401s are NEVER handled here — http.ts clears the token and fires
 * 'rr:auth-expired'; callers only surface non-auth failures.
 */
import { del, get, patch, post } from "@/api/http";

import type {
  CleanupFactors,
  MyProfile,
  Paginated,
  ProfileCounts,
  Recipe,
  RealityCheck,
} from "@/api/types";

/** Normalize the reality-check block (hidden when malformed — null). */
function normalizeReality(v: unknown): RealityCheck | null {
  if (v == null || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return {
    minutes: toNum(r.minutes) ?? 0,
    source: r.source === "estimate" ? "estimate" : "community",
    samples: toNum(r.samples) ?? 0,
    claimed_minutes: toNum(r.claimed_minutes) ?? 0,
    gap_minutes: toNum(r.gap_minutes) ?? 0,
    gap_pct: toNum(r.gap_pct),
  };
}

/**
 * Normalize one recipe row from the wire. Self-contained port of the shared
 * mobile normalizer (same field coercion as RECIPE/BROWSE's copies — the
 * ownership rule keeps this slice from importing theirs).
 */
function normalizeRecipeRow(raw: unknown): Recipe {
  const r = (raw ?? {}) as Record<string, unknown>;
  const factorsSrc = (r.cleanup_factors ?? null) as
    | Record<string, unknown>
    | null;
  const cleanup_factors: CleanupFactors | undefined = factorsSrc
    ? {
        dish_count: toNum(factorsSrc.dish_count),
        grease_level:
          factorsSrc.grease_level == null
            ? null
            : String(factorsSrc.grease_level),
        dishwasher_safe:
          factorsSrc.dishwasher_safe == null
            ? null
            : !!factorsSrc.dishwasher_safe,
      }
    : undefined;
  return {
    ...r,
    title: (r.title as string | null | undefined) ?? "",
    image_url:
      r.image_url && String(r.image_url).trim()
        ? String(r.image_url).trim()
        : null,
    title_ar: (r.title_ar as string | null | undefined) ?? null,
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    aggregated_rating: toNum(r.aggregated_rating),
    review_count: toNum(r.review_count),
    ...(cleanup_factors ? { cleanup_factors } : {}),
    reality: normalizeReality(r.reality),
  } as Recipe;
}

/** Edit-form validation limits (mirroring the mobile profile screen + backend). */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 500;

/** Defensive Number() — dev payloads can carry strings/nulls for counters. */
function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Normalize the {user, counts} profile payload shared by /users/me/profile
 * and /users/{id}/profile (the public variant adds is_following/is_self and
 * omits the account-only name/email/gender fields). Reading it flat once
 * silently nulled avatar_url on mobile — every field goes through here.
 */
export function normalizeProfilePayload(body: unknown): MyProfile {
  const raw = (body ?? {}) as {
    user?: Record<string, unknown>;
    counts?: Record<string, unknown>;
    is_following?: unknown;
    is_self?: unknown;
  };
  const u = raw.user ?? {};
  const c = raw.counts ?? {};
  const counts: ProfileCounts = {
    recipes: toNum(c.recipes) ?? 0,
    public_notes: toNum(c.public_notes) ?? 0,
    posts: toNum(c.posts) ?? 0,
    likes_received: toNum(c.likes_received) ?? 0,
    followers: toNum(c.followers) ?? 0,
    following: toNum(c.following) ?? 0,
  };
  return {
    user: {
      id: toNum(u.id) ?? 0,
      display_name: str(u.display_name),
      name: str(u.name),
      email: str(u.email),
      avatar_url: str(u.avatar_url),
      bio: str(u.bio),
      gender:
        u.gender === "male" || u.gender === "female" ? u.gender : null,
      has_display_name: Boolean(u.has_display_name),
      created_at: str(u.created_at) ?? "",
    },
    counts,
    is_following:
      typeof raw.is_following === "boolean" ? raw.is_following : undefined,
    is_self: typeof raw.is_self === "boolean" ? raw.is_self : undefined,
  };
}

/** The signed-in user's full profile incl. counters (GET /api/users/me/profile). */
export async function fetchMyProfile(): Promise<MyProfile> {
  const body = await get<unknown>("/users/me/profile");
  return normalizeProfilePayload(body);
}

/**
 * PATCH /api/users/me/profile with only the moved fields (display_name,
 * bio, avatar_url). The backend re-validates; a bio tripping the halal gate
 * rejects with 422 — callers map that to a friendly bilingual message.
 */
export async function updateProfile(patchBody: {
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
}): Promise<MyProfile> {
  const body = await patch<unknown>("/users/me/profile", patchBody);
  return normalizeProfilePayload(body);
}

/**
 * Upload a new avatar: POST /api/users/me/avatar (multipart field `image`,
 * jpg/png/webp). Dedicated endpoint — the server stores the object AND
 * stamps users.avatar_url itself, so this must NOT go through the generic
 * /api/uploads helper. The browser's FormData sets the multipart boundary,
 * so the per-request Content-Type must be multipart without a charset.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file, file.name || "avatar.jpg");
  const data = await post<{ avatar_url?: string; url?: string }>(
    "/users/me/avatar",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  const url = data?.avatar_url ?? data?.url;
  if (typeof url !== "string" || url === "") {
    throw new Error("Avatar upload returned no URL");
  }
  return url;
}

/**
 * Permanently delete the signed-in account: DELETE /api/account → 204.
 * ANY failure rejects so the settings screen reports deletion as failed
 * (the account survives server-side); on success the caller wipes local
 * state (favorites, token via the logout path) before redirecting home.
 */
export async function deleteAccount(): Promise<void> {
  await del<unknown>("/account");
}

/** One page of a user's public recipe cards (GET /api/users/{id}/recipes). */
export async function fetchUserRecipes(
  userId: number,
  page = 1,
): Promise<Paginated<Recipe>> {
  const body = await get<Partial<Paginated<Recipe>>>(
    `/users/${userId}/recipes`,
    { params: { page } },
  );
  return {
    data: Array.isArray(body?.data) ? body.data : [],
    meta: {
      current_page: toNum(body?.meta?.current_page) ?? page,
      last_page: toNum(body?.meta?.last_page) ?? page,
      per_page: toNum(body?.meta?.per_page) ?? 20,
      total: toNum(body?.meta?.total) ?? 0,
    },
  };
}

/**
 * One recipe by id (GET /api/recipes/{id}) — the favorites page hydrates its
 * device-local id list through this. Lives here (not in BROWSE's recipes.ts)
 * so this slice never depends on another slice's module: BROWSE may still be
 * rewriting that file while ACCOUNT merges. The response arrives in
 * Laravel's {data: {...}} resource envelope — unwrap it, then normalize
 * (decimals-as-strings etc.) exactly like every other recipe consumer.
 */
export async function fetchRecipeById(recipeId: number | string): Promise<Recipe> {
  const payload = await get<unknown>(`/recipes/${recipeId}`);
  const row = (payload as { data?: unknown } | null)?.data ?? payload;
  if (row == null || typeof row !== "object") {
    throw new Error("Recipe not found");
  }
  return normalizeRecipeRow(row);
}

/**
 * "Report user" on the web mirrors the mobile profile menu: report the
 * user's newest post to the moderators (POST /api/posts/{id}/report). The
 * reason string is moderator-facing (never user-visible) so it stays English
 * in both languages, like mobile's literal "Reported from user profile".
 * Resolves null when the user has no posts to report.
 */
export async function reportUserByNewestPost(
  userId: number,
): Promise<boolean> {
  const feed = await get<{ data?: Array<{ id?: unknown }> }>("/posts", {
    params: { user_id: userId, page: 1 },
  });
  const postId = toNum(feed?.data?.[0]?.id);
  if (postId == null) return false;
  await post<unknown>(`/posts/${postId}/report`, {
    reason: "Reported from user profile",
  });
  return true;
}
