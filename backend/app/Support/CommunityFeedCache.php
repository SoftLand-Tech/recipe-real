<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Versioned page-1 community feed cache.
 *
 * GET /api/posts page 1 of the `suggested` / `trending` sorts is cached for
 * 60 seconds PER USER (guests share one 'guest' bucket): those sorts run
 * heavy correlated-subquery scoring, and ≤60s-stale rows are the designed
 * pull-to-refresh tolerance for OTHER readers.
 *
 * The tolerance must never apply to the reader's OWN writes: liking then
 * refreshing showed liked_by_me=false, commenting showed the old count, and
 * posting hid the new post — each because the cached payload predated the
 * write. Every community write endpoint therefore bumps the actor's feed
 * version (see ::bump callers). The version is part of the cache key, so one
 * bump invalidates ALL of that user's buckets at once — both sorts and every
 * recipe_id filter — without tracking which filters they have cached.
 * Superseded versioned payloads expire naturally within 60s.
 */
final class CommunityFeedCache
{
    /** The only sorts whose page 1 is cached (mirrors PostController::index). */
    public const SORTS = ['suggested', 'trending'];

    /** Payload TTL, in seconds (mirrors PostController::index). */
    public const PAYLOAD_TTL_SECONDS = 60;

    public static function versionKey(int|string $userId): string
    {
        return "posts.feed.version.u{$userId}";
    }

    public static function version(int|string $userId): int
    {
        if ($userId === 'guest') {
            return 0;
        }

        return (int) Cache::get(self::versionKey($userId), 0);
    }

    public static function cacheKey(string $sort, int $recipeId, int|string $userId): string
    {
        return "posts.feed.{$sort}.r{$recipeId}.u{$userId}:v".self::version($userId);
    }

    /**
     * Invalidate every cached page-1 feed bucket for one user. Call after any
     * write whose effect is visible in their own feed payload: post
     * create/update/delete, like/unlike, comment create/update/delete,
     * follow/unfollow, block/unblock.
     */
    public static function bump(int $userId): void
    {
        $key = self::versionKey($userId);
        Cache::put($key, self::version($userId) + 1, now()->addDays(30));
    }

    /**
     * Global timing-data version, bumped by any write that moves recipe
     * timing aggregates (cook sessions, quick-time logs, reality backfills).
     * The shared timing caches (home rails, reality leaderboard) carry this
     * version in their keys — one bump invalidates all of their
     * parameterizations at once (rails are a single key; reality keys are
     * take-parameterized 1..50 and cannot be enumerated for forgetting).
     * Superseded payloads expire naturally within their TTLs.
     */
    public static function timingVersionKey(): string
    {
        return 'timing.version';
    }

    public static function timingVersion(): int
    {
        return (int) Cache::get(self::timingVersionKey(), 0);
    }

    /** Append the timing version to a shared timing-cache base key. */
    public static function timingCacheKey(string $base): string
    {
        return "{$base}:t".self::timingVersion();
    }

    /**
     * Invalidate all shared timing caches after a timing write. The fixed
     * `landing:popular` key (rating/image/time card fields) is forgotten
     * directly; the versioned home/reality keys are covered by the bump.
     */
    public static function bumpTiming(): void
    {
        Cache::put(self::timingVersionKey(), self::timingVersion() + 1, now()->addDays(30));
        Cache::forget('landing:popular');
    }
}
