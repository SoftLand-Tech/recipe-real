<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipe_steps', function (Blueprint $table) {
            // Cooking-mode alarm support (2026-08-18 time contract): the
            // minutes literally stated in the step's source text ("bake 45
            // minutes" -> 45), extracted by derive_times.py and applied by
            // recipereal:ai-apply. null = the step states no time -> the app
            // offers no countdown for it. AI estimates (ai_minutes) are NOT
            // user-facing timers; they feed recipe-level totals only.
            $table->decimal('literal_minutes', 6, 2)->nullable()->after('ai_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->dropColumn('literal_minutes');
        });
    }
};
