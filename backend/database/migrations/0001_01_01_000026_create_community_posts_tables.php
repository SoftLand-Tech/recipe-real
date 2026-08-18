<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Community feed: "I tried it" / "I failed it" / "I have a question"
        // posts, optionally attached to a recipe (recipe_id nullOnDelete —
        // the post survives its recipe disappearing) with an optional image.
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('kind', 10); // try|fail|question
            $table->text('body');
            $table->foreignId('recipe_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();
            $table->string('image_url', 500)->nullable();
            $table->timestamps();

            $table->index('created_at');
            $table->index('user_id');
        });

        // Toggleable likes; one row per (post, user), unique-enforced.
        Schema::create('post_likes', function (Blueprint $table) {
            $table->foreignId('post_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->unique(['post_id', 'user_id']);
        });

        // Append-only comments (created_at only, no updated_at).
        Schema::create('post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('created_at')->nullable();

            $table->index('post_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_comments');
        Schema::dropIfExists('post_likes');
        Schema::dropIfExists('posts');
    }
};
