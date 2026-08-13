<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('timing_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('recipe_step_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->decimal('actual_minutes', 6, 2);
            $table->uuid('session_id');
            $table->timestamps();

            $table->index('session_id');
            $table->index('recipe_step_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('timing_submissions');
    }
};
