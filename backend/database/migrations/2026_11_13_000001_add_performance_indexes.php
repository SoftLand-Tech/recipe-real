<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->index('owner_id');
            $table->index('category');
        });

        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->index(['recipe_id', 'step_type']);
        });

        Schema::table('recipe_notes', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('post_likes', function (Blueprint $table) {
            $table->index(['user_id', 'post_id']);
        });

        Schema::table('post_comments', function (Blueprint $table) {
            $table->index(['post_id', 'id']);
            $table->index(['post_id', 'created_at']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'read_at']);
            $table->index(
                ['user_id', 'actor_id', 'post_id', 'type', 'created_at'],
                'notifications_user_actor_post_type_created_idx'
            );
        });

        Schema::table('cook_sessions', function (Blueprint $table) {
            $table->index(['user_id', 'created_at']);
        });

        if (DB::getDriverName() === 'sqlite') {
            DB::statement(
                "CREATE INDEX IF NOT EXISTS recipes_quality_tier_id_idx
                 ON recipes (id)
                 WHERE steps_count >= 2 AND image_url IS NOT NULL AND image_url != '' AND aggregated_rating >= 4 AND review_count >= 5"
            );

            DB::statement(
                "CREATE INDEX IF NOT EXISTS recipes_quality_tier_top_rated_idx
                 ON recipes (aggregated_rating DESC, review_count DESC, id ASC)
                 WHERE steps_count >= 2 AND image_url IS NOT NULL AND image_url != '' AND aggregated_rating >= 4 AND review_count >= 5"
            );

            DB::statement(
                "CREATE INDEX IF NOT EXISTS recipes_quality_tier_most_loved_idx
                 ON recipes (review_count DESC, id ASC)
                 WHERE steps_count >= 2 AND image_url IS NOT NULL AND image_url != '' AND aggregated_rating >= 4 AND review_count >= 5"
            );

            DB::statement(
                'CREATE INDEX IF NOT EXISTS recipes_seed_image_id_idx
                 ON recipes ((image_url IS NOT NULL) DESC, id ASC)'
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS recipes_seed_image_id_idx');
            DB::statement('DROP INDEX IF EXISTS recipes_quality_tier_most_loved_idx');
            DB::statement('DROP INDEX IF EXISTS recipes_quality_tier_top_rated_idx');
            DB::statement('DROP INDEX IF EXISTS recipes_quality_tier_id_idx');
        }

        Schema::table('cook_sessions', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'created_at']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_actor_post_type_created_idx');
            $table->dropIndex(['user_id', 'read_at']);
        });

        Schema::table('post_comments', function (Blueprint $table) {
            $table->dropIndex(['post_id', 'created_at']);
            $table->dropIndex(['post_id', 'id']);
        });

        Schema::table('post_likes', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'post_id']);
        });

        Schema::table('recipe_notes', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
        });

        Schema::table('recipe_steps', function (Blueprint $table) {
            $table->dropIndex(['recipe_id', 'step_type']);
        });

        Schema::table('recipes', function (Blueprint $table) {
            $table->dropIndex(['category']);
            $table->dropIndex(['owner_id']);
        });
    }
};
