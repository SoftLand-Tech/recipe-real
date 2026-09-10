import type { Post } from "@/types";

/**
 * Single-slot hand-off carrying the just-created post from the composer to
 * the community feed.
 *
 * The composer sets it right before navigating away; the feed consumes it on
 * the next focus and paints the row at the top immediately — the POST already
 * persisted server-side, so there is nothing to wait for. The feed also keeps
 * the row pinned across its first refresh: suggested/trending are ranked
 * (and were historically cached for 60s server-side), so a brand-new,
 * zero-engagement post is not guaranteed to be inside the refreshed page 1.
 *
 * Memory-only, same pass-through pattern as `postPreview.ts`; cleared on
 * sign-out so a marker can never paint one account's post into another's feed.
 */

let pending: Post | null = null;

/** Called by the post composer after a successful create. */
export function markPostCreated(post: Post): void {
  pending = post;
}

/** Called by the community feed on focus; clears the marker. */
export function consumePostCreated(): Post | null {
  const value = pending;
  pending = null;
  return value;
}

/**
 * Non-destructive read for screens that want to react to the just-created
 * post WITHOUT stealing it from the feed (e.g. the recipe screen prepending
 * it to its tries list — the community tab still needs to consume it for
 * its pin + confirmation banner).
 */
export function peekPostCreated(): Post | null {
  return pending;
}

/** Sign-out hygiene (account-scoped data). */
export function clearPostCreated(): void {
  pending = null;
}
