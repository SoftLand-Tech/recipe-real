<?php

namespace App\Support;

use App\Http\Middleware\SetLocale;
use App\Models\Post;
use Illuminate\Support\Facades\Cache;

/**
 * Forgets the rendered public share pages (GET /r/{recipe}, GET /p/{post}).
 *
 * Both pages cache full HTML for 5 minutes per id per locale
 * ("{kind}:share:{id}:{locale}", see routes/web.php). Any write that changes
 * what those pages render must forget the affected keys, or edits serve
 * stale pages (including stale OpenGraph tags, which WhatsApp/Telegram then
 * pin far beyond our TTL):
 *
 * - post body edit → forgetPost
 * - author display_name/avatar_url change → forgetPost for each of their posts
 * - recipe edit / timing-aggregate move / delete → forgetRecipe (fans out to
 *   every attached post's page, which embeds a recipe card)
 *
 * Deletes need no share forget for the deleted row itself (route model
 * binding 404s before the cache is read) — but forgetRecipe on delete still
 * matters for the surviving attached posts' cards.
 */
final class ShareCache
{
    /**
     * Locales the share pages are cached under — the single source of truth
     * is SetLocale::SUPPORTED (routes/web.php keys on app()->getLocale()).
     */
    private static function locales(): array
    {
        return SetLocale::SUPPORTED;
    }

    public static function forgetPost(int $postId): void
    {
        foreach (self::locales() as $locale) {
            Cache::forget("post:share:{$postId}:{$locale}");
        }
    }

    public static function forgetRecipe(int $recipeId): void
    {
        foreach (self::locales() as $locale) {
            Cache::forget("recipe:share:{$recipeId}:{$locale}");
        }

        // Attached posts embed a recipe card (title/image/"Really takes" +
        // og:image fallback) — their pages go stale with the recipe.
        self::forgetPosts(
            Post::query()->where('recipe_id', $recipeId)->pluck('id')->all()
        );
    }

    /** Forget a list of post share pages (both locales each). */
    public static function forgetPosts(array $postIds): void
    {
        foreach ($postIds as $postId) {
            self::forgetPost((int) $postId);
        }
    }

    /** Forget every share page authored by one user (profile/name/avatar changes). */
    public static function forgetPostsByUser(int $userId): void
    {
        self::forgetPosts(
            Post::query()->where('user_id', $userId)->pluck('id')->all()
        );
    }
}
