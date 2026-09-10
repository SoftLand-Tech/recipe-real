import type { Post } from "@/types";

/**
 * Feed-mutation markers: writes made OUTSIDE the community tab (post
 * detail likes/comments/edits/deletes, public-profile follows) that the
 * feed must reflect when it regains focus.
 *
 * Why a marker queue instead of a refetch: the feed's focus refresh is
 * throttled (60s), so returning from detail within the window would show
 * stale rows — the exact "my like disappeared" report. The consumer
 * (community.tsx focus effect) applies the mutations to its rows
 * immediately AND forces a page-1 refresh past the throttle, so the marker
 * is the instant paint and the refetch is the reconciliation.
 *
 * Memory-only, same pass-through pattern as postPreview.ts / postCreated.ts;
 * cleared on sign-out so one account's writes can never paint into
 * another's feed. A marker lost to a crash just means "next refresh shows
 * it" — the server already persisted the write.
 */

export type FeedPostPatch = Partial<
  Pick<
    Post,
    | "liked_by_me"
    | "likes_count"
    | "comments_count"
    | "body"
    | "edited"
    | "latest_comment"
  >
>;

export type FeedMutation =
  | { type: "patch-post"; postId: number; patch: FeedPostPatch }
  | { type: "remove-post"; postId: number }
  | { type: "follow"; userId: number; following: boolean };

let pending: FeedMutation[] = [];

/** Called by detail/profile screens after a successful write. */
export function markFeedMutation(mutation: FeedMutation): void {
  pending.push(mutation);
}

/** Called by the community feed on focus; drains the queue. */
export function consumeFeedMutations(): FeedMutation[] {
  const value = pending;
  pending = [];
  return value;
}

/** Sign-out hygiene (account-scoped data). */
export function clearFeedMutations(): void {
  pending = [];
}
