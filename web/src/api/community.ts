/**
 * Community API — slice COMMUNITY (posts, comments, likes, moderation) plus
 * the composer's SELF-CONTAINED recipe helpers.
 *
 * Ownership note (binding): api/recipes.ts belongs to the parallel BROWSE
 * slice and may still be a stub, so the composer's recipe-attach search and
 * detail hydration live HERE as light private helpers hitting the public
 * endpoints directly. Do not import from or edit api/recipes.ts here.
 *
 * Semantics ported faithfully from mobile/src/api/client.ts (community
 * section) against backend PostController / PostCommentController /
 * UserBlockController:
 *   - Reads are public; writes go through http.ts's bearer token.
 *   - 401s are NEVER handled here: http.ts clears the token and fires
 *     'rr:auth-expired'; AuthContext flips the app to signed-out.
 *   - Halal-gate rejections (422 {message, terms}) surface as
 *     HalalRejectionError carrying the server's terms — shown as returned,
 *     never bypassed.
 *   - Page shapes mirror the mobile normalizers (Laravel paginator envelope
 *     `{data, meta}`; hasMore prefers meta, falls back to a full-page
 *     heuristic at the server-fixed 20/page).
 */
import { isAxiosError } from "axios";

import { del, get, patch, post } from "@/api/http";
import type {
  FetchPostsParams,
  Post,
  PostComment,
  PostCommentsPage,
  PostInput,
  PostLikeResult,
  PostSort,
  PostUser,
  PostsPage,
} from "@/api/types";

/** Page size of the public posts + comments endpoints (server-fixed at 20). */
const POSTS_PER_PAGE = 20;

// ---- Errors --------------------------------------------------------------------

/**
 * The server's halal gate rejected the text (422 {message, terms}). The
 * offending terms are carried verbatim for the bilingual error UI.
 */
export class HalalRejectionError extends Error {
  readonly terms: string[];

  constructor(terms: string[]) {
    super(`Blocked non-halal terms: ${terms.join(", ")}`);
    this.name = "HalalRejectionError";
    this.terms = terms;
  }
}

/** Extract the halal gate's term list from a 422 response, if that's what it is. */
export function extractHalalTerms(error: unknown): string[] | null {
  if (!isAxiosError(error) || error.response?.status !== 422) return null;
  const terms = (error.response.data as { terms?: unknown } | undefined)?.terms;
  if (!Array.isArray(terms)) return null;
  const cleaned = terms.filter((t): t is string => typeof t === "string");
  return cleaned.length > 0 ? cleaned : null;
}

