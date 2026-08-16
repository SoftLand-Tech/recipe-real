<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Stage A deterministic ingredient normalization (recipereal:
            // normalize-ingredients). ingredients_structured holds the JSON
            // {"v":1,"items":[{raw,qty,qty_display,unit,item,prep},...]}
            // (version wrapper so future format changes are detectable) —
            // stored as a raw JSON string like the other json columns.
            // ingredients_needs_llm flags recipes whose lines the
            // deterministic parser could not confidently split (no qty,
            // unitless qty, empty, "NA") for the later LLM Stage B.
            // Nullable/default ADD COLUMN is cheap on SQLite even at 520k
            // rows; `after()` works on MySQL, ignored on SQLite.
            $table->text('ingredients_structured')->nullable()->after('fat_g');
            $table->boolean('ingredients_needs_llm')->default(false)->index();
        });
    }

    public function down(): void
    {
        // Index first (SQLite cannot drop an indexed column), then one
        // drop per Schema::table call keeps the schema rewriter happy
        // (Laravel rebuilds the table per call).
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropIndex(['ingredients_needs_llm']);
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('ingredients_structured');
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('ingredients_needs_llm');
        });
    }
};
