<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a public/private flag to recipe notes so the admin panel can
     * moderate visibility without deleting content. Additive and
     * default-true, so existing notes stay public and the API (which reads
     * all notes) is untouched.
     */
    public function up(): void
    {
        Schema::table('recipe_notes', function (Blueprint $table) {
            $table->boolean('is_public')->default(true)->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('recipe_notes', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
    }
};