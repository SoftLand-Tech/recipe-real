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
            // Nullable uuid: legacy / keyless rows carry NULL. The unique index
            // below is composite on (user_id, idempotency_key), and both SQLite
            // and MySQL permit multiple NULLs in a unique index, so those legacy
            // rows never conflict with one another.
            $table->uuid('idempotency_key')->nullable()->after('feedback');

            $table->unique(['user_id', 'idempotency_key'], 'cook_sessions_user_idempotency_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cook_sessions', function (Blueprint $table) {
            $table->dropUnique('cook_sessions_user_idempotency_unique');
            $table->dropColumn('idempotency_key');
        });
    }
};
