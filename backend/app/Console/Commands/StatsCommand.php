<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use App\Models\CookSession;
use App\Models\PaceCalibration;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class StatsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'recipereal:stats';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Print RecipeReal product metrics (activation/retention/revenue funnel).';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('RecipeReal — product metrics');
        $this->line(str_repeat('─', 48));

        // --- Users ----------------------------------------------------------
        $totalUsers = User::query()->count();
        $premiumUsers = User::query()
            ->whereHas('subscriptions', fn ($q) => $q
                ->where('stripe_status', 'active')
                ->whereNull('ends_at'))
            ->count();

        $this->info('Users');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Total users', $totalUsers],
                ['Premium subscribers', $premiumUsers],
                ['Premium share', $totalUsers > 0
                    ? round(($premiumUsers / $totalUsers) * 100, 1).'%'
                    : '0.0%'],
            ],
        );

        // --- Cook sessions --------------------------------------------------
        $totalSessions = CookSession::query()->count();
        $recentSessions = CookSession::query()
            ->where('created_at', '>=', now()->subDays(7))
            ->count();
        $avgMinutes = (float) (CookSession::query()
            ->whereNotNull('total_actual_minutes')
            ->avg('total_actual_minutes') ?? 0);

        $this->info('Cook sessions');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Total cook sessions', $totalSessions],
                ['Cook sessions (last 7 days)', $recentSessions],
                ['Avg total_actual_minutes', $totalSessions > 0
                    ? round($avgMinutes, 2).' min'
                    : '—'],
            ],
        );

        // --- Activation -----------------------------------------------------
        $usersWithSession = DB::table('cook_sessions')
            ->distinct('user_id')
            ->count('user_id');
        $activation = $totalUsers > 0
            ? round(($usersWithSession / $totalUsers) * 100, 1).'%'
            : '0.0%';

        $this->info('Activation');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Users with ≥1 cook session', $usersWithSession],
                ['Activation rate', $activation],
            ],
        );

        // --- Feedback breakdown --------------------------------------------
        $feedbackRows = CookSession::query()
            ->select('feedback', DB::raw('count(*) as cnt'))
            ->whereNotNull('feedback')
            ->whereIn('feedback', ['faster', 'as_expected', 'slower'])
            ->groupBy('feedback')
            ->pluck('cnt', 'feedback');

        $this->info('Feedback breakdown');
        $this->table(
            ['Feedback', 'Count'],
            [
                ['faster', $feedbackRows->get('faster', 0)],
                ['as_expected', $feedbackRows->get('as_expected', 0)],
                ['slower', $feedbackRows->get('slower', 0)],
            ],
        );

        // --- Pace calibration ----------------------------------------------
        $paceRows = PaceCalibration::query()->count();

        $this->info('Pace calibration');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Pace calibration rows (total)', $paceRows],
            ],
        );

        // --- Analytics: top events (last 7 days) ---------------------------
        $topEvents = AnalyticsEvent::query()
            ->select('name', DB::raw('count(*) as cnt'))
            ->where('created_at', '>=', now()->subDays(7))
            ->groupBy('name')
            ->orderByDesc('cnt')
            ->limit(10)
            ->get();

        $this->info('Analytics — top events (last 7 days)');
        if ($topEvents->isEmpty()) {
            $this->line('  (no events recorded in the last 7 days)');
        } else {
            $this->table(
                ['Event name', 'Count'],
                $topEvents->map(fn ($row) => [$row->name, $row->cnt])->all(),
            );
        }

        $this->line(str_repeat('─', 48));
        $this->info('Done.');

        return self::SUCCESS;
    }
}
