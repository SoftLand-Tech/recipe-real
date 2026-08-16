<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipe_steps', function (Blueprint $table) {
            // Per-step minutes from the AI pipeline (recipereal:ai-apply
            // writes minutes_estimated here, clamped to 0..1440). `after()`
            // works on MySQL; Laravel's SQLite grammar ignores it
            // (harmless). Nullable ADD COLUMN is cheap on SQLite even at
            // 520k recipes (~2.7M steps).
            $table->decimal('ai_minutes', 6, 2)->nullable()->after('community_avg_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->dropColumn('ai_minutes');
        });
    }
};
