import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Post } from "@/types";

/**
 * Read-modify-write helpers for the community feed's AsyncStorage mirror
 * (`recipereal.communityFeed`: last successful page-1 `{sort, posts}`).
 *
 * The mirror paints instantly on a cold mount — but like/follow/comment
 * writes only patched the in-memory feed, so killing the app before the
 * next successful fetch resurrected stale rows (liked_by_me=false, old
 * counts, flipped-back follow pills — and the next tap then toggled the
 * wrong direction). Every authoritative feed mutation now patches the
 * mirror too, so a restart paints what the user last saw.
 *
 * All best-effort: storage failures never disturb the UI.
 */

export const COMMUNITY_FEED_KEY = "recipereal.communityFeed";

interface CommunityFeedEnvelope {
  sort?: unknown;
  posts?: unknown;
}

async function readEnvelope(): Promise<{ sort: unknown; posts: Post[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_FEED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CommunityFeedEnvelope;
    if (!parsed || !Array.isArray(parsed.posts)) return null;
    return { sort: parsed.sort, posts: parsed.posts as Post[] };
  } catch {
    return null;
  }
}

/** Overwrite the mirror (used by the feed fetch + the just-posted pin). */
export async function writeMirroredFeed(sort: unknown, posts: Post[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      COMMUNITY_FEED_KEY,
      JSON.stringify({ sort, posts }),
    );
  } catch {
    // Best-effort.
  }
}

/** Merge a patch into the mirrored row (like/comment/follow writes). */
export async function patchMirroredPost(
  postId: number,
  patch: Partial<Post> & { user?: Partial<Post["user"]> },
): Promise<void> {
  const envelope = await readEnvelope();
  if (!envelope) return;
  let changed = false;
  const posts = envelope.posts.map((p) => {
    if (p.id !== postId) return p;
    changed = true;
    return {
      ...p,
      ...patch,
      ...(patch.user != null ? { ...p.user, ...patch.user } : null),
    };
  });
  if (!changed) return;
  await writeMirroredFeed(envelope.sort, posts);
}

/** Drop a mirrored row (post deletes). */
export async function removeMirroredPost(postId: number): Promise<void> {
  const envelope = await readEnvelope();
  if (!envelope) return;
  const posts = envelope.posts.filter((p) => p.id !== postId);
  if (posts.length === envelope.posts.length) return;
  await writeMirroredFeed(envelope.sort, posts);
}

/** Increment a mirrored row's comment count (new comments). */
export async function incrementMirroredCommentCount(postId: number): Promise<void> {
  const envelope = await readEnvelope();
  if (!envelope) return;
  let changed = false;
  const posts = envelope.posts.map((p) => {
    if (p.id !== postId) return p;
    changed = true;
    return { ...p, comments_count: (p.comments_count ?? 0) + 1 };
  });
  if (!changed) return;
  await writeMirroredFeed(envelope.sort, posts);
}

/** Flip the follow pill on every mirrored row by one author. */
export async function patchMirroredFollow(
  userId: number,
  following: boolean,
): Promise<void> {
  const envelope = await readEnvelope();
  if (!envelope) return;
  let changed = false;
  const posts = envelope.posts.map((p) => {
    if (p.user?.id !== userId) return p;
    changed = true;
    return { ...p, user: { ...p.user, followed_by_me: following } };
  });
  if (!changed) return;
  await writeMirroredFeed(envelope.sort, posts);
}
