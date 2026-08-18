<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Community-facing identity (see AuthController::google): the
            // Google profile picture (avatar_url, capped at 500 chars to
            // match recipes.image_url conventions) and the editable public
            // display name. Falls back to `name` when unset.
            // `after()` works on MySQL; Laravel's SQLite grammar ignores it
            // (harmless).
            $table->string('avatar_url', 500)->nullable()->after('google_sub');
            $table->string('display_name')->nullable()->after('avatar_url');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['avatar_url', 'display_name']);
        });
    }
};
