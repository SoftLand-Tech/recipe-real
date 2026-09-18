<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per app installation. The mobile client generates a random
     * UUID once (SecureStore, cleared on Android uninstall) and heartbeats
     * it on every cold start via POST /api/installs (auth-optional).
     *
     * Separate from analytics_events on purpose: those are pruned after
     * 90 days, while this table is the long-lived "how many people have
     * the app" counter. created_at = first seen, updated_at = last seen.
     */
    public function up(): void
    {
        Schema::create('app_installs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('install_id', 36)->unique();
            $table->string('platform', 16)->nullable()->index();
            $table->string('app_version', 32)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_installs');
    }
};
