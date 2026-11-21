<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only duplicate detection history. Every decision (accepted,
 * rejected duplicate, or flagged for review) from any source (generation
 * batch, backfill scan, manual review) lands here once and is never
 * overwritten — manual decisions create their own rows so history is
 * preserved for auditing and future reference.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('duplicate_checks', function (Blueprint $table) {
            $table->id();

            // The candidate recipe (null when rejected pre-insert and never
            // stored, e.g. exact fingerprint duplicates). NOTE: constrained()
            // explicitly — the column name would guess `matched_recipes`.
            $table->foreignId('recipe_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('matched_recipe_id')->nullable()->constrained('recipes')->nullOnDelete();
            $table->foreignId('batch_id')->nullable()
                ->constrained('recipe_generation_batches')
                ->nullOnDelete();

            // generation|backfill|manual|auto_review
            $table->string('source', 16)->default('generation')->index();

            // 1 exact | 2 structural | 3 ai | 0 none
            $table->unsignedTinyInteger('layer')->default(0);

            // accepted|rejected_duplicate|flagged_review
            $table->string('action', 24)->index();

            // Final outcome (null while uncertain).
            $table->boolean('is_duplicate')->nullable();

            // Weighted similarity breakdown from SimilarityScorer.
            $table->text('scores')->nullable();

            // AI judge verdict when layer 3 ran.
            $table->string('classification', 32)->nullable();
            $table->float('ai_confidence')->nullable();
            $table->text('reason')->nullable();
            $table->text('differences')->nullable();

            // resolved|needs_review
            $table->string('status', 16)->default('resolved');

            $table->timestamps();

            $table->index(['recipe_id', 'id']);
            $table->index(['matched_recipe_id', 'id']);
            $table->index(['status', 'created_at']);
            $table->index(['batch_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('duplicate_checks');
    }
};
