<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-candidate outcome log for a generation batch: every generated recipe
 * is either accepted (with its recipe_id) or rejected/flagged with the
 * reason, giving full observability over what the generator tried.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_generation_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')
                ->constrained('recipe_generation_batches')
                ->cascadeOnDelete();

            $table->foreignId('recipe_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('check_id')->nullable()->constrained('duplicate_checks')->nullOnDelete();

            // accepted|duplicate|needs_review|generation_failed
            $table->string('action', 24);
            $table->string('title')->nullable();
            $table->string('matched_recipe_id')->nullable();
            $table->string('layer', 16)->nullable();
            $table->float('score')->nullable();
            $table->text('reason')->nullable();

            // Small candidate snapshot (titles/counts), NOT full content.
            $table->text('candidate_summary')->nullable();

            $table->timestamps();

            $table->index(['batch_id', 'id']);
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_generation_batch_items');
    }
};
