<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            // `after()` works on MySQL; Laravel's SQLite grammar ignores it (harmless). Portable.
            $table->string('image_url', 500)->nullable()->after('source_url');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('image_url');
        });
    }
};
