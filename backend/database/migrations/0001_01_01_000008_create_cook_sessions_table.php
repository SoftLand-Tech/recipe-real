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
        Schema::create('cook_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('recipe_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->decimal('total_actual_minutes', 6, 2)->nullable();
            $table->decimal('cleanup_minutes', 6, 2)->nullable();
            $table->enum('feedback', ['faster', 'as_expected', 'slower'])->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('recipe_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cook_sessions');
    }
};
