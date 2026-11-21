<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The operative duplicate relationship registry. Engine detections create
 * rows with status 'flagged' (entries are never auto-deleted); a manual
 * admin decision moves the status to confirmed_duplicate or
 * confirmed_distinct and permanently preserves it for future reference.
 * Both directions of lookup are supported through the canonical ordering
 * enforced by the application (recipe_id = newer id, duplicate_of_recipe_id
 * = older id) plus the index on duplicate_of_recipe_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_duplicate_pairs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->foreignId('duplicate_of_recipe_id')->constrained('recipes')->cascadeOnDelete();

            // engine|manual
            $table->string('source', 16)->default('engine');

            // flagged|confirmed_duplicate|confirmed_distinct
            $table->string('status', 24)->default('flagged')->index();

            $table->foreignId('check_id')->nullable()
                ->constrained('duplicate_checks')
                ->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['recipe_id', 'duplicate_of_recipe_id']);
            $table->index('duplicate_of_recipe_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_duplicate_pairs');
    }
};
