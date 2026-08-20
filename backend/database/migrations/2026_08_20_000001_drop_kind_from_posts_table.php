<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('posts', 'kind')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropColumn('kind');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('posts', 'kind')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->string('kind', 10)->nullable()->after('user_id');
            });
        }
    }
};
