/**
 * Social-graph API — owned by slice ACCOUNT.
 *
 * Ports mobile/src/api/client.ts follow/profile-list calls onto the web http
 * layer. Every endpoint here is PUBLIC-readable (works signed out) except
 * follow/unfollow/block, which the UI gates on useAuth() with a login
 * prompt — the API layer itself never handles 401 (http.ts does).
 *   - GET    /users/{id}/profile   → public payload (+ is_following/is_self
 *                                    when a bearer token rides along)
 *   - POST   /users/{id}/follow    → { following: true, followers_count }
 *   - DELETE /users/{id}/follow    → { following: false, followers_count }
 *   - GET    /users/{id}/followers → paginated public user rows
 *   - GET    /users/{id}/following → paginated public user rows
 *   - POST   /users/{id}/block     → idempotent block (authed)
 *   - DELETE /users/{id}/block     → unblock, 204 either way (authed)
 */
import { normalizeProfilePayload } from "@/api/account";
import { del, get, post } from "@/api/http";

import type { MyProfile, PublicProfile } from "@/api/types";

/** One page of follower/following rows plus whether more pages exist. */
export interface FollowListPage {
  users: PublicProfile[];
  hasMore: boolean;
}

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Normalize one public user row (followers/following lists) defensively. */
function normalizePublicUser(row: unknown): PublicProfile {
  const u = (row ?? {}) as Record<string, unknown>;
  return {
    id: toNum(u.id) ?? 0,
    name: str(u.name),
    display_name: str(u.display_name),
    avatar_url: str(u.avatar_url),
    bio: str(u.bio),
  };
}

/**
 * A user's public profile (GET /api/users/{id}/profile): display identity +
 * counts, plus is_following/is_self when the request carries a token. The
 * public payload never includes the account email/name (privacy hardening).
 */
export async function fetchPublicProfile(userId: number): Promise<MyProfile> {
  const body = await get<unknown>(`/users/${userId}/profile`);
  return normalizeProfilePayload(body);
}

/** Follow a user (POST /api/users/{id}/follow, authed, idempotent). */
export async function followUser(userId: number): Promise<void> {
  await post<unknown>(`/users/${userId}/follow`);
}

/** Unfollow a user (DELETE /api/users/{id}/follow, authed). */
export async function unfollowUser(userId: number): Promise<void> {
  await del<unknown>(`/users/${userId}/follow`);
}

async function fetchFollowList(
  userId: number,
  kind: "followers" | "following",
  page: number,
): Promise<FollowListPage> {
  const body = await get<Partial<{ data: unknown[]; meta: Record<string, unknown> }>>(
    `/users/${userId}/${kind}`,
    { params: { page } },
  );
  const rows = Array.isArray(body?.data) ? body.data : [];
  const current = toNum(body?.meta?.current_page) ?? page;
  const last = toNum(body?.meta?.last_page) ?? current;
  return {
    users: rows.map(normalizePublicUser),
    hasMore: current < last,
  };
}

/** One page of a user's followers (GET /api/users/{id}/followers, public). */
export function fetchFollowers(userId: number, page = 1): Promise<FollowListPage> {
  return fetchFollowList(userId, "followers", page);
}

/** One page of who a user follows (GET /api/users/{id}/following, public). */
export function fetchFollowing(userId: number, page = 1): Promise<FollowListPage> {
  return fetchFollowList(userId, "following", page);
}

/**
 * Block a user (POST /api/users/{id}/block, authed, idempotent): their posts
 * and comments disappear from the signed-in user's feeds.
 */
export async function blockUser(userId: number): Promise<void> {
  await post<unknown>(`/users/${userId}/block`);
}

/** Unblock a user (DELETE /api/users/{id}/block, authed) → 204 either way. */
export async function unblockUser(userId: number): Promise<void> {
  await del<unknown>(`/users/${userId}/block`);
}
