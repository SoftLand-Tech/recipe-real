<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * User reports on recipe notes; one per (note, user), append-only —
     * the same shape post_reports/comment_reports use (000029). Feeds
     * moderation for notes, which previously had no report path (store
     * UGC-policy requirement).
     */
    public function up(): void
    {
        Schema::create('note_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('note_id')
                ->constrained('recipe_notes')
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('reason', 500)->nullable();
            $table->timestamps();

            $table->unique(['note_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('note_reports');
    }
};
