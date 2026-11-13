import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Recipe } from "@/types";

/**
 * AsyncStorage mirror for the unfiltered default page-1 Browse results
 * (`recipereal.browseMirror`: last successful unfiltered `{recipes, currentPage, lastPage, total, savedAt}`).
 *
 * Allows the Browse tab to paint instantly on cold mount without waiting
 * for network / skeletons, while fresh results reconcile silently in the background.
 *
 * All best-effort: storage failures never disturb the UI.
 */

export const BROWSE_MIRROR_KEY = "recipereal.browseMirror";

export interface BrowseMirrorEnvelope {
  recipes: Recipe[];
  currentPage: number;
  lastPage: number;
  total: number;
  savedAt: number;
}

/**
 * In-memory copy of the AsyncStorage browse envelope for synchronous
 * hydration and cheap reads.
 */
let cachedBrowseEnvelope: BrowseMirrorEnvelope | null | undefined;

/** Clear the in-memory envelope copy (e.g. on sign-out / cache wipe). */
export function clearMirroredBrowseCache(): void {
  cachedBrowseEnvelope = undefined;
}

/** Return the synchronous in-memory envelope if already loaded. */
export function getMirroredBrowseSync(): BrowseMirrorEnvelope | null {
  return cachedBrowseEnvelope ?? null;
}

/** Read the browse page-1 envelope from in-memory cache or AsyncStorage. */
export async function readMirroredBrowse(): Promise<BrowseMirrorEnvelope | null> {
  if (cachedBrowseEnvelope !== undefined) {
    return cachedBrowseEnvelope;
  }
  try {
    const raw = await AsyncStorage.getItem(BROWSE_MIRROR_KEY);
    if (!raw) {
      cachedBrowseEnvelope = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<BrowseMirrorEnvelope>;
    if (!parsed || !Array.isArray(parsed.recipes)) {
      cachedBrowseEnvelope = null;
      return null;
    }
    cachedBrowseEnvelope = {
      recipes: parsed.recipes,
      currentPage: typeof parsed.currentPage === "number" ? parsed.currentPage : 1,
      lastPage: typeof parsed.lastPage === "number" ? parsed.lastPage : 1,
      total: typeof parsed.total === "number" ? parsed.total : parsed.recipes.length,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
    return cachedBrowseEnvelope;
  } catch {
    return null;
  }
}

/** Overwrite the mirror with fresh unfiltered page-1 recipes. */
export async function writeMirroredBrowse(page: {
  recipes: Recipe[];
  currentPage?: number;
  lastPage?: number;
  total?: number;
}): Promise<void> {
  const envelope: BrowseMirrorEnvelope = {
    recipes: page.recipes,
    currentPage: page.currentPage ?? 1,
    lastPage: page.lastPage ?? 1,
    total: page.total ?? page.recipes.length,
    savedAt: Date.now(),
  };
  cachedBrowseEnvelope = envelope;
  try {
    await AsyncStorage.setItem(BROWSE_MIRROR_KEY, JSON.stringify(envelope));
  } catch {
    // Best-effort.
  }
}
