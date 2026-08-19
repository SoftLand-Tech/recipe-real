<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Content ownership upgrade: comments became editable (edit/delete
        // your own), so post_comments grows the standard `updated_at`
        // (nullable — pre-existing rows never read as "edited").
        Schema::table('post_comments', function (Blueprint $table) {
            $table->timestamp('updated_at')->nullable()->after('body');
        });

        // User reports on posts; one per (post, user), append-only.
        Schema::create('post_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->unique(['post_id', 'user_id']);
        });

        // User reports on comments; one per (comment, user), append-only.
        Schema::create('comment_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_comment_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->unique(['post_comment_id', 'user_id']);
        });

        // Block list: blocker hides the blocked author's posts/comments from
        // their own feeds. One row per (blocker, blocked).
        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->foreignId('blocked_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['blocker_id', 'blocked_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('comment_reports');
        Schema::dropIfExists('post_reports');

        Schema::table('post_comments', function (Blueprint $table) {
            $table->dropColumn('updated_at');
        });
    }
};
