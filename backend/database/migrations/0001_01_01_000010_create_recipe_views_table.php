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
        Schema::create('recipe_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            // Explicit 'YYYY-MM' month key so the (user, recipe, month) tuple
            // can be unique without relying on sqlite-generated columns.
            $table->string('month_key', 7);
            $table->timestamps();

            // A single user viewing the same recipe in the same month is
            // recorded once (repeat views don't inflate the free-tier count).
            $table->unique(['user_id', 'recipe_id', 'month_key']);
            $table->index(['user_id', 'month_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recipe_views');
    }
};
