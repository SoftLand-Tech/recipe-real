<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table): void {
            // The composer already accepts servings, but the old endpoint
            // discarded it. Imports preserve the common timing breakdown too.
            $table->unsignedInteger('servings')->nullable()->after('publisher_time_minutes');
            $table->unsignedInteger('prep_time_minutes')->nullable()->after('servings');
            $table->unsignedInteger('cook_time_minutes')->nullable()->after('prep_time_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table): void {
            $table->dropColumn([
                'servings',
                'prep_time_minutes',
                'cook_time_minutes',
            ]);
        });
    }
};
