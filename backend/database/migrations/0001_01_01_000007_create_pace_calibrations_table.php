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
        Schema::create('pace_calibrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('step_type');
            $table->decimal('personal_avg_minutes', 6, 2);
            $table->decimal('community_avg_minutes', 6, 2);
            $table->decimal('confidence', 4, 2)->default(0.00);
            $table->timestamps();

            $table->unique(['user_id', 'step_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pace_calibrations');
    }
};
