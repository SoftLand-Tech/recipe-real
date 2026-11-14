<?php

namespace App\Jobs;

use App\Models\PaceCalibration;
use App\Models\TimingSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RecalculatePaceCalibration implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $userId) {}

    /**
     * Recompute per-step_type pace calibration rows for the user.
     */
    public function handle(): void
    {
        $submissions = TimingSubmission::where('user_id', $this->userId)
            ->whereHas('recipeStep')
            ->with(['recipeStep:id,step_type,community_avg_minutes'])
            ->get();

        if ($submissions->isEmpty()) {
            return;
        }

        $grouped = $submissions->groupBy(fn (TimingSubmission $submission) => $submission->recipeStep->step_type);

        foreach ($grouped as $stepType => $group) {
            $kept = $group->filter(function (TimingSubmission $submission): bool {
                $community = $submission->recipeStep->community_avg_minutes;

                // Keep when community time is missing/non-positive; otherwise drop outliers > 2x community.
                if ($community === null || $community <= 0) {
                    return true;
                }

                return $submission->actual_minutes <= (2 * $community);
            })->values();

            if ($kept->isEmpty()) {
                continue;
            }

            $sampleSize = $kept->count();

            $personalAvg = $this->round2($kept->avg('actual_minutes'));
            $communityAvg = $this->round2($kept->avg(fn (TimingSubmission $submission) => $submission->recipeStep->community_avg_minutes));

            PaceCalibration::updateOrCreate(
                [
                    'user_id' => $this->userId,
                    'step_type' => $stepType,
                ],
                [
                    'personal_avg_minutes' => $personalAvg,
                    'community_avg_minutes' => $communityAvg,
                    'confidence' => $this->round2(min($sampleSize / 10, 1)),
                ]
            );
        }
    }

    private function round2(float|int|string|null $value): float
    {
        return round((float) ($value ?? 0), 2);
    }
}
