<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // User-created recipes (community platform). owner_id nullOnDelete:
            // deleting an account keeps the recipe (community content), it just
            // loses its author. source_type distinguishes user recipes from
            // the Food.com import ('foodcom') — recipereal:wipe-unreviewed
            // always keeps source_type='user' rows regardless of its keep
            // files. Nullable/default ADD COLUMNs are cheap on SQLite even at
            // 520k rows; `after()` works on MySQL, ignored on SQLite.
            $table->foreignId('owner_id')
                ->nullable()
                ->after('id')
                ->constrained('users')
                ->nullOnDelete();
            $table->string('source_type', 12)->default('foodcom')->index()->after('owner_id');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // Drop the FK before the columns (SQLite rebuilds the table).
            $table->dropForeign(['owner_id']);
            $table->dropIndex(['source_type']);
            $table->dropColumn(['owner_id', 'source_type']);
        });
    }
};
