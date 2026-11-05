<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cook_sessions', function (Blueprint $table) {
            // Quick-time anti-poisoning: backs the per-user 24h dedupe
            // lookup in StoreQuickTimeRequest (user_id + recipe_id + the
            // created_at window). A plain composite index is enough — the
            // dedupe is a query, not a constraint, because full Cook Mode
            // sessions legitimately repeat within 24h for the same user.
            // The distinguishing 'source' column ('quick' vs null) already
            // exists from the quick-time breakdown migration, so nothing
            // new is added there.
            $table->index(
                ['user_id', 'recipe_id', 'created_at'],
                'cook_sessions_quick_time_dedupe_index'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cook_sessions', function (Blueprint $table) {
            $table->dropIndex('cook_sessions_quick_time_dedupe_index');
        });
    }
};
