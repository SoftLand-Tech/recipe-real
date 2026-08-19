<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a nullable JSON text column `images` to the posts table.
     *
     * The effective image list is:
     *   - images (JSON array) when non-empty, OR
     *   - [image_url] when image_url is present (legacy single-image posts).
     *
     * On write (store): image_url is always set to images[0] so old clients
     * keep receiving a usable image_url. images is stored as JSON text.
     */
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // SQLite-safe: text column stores a JSON array of URL strings.
            $table->text('images')->nullable()->after('image_url');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('images');
        });
    }
};
