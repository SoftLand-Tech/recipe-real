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
        Schema::create('app_releases', function (Blueprint $table) {
            $table->id();
            // Human version ("1.0.0") shown on the landing page + APK filename.
            $table->string('version', 32);
            // Private-disk path (storage/app/private/apks/...) of the signed APK.
            $table->string('file_path');
            $table->unsignedBigInteger('file_size');
            // Integrity fingerprint computed at upload; shown to power users.
            $table->string('sha256', 64)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('uploaded_by')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app_releases');
    }
};