// ---- Defensive normalizers (mobile parity) --------------------------------------

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a post/comment author block defensively (dev payloads are partial). */
function normalizePostUser(u: unknown): PostUser {
  const row = (u ?? {}) as Record<string, unknown>;
  return {
    id: Number(row.id),
    display_name: (row.display_name as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    followed_by_me: Boolean(row.followed_by_me),
  };
}

/** Normalize one post row defensively (recipe + latest_comment may be null). */
function normalizePost(p: unknown): Post {
  const row = (p ?? {}) as Record<string, unknown>;
  // Effective image list: prefer the server's `images` array, else wrap the
  // legacy image_url single photo.
  const serverImages = Array.isArray(row.images)
    ? row.images.filter((v): v is string => typeof v === "string")
    : [];
  const images =
    serverImages.length > 0
      ? serverImages
      : typeof row.image_url === "string" && row.image_url
        ? [row.image_url]
        : [];

  const recipe = row.recipe as Record<string, unknown> | null | undefined;
  const latest = row.latest_comment as Record<string, unknown> | null | undefined;

  return {
    id: Number(row.id),
    body: typeof row.body === "string" ? row.body : "",
    image_url: (row.image_url as string | null) ?? null,
    images,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    user: normalizePostUser(row.user),
    recipe:
      recipe != null
        ? {
            id: Number(recipe.id),
            title: typeof recipe.title === "string" ? recipe.title : "",
            title_ar: (recipe.title_ar as string | null) ?? null,
            image_url: (recipe.image_url as string | null) ?? null,
          }
        : null,
    likes_count: toNum(row.likes_count) ?? 0,
    comments_count: toNum(row.comments_count) ?? 0,
    liked_by_me: Boolean(row.liked_by_me),
    latest_comment:
      latest != null
        ? {
            id: Number(latest.id),
            body: typeof latest.body === "string" ? latest.body : "",
            created_at: typeof latest.created_at === "string" ? latest.created_at : "",
            user: normalizePostUser(latest.user),
          }
        : null,
    edited: Boolean(row.edited),
  };
}

/** Normalize one comment row defensively. */
function normalizePostComment(c: unknown): PostComment {
  const row = (c ?? {}) as Record<string, unknown>;
  return {
    id: Number(row.id),
    body: typeof row.body === "string" ? row.body : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    user: normalizePostUser(row.user),
    edited: Boolean(row.edited),
  };
}

/** Whether more pages exist: prefer paginator meta, else a full-page heuristic. */
function morePages(body: unknown, page: number, rows: number): boolean {
  const meta = (body as { meta?: Record<string, unknown> } | undefined)?.meta;
  const current = Number(meta?.current_page) || page;
  const last = Number(meta?.last_page) || current;
  return current < last || rows >= POSTS_PER_PAGE;
}

/** Unwrap Laravel's optional `{data: …}` resource envelope. */
function unwrap(body: unknown): unknown {
  const wrapped = (body as { data?: unknown } | undefined)?.data;
  return wrapped !== undefined && !Array.isArray(wrapped) ? wrapped : body;
}

// ---- Feed + posts ---------------------------------------------------------------

/**
 * One page of the public community feed (GET /api/posts, 20/page).
 * `sort` selects the ordering: "suggested" (default, personalized → trending
 * fallback for guests), "latest" (newest first) or "trending" (last 7 days
 * ranked by likes*2 + comments). `user_id`/`recipe_id` filter server-side.
 */
export async function fetchPosts(
  pageOrParams: number | FetchPostsParams = 1,
  sort?: PostSort,
): Promise<PostsPage> {
  const params: FetchPostsParams =
    typeof pageOrParams === "number" ? { page: pageOrParams, sort } : pageOrParams;
  const page = params.page ?? 1;
  const body = await get<unknown>("/posts", {
    params: {
      ...(params.sort && params.sort !== "latest" ? { sort: params.sort } : {}),
      ...(params.user_id != null ? { user_id: params.user_id } : {}),
      ...(params.recipe_id != null ? { recipe_id: params.recipe_id } : {}),
      page,
    },
  });
  const envelope = body as { data?: unknown; meta?: { total?: unknown } };
  const rows = Array.isArray(envelope?.data)
    ? envelope.data.map(normalizePost)
    : [];
  return {
    posts: rows,
    hasMore: morePages(body, page, rows.length),
    total: toNum(envelope?.meta?.total) ?? rows.length,
  };
}

/** Fetch a single community post by id (GET /api/posts/{id}, public). */
export async function fetchPost(id: number): Promise<Post> {
  const body = await get<unknown>(`/posts/${id}`);
  return normalizePost(unwrap(body));
}

/**
 * Publish a community post (POST /api/posts, authed, body 1..2000, up to 6
 * image URLs) → the created post. Halal 422 → HalalRejectionError.
 */
export async function createPost(input: PostInput): Promise<Post> {
  try {
    const body = await post<unknown>("/posts", input);
    return normalizePost(unwrap(body));
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/**
 * Edit your own post's body (PATCH /api/posts/{id}, authed, owner-only) →
 * the updated post (edited: true once the text changes). Halal 422 →
 * HalalRejectionError.
 */
export async function updatePost(id: number, body: string): Promise<Post> {
  try {
    const res = await patch<unknown>(`/posts/${id}`, { body });
    return normalizePost(unwrap(res));
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/** Delete your own post (DELETE /api/posts/{id}, authed, owner-only) → 204. */
export async function deletePost(id: number): Promise<void> {
  await del<unknown>(`/posts/${id}`);
}

/**
 * Toggle the signed-in user's like on a post (POST /api/posts/{id}/like,
 * authed) → the authoritative {liked, likes_count}.
 */
export async function togglePostLike(postId: number): Promise<PostLikeResult> {
  const body = await post<{ liked?: unknown; likes_count?: unknown }>(
    `/posts/${postId}/like`,
  );
  return {
    liked: Boolean(body?.liked),
    likes_count: toNum(body?.likes_count) ?? 0,
  };
}

/**
 * Report a post (POST /api/posts/{id}/report, authed, idempotent per
 * post+user; optional free-text reason for moderators).
 */
export async function reportPost(postId: number, reason?: string): Promise<void> {
  await post<unknown>(`/posts/${postId}/report`, {
    ...(reason ? { reason } : {}),
  });
}

/**
 * Block a user (POST /api/users/{id}/block, authed, idempotent). Their posts
 * and comments disappear from the blocker's feeds.
 */
export async function blockUser(userId: number): Promise<void> {
  await post<unknown>(`/users/${userId}/block`);
}

// ---- Comments --------------------------------------------------------------------

/** One page of a post's comments (GET /api/posts/{id}/comments, public, oldest-first). */
export async function fetchPostComments(
  postId: number,
  page = 1,
): Promise<PostCommentsPage> {
  const body = await get<unknown>(`/posts/${postId}/comments`, {
    params: { page },
  });
  const envelope = body as { data?: unknown };
  const rows = Array.isArray(envelope?.data)
    ? envelope.data.map(normalizePostComment)
    : [];
  return { comments: rows, hasMore: morePages(body, page, rows.length) };
}

/**
 * Comment on a post (POST /api/posts/{id}/comments, authed, body 1..1000) →
 * the created comment. Halal 422 → HalalRejectionError.
 */
export async function createPostComment(
  postId: number,
  body: string,
): Promise<PostComment> {
  try {
    const res = await post<unknown>(`/posts/${postId}/comments`, { body });
    return normalizePostComment(unwrap(res));
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/**
 * Edit your own comment (PATCH /api/posts/{postId}/comments/{commentId},
 * authed, author-only) → the updated comment. Halal 422 → HalalRejectionError.
 */
export async function updatePostComment(
  postId: number,
  commentId: number,
  body: string,
): Promise<PostComment> {
  try {
    const res = await patch<unknown>(`/posts/${postId}/comments/${commentId}`, {
      body,
    });
    return normalizePostComment(unwrap(res));
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/** Delete your own comment (DELETE /api/posts/{postId}/comments/{commentId}) → 204. */
export async function deletePostComment(
  postId: number,
  commentId: number,
): Promise<void> {
  await del<unknown>(`/posts/${postId}/comments/${commentId}`);
}

/**
 * Report a comment (POST /api/posts/{postId}/comments/{commentId}/report,
 * authed, idempotent per comment+user).
 */
export async function reportComment(
  postId: number,
  commentId: number,
  reason?: string,
): Promise<void> {
  await post<unknown>(`/posts/${postId}/comments/${commentId}/report`, {
    ...(reason ? { reason } : {}),
  });
}

// ---- Composer: my profile (self-contained) ---------------------------------------

/** The fields the composer/feed chrome need from GET /api/users/me/profile. */
export interface CommunityMyProfile {
  id: number;
  name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Light fetch of the signed-in user's own profile (id/name/avatar) — drives
 * the composer author row and own-vs-other moderation affordances.
 * api/account.ts belongs to the ACCOUNT slice, so this stays self-contained.
 */
export async function fetchMyProfileForCommunity(): Promise<CommunityMyProfile> {
  const body = await get<unknown>("/users/me/profile");
  const outer = unwrap(body) as Record<string, unknown>;
  const u = (outer.user as Record<string, unknown> | undefined) ?? outer;
  return {
    id: Number(u.id),
    name: (u.name as string | null) ?? null,
    display_name: (u.display_name as string | null) ?? null,
    avatar_url: (u.avatar_url as string | null) ?? null,
  };
}

// ---- Composer: recipe attach picker (self-contained) ------------------------------

/** The fields the attach picker needs from a recipe row. */
export interface CommunityRecipePick {
  id: number;
  title: string;
  title_ar: string | null;
  image_url: string | null;
  community_avg_minutes: number | null;
  publisher_time_minutes: number | null;
}

function normalizeRecipePick(r: unknown): CommunityRecipePick {
  const row = (r ?? {}) as Record<string, unknown>;
  const image =
    typeof row.image_url === "string" && row.image_url.trim().length > 0
      ? row.image_url
      : null;
  return {
    id: Number(row.id),
    title: typeof row.title === "string" ? row.title : "",
    title_ar: (row.title_ar as string | null) ?? null,
    image_url: image,
    community_avg_minutes: toNum(row.community_avg_minutes),
    publisher_time_minutes: toNum(row.publisher_time_minutes),
  };
}

/**
 * Light recipe search for the post composer's attach picker
 * (GET /api/recipes/search?q=). Implemented HERE, not via api/recipes.ts
 * (BROWSE slice) — see the ownership note at the top of this file.
 * An empty query returns the first page as "suggested" recipes.
 */
export async function searchRecipesForAttach(
  q: string,
  limit = 6,
): Promise<CommunityRecipePick[]> {
  const body = await get<unknown>("/recipes/search", {
    params: {
      ...(q.trim().length > 0 ? { q: q.trim() } : {}),
      per_page: limit,
      page: 1,
    },
  });
  const envelope = body as { data?: unknown };
  return Array.isArray(envelope?.data)
    ? envelope.data.slice(0, limit).map(normalizeRecipePick)
    : [];
}

/**
 * Hydrate one recipe for the attached-recipe card (GET /api/recipes/{id}) —
 * used when the composer was prefilled with a bare ?recipeId= (e.g. a recipe
 * page's "share your try" link). Failures are non-fatal: the caller keeps
 * the bare id + title.
 */
export async function fetchRecipeForAttach(
  id: number,
): Promise<CommunityRecipePick> {
  const body = await get<unknown>(`/recipes/${id}`);
  const row = unwrap(body);
  return normalizeRecipePick(row);
}
