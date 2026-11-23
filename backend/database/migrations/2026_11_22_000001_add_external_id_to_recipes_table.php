<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The dedup workbench's sync idempotency key: external_id = "{batch}:{line id}"
 * (unique where present; all other recipes keep null). A re-run of a failed
 * sync returns the existing recipe instead of double-inserting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipes', function (Blueprint $table): void {
            $table->string('external_id')->nullable()->after('source_type');
            $table->unique('external_id');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table): void {
            $table->dropUnique(['external_id']);
            $table->dropColumn('external_id');
        });
    }
};
