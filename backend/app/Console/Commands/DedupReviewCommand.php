<?php

namespace App\Console\Commands;

use App\Models\DuplicateCheck;
use App\Models\RecipeDuplicatePair;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Manual CLI twin of the Filament review actions (slice 6 ops — see
 * docs/recipe-dedup.md): resolves ONE needs_review duplicate_checks row and
 * records the human verdict APPEND-ONLY:
 *
 *   - recipe_duplicate_pairs row (confirmed_duplicate|confirmed_distinct,
 *     decided_by from --user-email, decided_at now, check_id back-link);
 *   - a NEW duplicate_checks row with source 'manual' recording the human
 *     decision (the engine's original row is NEVER deleted or overwritten —
 *     only its status flips needs_review → resolved);
 *   - recipes are never deleted here; the pair registry is the operative
 *     state (e.g. the import/generation flows honour it).
 *
 * Fails (exit 1) for unknown check ids, invalid verdicts and rows that are
 * not awaiting review. Without --user-email the decision falls back to the
 * repo's super-admin convention (first user matching the ADMIN_EMAILS
 * allowlist) and stays NULL when nobody matches.
 */
final class DedupReviewCommand extends Command
{
    protected $signature = 'recipereal:dedup-review {check_id} {verdict} {--user-email=}';

    protected $description = 'Record a manual review verdict (duplicate|distinct) for a needs_review duplicate check.';

    public function handle(): int
    {
        $verdict = (string) $this->argument('verdict');

        if (! in_array($verdict, ['duplicate', 'distinct'], true)) {
            $this->error('Verdict must be "duplicate" or "distinct".');

            return self::FAILURE;
        }

        $check = DuplicateCheck::query()->find((int) $this->argument('check_id'));

        if ($check === null) {
            $this->error(sprintf('Duplicate check #%s does not exist.', (string) $this->argument('check_id')));

            return self::FAILURE;
        }

        if ($check->status !== DuplicateCheck::STATUS_NEEDS_REVIEW) {
            $this->error(sprintf(
                'Duplicate check #%d is already "%s" (only needs_review rows can be reviewed; history is append-only).',
                $check->id,
                $check->status,
            ));

            return self::FAILURE;
        }

        $decidedBy = $this->resolveDecider($this->option('user-email'));
        $isDuplicate = $verdict === 'duplicate';

        if ($check->recipe_id === null || $check->matched_recipe_id === null) {
            $this->warn('The candidate was never persisted (recipe/matched recipe is null) — only the manual check row is recorded, no pair is possible.');
        }

        $pair = null;

        if ($check->recipe_id !== null && $check->matched_recipe_id !== null) {
            $pair = RecipeDuplicatePair::query()->updateOrCreate(
                [
                    'recipe_id' => (int) $check->recipe_id,
                    'duplicate_of_recipe_id' => (int) $check->matched_recipe_id,
                ],
                [
                    'source' => 'manual',
                    'status' => $isDuplicate
                        ? RecipeDuplicatePair::STATUS_CONFIRMED_DUPLICATE
                        : RecipeDuplicatePair::STATUS_CONFIRMED_DISTINCT,
                    'check_id' => $check->id,
                    'decided_by' => $decidedBy?->id,
                    'note' => sprintf('manual review of check #%d', $check->id),
                    'decided_at' => now(),
                ],
            );
        }

        // Append-only history: a NEW manual row records what the operator
        // decided; the original engine row only flips to resolved.
        $manual = DuplicateCheck::query()->create([
            'recipe_id' => $check->recipe_id,
            'matched_recipe_id' => $check->matched_recipe_id,
            'batch_id' => $check->batch_id,
            'source' => DuplicateCheck::SOURCE_MANUAL,
            'layer' => 0,
            'action' => $isDuplicate
                ? DuplicateCheck::ACTION_REJECTED_DUPLICATE
                : DuplicateCheck::ACTION_ACCEPTED,
            'is_duplicate' => $isDuplicate,
            'scores' => $check->scores,
            'classification' => null,
            'ai_confidence' => null,
            'reason' => sprintf('manual review of check #%d: confirmed %s', $check->id, $verdict),
            'differences' => $check->differences,
            'status' => DuplicateCheck::STATUS_RESOLVED,
        ]);

        $check->update(['status' => DuplicateCheck::STATUS_RESOLVED]);

        Log::info(sprintf(
            '[recipe-dedup review] check #%d resolved as %s by %s (manual check #%d%s).',
            $check->id,
            $verdict,
            $decidedBy?->email ?? 'nobody',
            $manual->id,
            $pair !== null ? sprintf(', pair #%d', $pair->id) : ', no pair (candidate not persisted)',
        ));

        $this->info(sprintf(
            'Check #%d resolved: %s recorded%s. Original check row kept as history (status=resolved).',
            $check->id,
            $verdict,
            $pair !== null ? sprintf(' in pair #%d', $pair->id) : '',
        ));

        if ($pair !== null) {
            $this->line('pair id: '.$pair->id);
        }

        return self::SUCCESS;
    }

    /**
     * The repo's super-admin convention (User::canAccessPanel /
     * AdminPassword): emails on the ADMIN_EMAILS allowlist. Explicit email
     * first; else the first admin user; else null.
     */
    private function resolveDecider(?string $email): ?User
    {
        if (filled($email)) {
            return User::query()->where('email', $email)->first();
        }

        $adminEmails = collect(explode(',', (string) config('admin.emails')))
            ->map(fn (string $admin): string => strtolower(trim($admin)))
            ->filter()
            ->all();

        foreach ($adminEmails as $adminEmail) {
            $user = User::query()->whereRaw('LOWER(email) = ?', [$adminEmail])->orderBy('id')->first();

            if ($user !== null) {
                return $user;
            }
        }

        return null;
    }
}
