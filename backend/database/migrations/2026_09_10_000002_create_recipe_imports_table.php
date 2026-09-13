<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipe_imports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('recipe_id')->nullable()->constrained('recipes')->nullOnDelete();

            $table->string('status', 24)->default('queued')->index();
            $table->string('source_kind', 24);
            $table->string('source_platform', 32)->nullable();
            $table->text('source_url')->nullable();
            // Temporary private object-storage keys plus MIME/size metadata.
            // Paths are never returned by the API resource.
            $table->json('source_assets')->nullable();

            $table->string('provider', 80)->nullable();
            $table->string('provider_model', 120)->nullable();
            $table->string('stage', 32)->nullable();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->json('draft')->nullable();
            $table->json('warnings')->nullable();
            $table->json('confidence')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();

            $table->index(['requested_by', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipe_imports');
    }
};
