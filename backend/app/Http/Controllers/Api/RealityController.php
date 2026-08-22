<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeCardResource;
use App\Models\Recipe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Reality Index (public): the recipes whose honest time diverges the most
 * from the publisher's claim.
 *
 *  - mode=under (default): most underestimated — recipes taking far
 *    LONGER than claimed (gap_pct DESC).
 *  - mode=over: faster than claimed (gap_pct ASC).
 *
 * Only recipes with a reality signal (community or estimate — the source is
 * labeled on every row via the card resource's reality object), a positive
 * publisher claim to divide by, and quality-tier-eligible presentation
 * (>= 2 steps + an image). Cached 15 minutes: the gap-pct ordering scans
 * the matched rows, rows carry a stable id tiebreaker, and 15 minutes of
 * staleness is fine for a leaderboard (deploy-time cache:clear busts).
 */
class RealityController extends Controller
{
    private const DEFAULT_TAKE = 10;

    private const MAX_TAKE = 50;

    private const MODES = ['under', 'over'];

    public function __invoke(Request $request): JsonResponse
    {
        $mode = (string) $request->string('mode', 'under');
        if (! in_array($mode, self::MODES, true)) {
            $mode = 'under';
        }
        $take = max(1, min(self::MAX_TAKE, $request->integer('take', self::DEFAULT_TAKE)));

        // The cache holds plain attribute arrays (this app's cache forbids
        // unserializing classes — cache.serializable_classes = false), so
        // rows are hydrated back into models before resource conversion —
        // same pattern as the home rails.
        $rows = Cache::remember(
            "reality:{$mode}:{$take}",
            now()->addMinutes(15),
            fn () => $this->buildRows($mode, $take)
        );

        return response()->json([
            'data' => RecipeCardResource::collection(Recipe::hydrate($rows))->resolve(),
        ]);
    }

    /**
     * @return list<array<string, mixed>> raw recipe attributes
     */
    private function buildRows(string $mode, int $take): array
    {
        return Recipe::query()
            ->select(RecipeCardResource::COLUMNS)
            ->whereIn('reality_source', ['community', 'estimate'])
            ->where('publisher_time_minutes', '>', 0)
            // Quality-tier-eligible presentation only (the full tier also
            // requires rating/reviews — not relevant to honest timing).
            ->where('steps_count', '>=', 2)
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            // Sanity bounds: estimate-path recipes with literal "overnight"
            // steps can produce absurd gaps (a 40-min claim vs a 50-hour
            // estimate = +7335%) — a leaderboard of typos is not a
            // leaderboard. Keep gaps plausible: -80%..+400%, reality <= 8h.
            ->whereBetween('reality_minutes', [1, 480])
            ->whereBetween(
                DB::raw('(reality_minutes - publisher_time_minutes) * 100.0 / publisher_time_minutes'),
                [-80, 400],
            )
            // gap_pct in SQL, exactly as RecipeResource computes it:
            // (reality - claimed) / claimed * 100.
            ->orderByRaw(
                '(reality_minutes - publisher_time_minutes) * 100.0 / publisher_time_minutes '
                .($mode === 'under' ? 'DESC' : 'ASC')
            )
            ->orderBy('id')
            ->limit($take)
            ->get()
            ->map(fn (Recipe $recipe) => $recipe->getAttributes())
            ->all();
    }
}
