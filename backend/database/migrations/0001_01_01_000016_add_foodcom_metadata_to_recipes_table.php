<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Food.com metadata filled in by recipereal:import-foodcom-meta.
            // `after()` works on MySQL; Laravel's SQLite grammar ignores it
            // (harmless). Nullable ADD COLUMN is cheap on SQLite even at
            // 520k rows. keywords is a JSON array stored as text, like the
            // other raw JSON columns.
            $table->float('aggregated_rating')->nullable()->after('dishwasher_safe');
            $table->unsignedInteger('review_count')->nullable()->after('aggregated_rating');
            $table->string('category', 255)->nullable()->after('review_count');
            $table->text('keywords')->nullable()->after('category');
            $table->text('description')->nullable()->after('keywords');
            $table->float('calories')->nullable()->after('description');
            $table->float('protein_g')->nullable()->after('calories');
            $table->float('fat_g')->nullable()->after('protein_g');
        });
    }

    public function down(): void
    {
        // One drop per Schema::table call keeps the SQLite schema rewriter
        // happy (Laravel rebuilds the table per call).
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('aggregated_rating');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('review_count');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('category');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('keywords');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('calories');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('protein_g');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('fat_g');
        });
    }
};
