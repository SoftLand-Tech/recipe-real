<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Denormalized COUNT(recipe_steps), maintained by
            // recipereal:import-foodcom on insert. The backfill for existing
            // rows (520k in production) is deliberately NOT done here — run
            // `php artisan recipereal:fix-steps` instead, which recomputes it
            // for every recipe in one pass. Listing endpoints filter on
            // steps_count >= 2 (Recipe::scopeListable) so recipes whose only
            // "step" is an un-parsed raw R vector stay out of the app.
            // Nullable ADD COLUMN with a default is cheap on SQLite even at
            // 520k rows; `after()` works on MySQL, ignored on SQLite.
            $table->unsignedInteger('steps_count')->default(0)->after('community_avg_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('steps_count');
        });
    }
};
