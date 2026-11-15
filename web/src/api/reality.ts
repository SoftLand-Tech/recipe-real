/**
 * Reality Index API — OWNED BY SLICE BROWSE.
 *
 * GET /api/reality?mode=under|over&take=N returns the recipes whose honest
 * time diverges most from the publisher's claim (cached 15 min server-side,
 * timing writes bust it). Two flavors mirror mobile's split:
 *   - fetchRealityRows: throws on failure — the leaderboard PAGE surfaces an
 *     error + retry instead of a misleading empty state.
 *   - fetchRealityRail: catches everything → [] — the HOME rail hides
 *     silently rather than degrading the rest of the screen.
 */
import { get } from "@/api/http";
import { normalizeRecipe } from "@/api/recipes";
import type { Recipe } from "@/api/types";

export type RealityMode = "under" | "over";

/**
 * Fetch the reality leaderboard rows. `take` is clamped server-side to
 * 1..50 (default 10). Rows are light cards that always carry the `reality`
 * block (source-labeled) and a positive publisher claim to compare against.
 */
export async function fetchRealityRows(
  mode: RealityMode = "under",
  take = 10,
): Promise<Recipe[]> {
  const data = await get<{ data?: unknown }>("/reality", {
    params: { mode, take },
  });
  const rows = data?.data;
  return Array.isArray(rows) ? rows.map(normalizeRecipe) : [];
}

/**
 * The home "most underestimated" rail: any failure or non-array payload
 * resolves to an empty list so Home can hide the rail silently (mobile
 * parity — see mobile client.ts fetchRealityRail).
 */
export async function fetchRealityRail(
  mode: RealityMode = "under",
): Promise<Recipe[]> {
  try {
    return await fetchRealityRows(mode, 10);
  } catch {
    // Offline / server error / not deployed yet: hide the rail.
    return [];
  }
}
