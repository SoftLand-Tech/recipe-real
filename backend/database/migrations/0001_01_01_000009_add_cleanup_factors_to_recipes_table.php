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
        Schema::table('recipes', function (Blueprint $table) {
            $table->unsignedInteger('dish_count')->nullable()->after('cleanup_avg_minutes');
            $table->enum('grease_level', ['low', 'medium', 'high'])->nullable()->after('dish_count');
            $table->boolean('dishwasher_safe')->nullable()->after('grease_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn(['dish_count', 'grease_level', 'dishwasher_safe']);
        });
    }
};
