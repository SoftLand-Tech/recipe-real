<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Expand the SQLite FTS5 index with Arabic columns (title_ar and
     * ingredients_ar) so fallback search matches Arabic queries as cleanly
     * as English queries whenever Typesense is unavailable or disabled.
     */
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ai');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_au');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ad');
        DB::statement('DROP TABLE IF EXISTS recipes_fts');
        DB::statement(
            'CREATE VIRTUAL TABLE recipes_fts USING fts5('
            ."title, title_ar, ingredients, ingredients_ar, description, content='')"
        );

        if (DB::table('recipes')->exists()) {
            Artisan::call('recipereal:rebuild-search');
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ai');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_au');
        DB::statement('DROP TRIGGER IF EXISTS recipes_fts_ad');
        DB::statement('DROP TABLE IF EXISTS recipes_fts');
        DB::statement(
            'CREATE VIRTUAL TABLE recipes_fts USING fts5('
            ."title, ingredients, description, content='')"
        );
    }
};
