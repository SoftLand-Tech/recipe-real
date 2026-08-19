<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // In-app notification center rows ("X liked your post" / "X commented").
        // Deliberately NOT Laravel's database-notifications system: a plain
        // append-only table (created_at only, like post_comments) written
        // inline by the like/comment controllers.
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            // Recipient — the notification box owner. Their account deletion
            // removes their inbox.
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('type', 10); // like|comment
            // Who did it (liker / commenter). Nullable: the row survives the
            // actor deleting their account (shows a generic actor client-side).
            $table->foreignId('actor_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            // The post the event happened on. Nullable FK with cascade: the
            // notification dies with the post.
            $table->foreignId('post_id')
                ->nullable()
                ->constrained()
                ->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();

            // Inbox query: a recipient's newest notifications first (SQLite
            // scans the composite index backwards for the DESC sort).
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
