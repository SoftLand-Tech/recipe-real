<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Arabic translations filled in by recipereal:translate-ar.
            // `after()` works on MySQL; Laravel's SQLite grammar ignores it
            // (harmless). Nullable ADD COLUMN is cheap on SQLite even at
            // 520k rows. ingredients/steps are stored as raw JSON strings,
            // like the existing json columns (no model cast).
            $table->text('title_ar')->nullable()->after('image_url');
            $table->text('ingredients_ar')->nullable()->after('title_ar');
            $table->text('steps_ar')->nullable()->after('ingredients_ar');
        });

        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->text('description_ar')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        // One drop per Schema::table call keeps the SQLite schema rewriter
        // happy (Laravel rebuilds the table per call).
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('title_ar');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('ingredients_ar');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('steps_ar');
        });

        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->dropColumn('description_ar');
        });
    }
};
