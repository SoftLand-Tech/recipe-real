<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Public per-recipe notes ("leave a note for the next cook").
        Schema::create('recipe_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('recipe_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index('recipe_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_notes');
    }
};
