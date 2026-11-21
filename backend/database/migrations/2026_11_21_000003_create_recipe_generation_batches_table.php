<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI recipe generation batches (recipereal:generate-batch). Tracks the
 * ACCEPTED target (never just attempts), a worker lease so a batch is
 * driven by exactly one job at a time, and hard attempt/wall caps so the
 * replacement loop cannot run forever.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_generation_batches', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('requested_count');
            $table->string('cuisine', 64)->nullable();
            $table->string('dish_family', 64)->nullable();
            $table->string('category', 64)->nullable();

            // Generator brief + language + any freeform constraints.
            $table->text('params')->nullable();

            // created|running|completed|exhausted|failed|cancelled
            $table->string('status', 16)->default('created')->index();

            $table->unsignedInteger('accepted_count')->default(0);
            $table->unsignedInteger('rejected_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('generation_attempts')->default(0);
            $table->unsignedInteger('max_attempts')->default(0);

            // Single-worker lease (atomic claim via conditional UPDATE).
            $table->timestamp('lease_expires_at')->nullable();

            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_generation_batches');
    }
};
