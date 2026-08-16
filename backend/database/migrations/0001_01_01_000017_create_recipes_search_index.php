<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Full-text search index for recipes (SQLite FTS5).
     *
     * Contentless table (content=''): rows are managed by us, not by an
     * external content table. rowid == recipes.id, text is lowercased at
     * index time for case-insensitive matching. Triggers keep the index in
     * sync with recipes.title / ingredients / description; after migrating
     * (and after bulk writes that bypass the triggers), run
     * `php artisan recipereal:rebuild-search` to (re)populate it.
     *
     * Runs after 000016 (metadata columns): description must exist when the
     * triggers are created.
     */
    public function up(): void
    {
        // NO sync triggers, deliberately. The FTS5 'delete' command's legality
        // on contentless tables flip-flops across SQLite versions (plain
        // content='' rejects it <3.43; contentless_delete=1 forbids the
        // command form on newer builds), so trigger-based sync is a
        // portability minefield. Nothing indexed changes at runtime anyway
        // (title/ingredients/description are written only by imports) — run
        // `php artisan recipereal:rebuild-search` after any bulk write
        // instead (also scheduled nightly).
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ai');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_au');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ad');
        DB::statement('DROP TABLE IF EXISTS recipes_fts');
        DB::statement(
            'CREATE VIRTUAL TABLE recipes_fts USING fts5('
            ."title, ingredients, description, content='')"
        );
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ai');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_au');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ad');
        DB::statement('DROP TABLE IF EXISTS recipes_fts');
    }
};
