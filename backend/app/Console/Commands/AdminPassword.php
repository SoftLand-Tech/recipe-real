<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class AdminPassword extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'recipereal:admin-password {email : The admin account email}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Set (or reset) a login password for an admin account (the panel is Google-only otherwise).';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user === null) {
            $this->error("No user found with email: {$this->argument('email')}");

            return self::FAILURE;
        }

        $password = $this->secret('Password');
        $confirmation = $this->secret('Confirm password');

        $validator = Validator::make([
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], [
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user->forceFill(['password' => $password])->save();

        $this->info("Password set for {$user->email}.");

        $admins = collect(explode(',', (string) config('admin.emails')))
            ->map(fn (string $email): string => strtolower(trim($email)))
            ->filter()
            ->all();

        if (! in_array($email, $admins, true)) {
            $this->warn('NOTE: this email is not in ADMIN_EMAILS, so it cannot sign in to /admin. Add it to the ADMIN_EMAILS env var (comma-separated).');
        }

        return self::SUCCESS;
    }
}
