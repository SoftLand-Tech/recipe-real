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
            // Quick-time v2 honest time breakdown: plates made, active
            // hands-on time (excluding waiting), and where the session
            // came from ('quick' one-tap vs 'cook_mode'). Existing rows
            // keep nulls — they predate the breakdown.
            $table->tinyInteger('servings')->nullable()->after('feedback');
            $table->decimal('hands_on_minutes', 6, 2)->nullable()->after('servings');
            $table->string('source', 20)->nullable()->default(null)->after('hands_on_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cook_sessions', function (Blueprint $table) {
            $table->dropColumn(['servings', 'hands_on_minutes', 'source']);
        });
    }
};
