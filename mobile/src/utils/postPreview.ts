import type { Post } from "@/types";

/**
 * Single-slot pass-through so tapping a feed card can paint the post detail
 * screen instantly from the Post object the feed already holds, while the
 * detail screen revalidates from the network behind it. Memory-only: a cold
 * deep link (no preview set, or a different id) simply falls back to a
 * normal fetch. Cleared on sign-out alongside the other account-scoped
 * caches so user B can never paint user A's feed row.
 */

let preview: Post | null = null;

export function setPostPreview(post: Post): void {
  preview = post;
}

/** Returns the preview only when it matches the requested id; else null. */
export function takePostPreview(id: number | string): Post | null {
  if (preview && String(preview.id) === String(id)) return preview;
  preview = null;
  return null;
}

export function clearPostPreview(): void {
  preview = null;
}
