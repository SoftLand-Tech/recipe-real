/**
 * Home rails API — OWNED BY SLICE BROWSE.
 *
 * GET /api/home serves four curated light rails (top_rated / easy_wins /
 * most_loved / hands_off; 30-min versioned server cache — timing writes bust
 * it). `most_underestimated` is NOT served by /api/home: like mobile, the
 * caller merges it in from GET /api/reality (see api/reality.ts).
 *
 * The last successful payload is mirrored to localStorage so returning tabs
 * / back-navigation paint instantly (stale-while-revalidate) — the web twin
 * of mobile's AsyncStorage HOME_RAILS_KEY mirror, minus the SQLite layer.
 */
import { get } from "@/api/http";
import { normalizeRecipe } from "@/api/recipes";
import type { HomeRails, Recipe } from "@/api/types";

/** localStorage mirror key for the last successful rails payload. */
const HOME_RAILS_MIRROR_KEY = "rr_home_rails_v1";

/** Fill missing rails (older mirrors, partial payloads) with empty arrays. */
function railsWithDefaults(rails: Partial<HomeRails>): HomeRails {
  return {
    top_rated: rails.top_rated ?? [],
    easy_wins: rails.easy_wins ?? [],
    most_loved: rails.most_loved ?? [],
    hands_off: rails.hands_off ?? [],
    most_underestimated: rails.most_underestimated ?? [],
  };
}

const railRows = (value: unknown): Recipe[] =>
  Array.isArray(value) ? value.map(normalizeRecipe) : [];

/**
 * Fetch the curated rails (GET /api/home). Rows are light and some rails may
 * legitimately be empty until server data lands. Throws on network/server
 * failure so the caller can keep a mirrored payload or surface an error.
 */
export async function fetchHomeRails(): Promise<HomeRails> {
  const data = await get<{ data?: Partial<HomeRails> }>("/home");
  const src = data?.data ?? {};
  return {
    top_rated: railRows(src.top_rated),
    easy_wins: railRows(src.easy_wins),
    most_loved: railRows(src.most_loved),
    hands_off: railRows(src.hands_off),
    most_underestimated: [],
  };
}

/** Read the mirrored rails synchronously (null when absent/corrupt). */
export function readMirroredHomeRails(): HomeRails | null {
  try {
    const raw = window.localStorage.getItem(HOME_RAILS_MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HomeRails>;
    const rails = railsWithDefaults(parsed);
    const any =
      rails.top_rated.length > 0 ||
      rails.easy_wins.length > 0 ||
      rails.most_loved.length > 0 ||
      rails.hands_off.length > 0 ||
      rails.most_underestimated.length > 0;
    return any ? rails : null;
  } catch {
    // Corrupt/unreadable mirror — behave as absent.
    return null;
  }
}

/** Persist the rails mirror (best-effort; private-mode failures are fine). */
export function writeMirroredHomeRails(rails: HomeRails): void {
  try {
    window.localStorage.setItem(HOME_RAILS_MIRROR_KEY, JSON.stringify(rails));
  } catch {
    // Mirroring is best-effort; never disturb the UI over it.
  }
}
