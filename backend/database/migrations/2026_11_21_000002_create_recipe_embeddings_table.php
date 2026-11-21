<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recipe embedding bookkeeping. The vectors themselves live in the vector
 * database (Qdrant); this table tracks per-recipe indexing status so
 * backfills are resumable and unchanged recipes are never re-embedded:
 * a stable text_hash (identity text + model) gates every upsert.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_embeddings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();

            // pending|indexed|failed
            $table->string('status', 16)->default('pending')->index();

            $table->string('model', 128)->nullable();
            $table->unsignedInteger('dimensions')->nullable();

            // sha256 of the embedding text + model: change detector.
            $table->string('text_hash', 64)->nullable()->index();

            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('indexed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_embeddings');
    }
};
