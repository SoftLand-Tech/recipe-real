<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // User suspension: a banned user keeps their row (content stays
        // attributed) but can no longer sign in or call authed endpoints.
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('banned_at')->nullable()->after('remember_token');
            $table->string('ban_reason', 500)->nullable()->after('banned_at');
        });

        // Moderation notices: takedown/suspension messages for the author's
        // inbox. `type` stays string(10) — 'moderation' is exactly 10 chars.
        // `message` carries the human-readable notice; like/comment rows keep
        // it null and render from actor/post as before.
        Schema::table('notifications', function (Blueprint $table) {
            $table->text('message')->nullable()->after('post_id');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('message');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['banned_at', 'ban_reason']);
        });
    }
};
