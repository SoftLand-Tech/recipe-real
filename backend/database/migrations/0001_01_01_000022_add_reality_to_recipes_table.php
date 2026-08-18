<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // The "reality" time: how long a recipe really takes, vs the
            // publisher's claim (publisher_time_minutes). Labeled source:
            // 'community' when real cook submissions exist (reality_minutes
            // mirrors community_avg_minutes, reality_samples = cook-session
            // count) or 'estimate' while only the AI per-step sum
            // (recipe_steps.ai_minutes, non-cleanup steps) is available —
            // honestly labeled until cooks replace it. Backfill for existing
            // rows runs via `php artisan recipereal:backfill-reality`.
            // Nullable/default ADD COLUMNs are cheap on SQLite even at 520k
            // rows; `after()` works on MySQL, ignored on SQLite.
            $table->decimal('reality_minutes', 6, 2)->nullable()->after('community_avg_minutes');
            $table->string('reality_source', 12)->nullable()->after('reality_minutes');
            $table->unsignedSmallInteger('reality_samples')->default(0)->after('reality_source');

            // Keeps GET /api/reality's WHERE reality_source IN (...)
            // selective; the gap-pct ordering on top stays a scan of the
            // matched rows only (cached 5 min by the endpoint).
            $table->index('reality_source');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropIndex(['reality_source']);
            $table->dropColumn(['reality_minutes', 'reality_source', 'reality_samples']);
        });
    }
};
