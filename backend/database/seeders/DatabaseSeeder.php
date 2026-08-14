<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Demo user for login smoke tests. (Profile is auto-created via the
        // User::created event defined on the model.) Uses firstOrCreate so the
        // seeder is idempotent and safe to run repeatedly. Local only: the
        // known credential must never exist in production.
        if (app()->environment('local')) {
            User::firstOrCreate(
                ['email' => 'cook@example.com'],
                [
                    'name' => 'Demo Cook',
                    'password' => 'password',
                    'skill_level' => 'intermediate',
                ],
            );
        }

        // The product: the hand-curated recipe catalogue.
        $this->call([
            RecipeSeeder::class,
        ]);
    }
}
