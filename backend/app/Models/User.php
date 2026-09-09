<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Cashier\Billable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'skill_level', 'google_sub', 'avatar_url', 'display_name', 'bio', 'gender'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use Billable, HasApiTokens, HasFactory, Notifiable;

    /**
     * Boot the model and auto-create a profile on user creation.
     */
    protected static function booted(): void
    {
        static::created(function (User $user): void {
            $user->profile()->create([
                'display_name' => $user->name,
            ]);
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'banned_at' => 'datetime',
        ];
    }

    /**
     * Whether the account is currently suspended by a moderator.
     */
    public function isBanned(): bool
    {
        return $this->banned_at !== null;
    }

    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }

    public function cookSessions(): HasMany
    {
        return $this->hasMany(CookSession::class);
    }

    public function timingSubmissions(): HasMany
    {
        return $this->hasMany(TimingSubmission::class);
    }

    public function paceCalibrations(): HasMany
    {
        return $this->hasMany(PaceCalibration::class);
    }

    /**
     * Recipes authored by this user (community platform, source_type='user').
     */
    public function recipes(): HasMany
    {
        return $this->hasMany(Recipe::class, 'owner_id');
    }

    public function recipeNotes(): HasMany
    {
        return $this->hasMany(RecipeNote::class);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    public function follows(): HasMany
    {
        return $this->hasMany(Follow::class, 'follower_id');
    }

    public function followers(): HasMany
    {
        return $this->hasMany(Follow::class, 'followed_id');
    }

    /**
     * Whether the user has an active subscription to the default plan.
     */
    public function isPremium(): bool
    {
        return $this->subscribed('default');
    }

    /**
     * Filament panel access: only emails listed in ADMIN_EMAILS (comma-
     * separated, case-insensitive) may enter; an empty list locks everyone
     * out. Read from config() so it survives `php artisan config:cache`.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        if ($panel->getId() !== 'admin') {
            return false;
        }

        $admins = collect(explode(',', (string) config('admin.emails')))
            ->map(fn (string $email): string => strtolower(trim($email)))
            ->filter()
            ->all();

        if ($admins === []) {
            return false;
        }

        return in_array(strtolower((string) $this->email), $admins, true);
    }
}
