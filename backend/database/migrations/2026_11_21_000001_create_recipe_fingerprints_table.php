<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recipe fingerprints: the normalized culinary identity of every recipe
 * plus the deterministic hashes used for exact (Layer 1) matching and
 * fast candidate retrieval. Derived data only — recipes themselves are
 * never modified; the row follows its recipe via cascadeOnDelete.
 *
 * Core indexes:
 *  - UNIQUE (recipe_id)        one fingerprint row per recipe.
 *  - UNIQUE (fingerprint)      Layer 1 exact matching + the database-level
 *                              guard against two concurrent jobs inserting
 *                              the same recipe as separate rows.
 *  - INDEX identity_signature  canonical-dish candidate clusters.
 *  - INDEX main_ingredient_hash / ingredient_combo_hash
 *                              ingredient-set candidate retrieval.
 *  - INDEX title_signature     secondary candidate source only (titles
 *                              never decide duplicates by themselves).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_fingerprints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();
            $table->unsignedSmallInteger('version')->default(1);

            // Full exact fingerprint (normalized identity incl. quantity bins).
            $table->string('fingerprint', 64)
                ->unique();

            // Canonical dish signature (core ingredients + core techniques + form).
            $table->string('identity_signature', 64)->index();

            // Sorted-set hashes.
            $table->string('ingredient_combo_hash', 64)->index();
            $table->string('main_ingredient_hash', 64)->index();
            $table->string('title_signature', 64)->index();

            // Denormalized identity facets for filtered lookups.
            $table->string('dish_family', 64)->nullable()->index();
            $table->string('cuisine', 64)->nullable()->index();
            $table->string('category', 64)->nullable();
            $table->string('form', 64)->nullable();
            $table->string('sauce', 64)->nullable();

            // The full structured identity payload (CulinaryIdentity toArray()).
            $table->text('identity')->nullable();

            // False when the recipe lacked ingredients/steps/metadata and the
            // fingerprint is degraded — such rows are re-processed after
            // enrichment (never trust them for exact rejection alone).
            $table->boolean('is_complete')->default(true);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_fingerprints');
    }
};
