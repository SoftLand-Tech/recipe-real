import axios from "axios";
import * as SQLite from "expo-sqlite";

import {
  fetchRecipePage,
  fetchSeedPage,
  getPaceCalibrations,
  isOfflineError,
  postCookSessionRaw,
} from "@/api/http";
import type {
  CookSessionPayload,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/types";

const DB_NAME = "recipereal.db";

/** Current version of the local cache schema. Bump when columns/tables change. */
const CACHE_SCHEMA_VERSION = 6;

/**
 * Memoized ready-promise for the single DB connection.
 *
 * On app launch, both `_layout.tsx` (`initDatabase`) and `index.tsx`
 * (`loadFromCache` → `countCachedRecipes`) can call into the DB nearly
 * simultaneously. A plain lazy variable would let the second concurrent caller
 * also see `dbInstance === null` and open the database a SECOND time, which
 * makes expo-sqlite hand back a wrapper whose native handle is null — every
 * subsequent `prepareAsync` then throws NullPointerException.
 *
 * Memoizing the *promise* (not the resolved value) guarantees exactly one
 * `openDatabaseAsync` call, and all schema setup runs inside it so no query can
 * execute before the schema is ready.
 */
let dbReady: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Write-serialization chain: all MULTI-STATEMENT TRANSACTIONAL writes run
 * through this. Two overlapping `withTransactionAsync` calls on the SAME
 * connection race on BEGIN — the loser throws "cannot rollback - no
 * transaction is active" (its BEGIN failed inside the other transaction, so
 * its rollback has nothing to roll back). Screens fire several writers
 * concurrently at startup (seed continuation + light refresh + repair
 * check), so every transaction-taking public function wraps its work in
 * `runSerialized`.
 */
let writeChain: Promise<unknown> = Promise.resolve();

async function runSerialized<T>(job: () => Promise<T>): Promise<T> {
  const run = writeChain.then(job, job);
  // Keep the chain alive even if the job rejects.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbReady) {
    dbReady = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      try {
        await db.execAsync("PRAGMA journal_mode = WAL;");
      } catch {
        // Non-fatal: a PRAGMA failure must never break the connection.
      }
      try {
        await db.execAsync("PRAGMA foreign_keys = ON;");
      } catch {
        // Non-fatal: a PRAGMA failure must never break the connection.
      }
      await ensureSchema(db);
      return db;
    })();
  }
  return dbReady;
}

/** Full DDL for the recipes cache table (Week 4 shape + cleanup + ar cols). */
const RECIPES_DDL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    source_url TEXT,
    image_url TEXT,
    ingredients TEXT NOT NULL,
    steps TEXT NOT NULL,
    title_ar TEXT,
    ingredients_ar TEXT,
    steps_ar TEXT,
    publisher_time_minutes INTEGER,
    community_avg_minutes REAL,
    cleanup_avg_minutes REAL,
    cleanup_estimate_minutes REAL,
    dish_count INTEGER,
    grease_level TEXT,
    dishwasher_safe INTEGER
  );
`;

const RECIPE_STEPS_DDL = `
  CREATE TABLE IF NOT EXISTS recipe_steps (
    id INTEGER PRIMARY KEY,
    recipe_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    description_ar TEXT,
    step_type TEXT,
    publisher_minutes REAL,
    community_minutes REAL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );
`;

const RECIPE_STEPS_INDEX_DDL = `
  CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
    ON recipe_steps(recipe_id);
`;

/** Local favorites (offline): one row per favorited recipe, newest first. */
const FAVORITES_DDL = `
  CREATE TABLE IF NOT EXISTS favorites (
    recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
`;

/** Personal recipe notes (offline): one row per recipe, replaced on save. */
const NOTES_DDL = `
  CREATE TABLE IF NOT EXISTS notes (
    recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

const PENDING_COOK_SESSIONS_DDL = `
  CREATE TABLE IF NOT EXISTS pending_cook_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`;

const PACE_CALIBRATIONS_DDL = `
  CREATE TABLE IF NOT EXISTS pace_calibrations (
    step_type TEXT PRIMARY KEY,
    personal_avg_minutes REAL,
    community_avg_minutes REAL,
    multiplier REAL,
    confidence REAL
  );
`;

/**
 * Create the local cache tables mirroring recipes + recipe_steps, and evolve
 * the schema to CACHE_SCHEMA_VERSION when needed. Runs inside the memoized
 * `getDb()` promise so no query can execute before the schema is ready, and so
 * concurrent callers never trigger a second open.
 *
 * Schema bumps drop + recreate the recipe cache tables (the app re-seeds them
 * on the next seed call). The pending-cook-session, pace-calibration,
 * favorites, and notes tables are left untouched on a bump (their data is not
 * trivially re-derivable); the recipes-table drop cascade-deletes favorite and
 * note rows for wiped recipes, which is fine — the deterministic re-seed
 * restores the same ids, so re-favoriting / re-noting works against stable
 * rows.
 *
 * Each statement runs in its own `execAsync` call — concatenating multiple
 * statements into one string can fail silently on some drivers.
 */
async function ensureSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // Always ensure the meta + non-recipe tables exist.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  await db.execAsync(PENDING_COOK_SESSIONS_DDL);
  await db.execAsync(PACE_CALIBRATIONS_DDL);

  // Read the recorded schema version (missing on first launch / pre-Week-4).
  const metaRow = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM meta WHERE key = 'schema_version';`,
  );
  const recorded = metaRow?.value ? Number(metaRow.value) : 0;
  const needsBump =
    !Number.isFinite(recorded) || recorded < CACHE_SCHEMA_VERSION;

  if (needsBump) {
    // Drop the recipe cache tables so they get recreated at the current shape.
    // Favorites are intentionally NOT dropped (IF NOT EXISTS below): rows for
    // wiped recipes are cascade-deleted by the drop above, and the re-seed
    // restores the same deterministic ids.
    await db.execAsync("DROP TABLE IF EXISTS recipe_steps;");
    await db.execAsync("DROP TABLE IF EXISTS recipes;");
    await db.execAsync(RECIPES_DDL);
    await db.execAsync(RECIPE_STEPS_DDL);
    await db.execAsync(RECIPE_STEPS_INDEX_DDL);
    await db.execAsync(FAVORITES_DDL);
    await db.execAsync(NOTES_DDL);
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [String(CACHE_SCHEMA_VERSION)],
    );
  } else {
    // Already at the current version: just ensure tables exist (idempotent).
    await db.execAsync(RECIPES_DDL);
    await db.execAsync(RECIPE_STEPS_DDL);
    await db.execAsync(RECIPE_STEPS_INDEX_DDL);
    await db.execAsync(FAVORITES_DDL);
    await db.execAsync(NOTES_DDL);
  }
}

/**
 * Trigger early initialization of the SQLite cache (open + PRAGMAs + schema).
 * `_layout.tsx` calls this on app mount; screens that call DB functions also
 * `await getDb()` internally, so they always get a ready db.
 */
export function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getDb();
}

/** Row shape for the cached recipe table. */
interface RecipeRow {
  id: number;
  title: string;
  source_url: string | null;
  image_url: string | null;
  ingredients: string;
  steps: string;
  title_ar: string | null;
  ingredients_ar: string | null;
  steps_ar: string | null;
  publisher_time_minutes: number | null;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
  cleanup_estimate_minutes: number | null;
  dish_count: number | null;
  grease_level: string | null;
  dishwasher_safe: number | null;
}

interface RecipeStepRow {
  id: number;
  recipe_id: number;
  step_number: number;
  description: string;
  description_ar: string | null;
  step_type: string | null;
  publisher_minutes: number | null;
  community_minutes: number | null;
}

/** Parse a cached JSON array-of-strings column; null when absent/invalid. */
function parseJsonStringArray(raw: string | null): string[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Unparseable ar column: fall back to the English content.
  }
  return null;
}

function parseRecipe(row: RecipeRow): Recipe {
  let ingredients: string[] = [];
  try {
    const parsed = JSON.parse(row.ingredients);
    if (Array.isArray(parsed)) ingredients = parsed;
  } catch {
    ingredients = row.ingredients ? [row.ingredients] : [];
  }

  let steps: string[] = [];
  try {
    const parsed = JSON.parse(row.steps);
    if (Array.isArray(parsed)) steps = parsed;
  } catch {
    steps = row.steps ? [row.steps] : [];
  }

  const recipe: Recipe = {
    id: row.id,
    title: row.title,
    source_url: row.source_url,
    image_url: row.image_url ?? null,
    ingredients,
    steps,
    title_ar: row.title_ar ?? null,
    ingredients_ar: parseJsonStringArray(row.ingredients_ar),
    steps_ar: parseJsonStringArray(row.steps_ar),
    publisher_time_minutes: row.publisher_time_minutes,
    community_avg_minutes: row.community_avg_minutes,
    cleanup_avg_minutes: row.cleanup_avg_minutes,
    cleanup_estimate_minutes: row.cleanup_estimate_minutes,
  };

  // Reconstruct cleanup_factors only when at least one factor column is set,
  // so recipes without factors don't carry a meaningless empty object.
  const hasDish = row.dish_count != null;
  const hasGrease = row.grease_level != null && row.grease_level.length > 0;
  const hasDishwasher = row.dishwasher_safe != null;
  if (hasDish || hasGrease || hasDishwasher) {
    recipe.cleanup_factors = {
      dish_count: row.dish_count,
      grease_level: row.grease_level,
      dishwasher_safe: row.dishwasher_safe == null ? null : !!row.dishwasher_safe,
    };
  }

  return recipe;
}

function parseStep(row: RecipeStepRow): RecipeStep {
  return {
    id: row.id,
    step_number: row.step_number,
    description: row.description,
    description_ar: row.description_ar ?? null,
    step_type: row.step_type ?? "active",
    publisher_minutes: row.publisher_minutes,
    community_minutes: row.community_minutes,
  };
}

/**
 * Max rows per multi-row INSERT statement. 40 rows x 16 columns = 640 bound
 * parameters — safely under SQLite's per-statement variable limit even for
 * builds compiled with the conservative legacy default of 999.
 */
const INSERT_CHUNK_SIZE = 40;

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Upsert recipes into the local cache using chunked multi-row
 * INSERT OR REPLACE statements, all within a single transaction.
 *
 * - `withSteps: true` (and a recipe carrying `recipe_steps`): also replaces
 *   that recipe's cached steps. Stale rows are DELETEd per chunk first —
 *   INSERT OR REPLACE only resolves id conflicts, it can't remove steps the
 *   publisher has deleted since the last seed.
 * - `withSteps: false` (light refresh): the recipe_steps table is left
 *   completely untouched, preserving the offline step library.
 */
export async function upsertRecipes(
  recipes: Recipe[],
  opts: { withSteps?: boolean } = {},
): Promise<void> {
  if (recipes.length === 0) return;
  const db = await getDb();

  await runSerialized(() => db.withTransactionAsync(async () => {
    // -- Recipe rows: chunked multi-row INSERT OR REPLACE --------------------
    for (const batch of chunked(recipes, INSERT_CHUNK_SIZE)) {
      const placeholders = batch
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .join(", ");
      const params: (string | number | null)[] = [];
      for (const recipe of batch) {
        const factors = recipe.cleanup_factors;
        params.push(
          recipe.id,
          recipe.title,
          recipe.source_url ?? null,
          recipe.image_url ?? null,
          JSON.stringify(recipe.ingredients ?? []),
          JSON.stringify(recipe.steps ?? []),
          recipe.title_ar ?? null,
          recipe.ingredients_ar == null
            ? null
            : JSON.stringify(recipe.ingredients_ar),
          recipe.steps_ar == null ? null : JSON.stringify(recipe.steps_ar),
          recipe.publisher_time_minutes ?? null,
          recipe.community_avg_minutes ?? null,
          recipe.cleanup_avg_minutes ?? null,
          recipe.cleanup_estimate_minutes ?? null,
          factors?.dish_count ?? null,
          factors?.grease_level ?? null,
          factors?.dishwasher_safe == null ? null : factors.dishwasher_safe ? 1 : 0,
        );
      }
      // ON CONFLICT DO UPDATE (not INSERT OR REPLACE): REPLACE deletes the
      // row first, and recipe_steps has ON DELETE CASCADE + foreign_keys=ON,
      // which would wipe all cached steps on every light refresh.
      await db.runAsync(
        `INSERT INTO recipes
          (id, title, source_url, image_url, ingredients, steps,
           title_ar, ingredients_ar, steps_ar,
           publisher_time_minutes, community_avg_minutes, cleanup_avg_minutes,
           cleanup_estimate_minutes, dish_count, grease_level, dishwasher_safe)
         VALUES ${placeholders}
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, source_url=excluded.source_url,
           image_url=excluded.image_url, ingredients=excluded.ingredients,
           steps=excluded.steps,
           title_ar=excluded.title_ar, ingredients_ar=excluded.ingredients_ar,
           steps_ar=excluded.steps_ar,
           publisher_time_minutes=excluded.publisher_time_minutes,
           community_avg_minutes=excluded.community_avg_minutes,
           cleanup_avg_minutes=excluded.cleanup_avg_minutes,
           cleanup_estimate_minutes=excluded.cleanup_estimate_minutes,
           dish_count=excluded.dish_count, grease_level=excluded.grease_level,
           dishwasher_safe=excluded.dishwasher_safe;`,
        params,
      );
    }

    if (!opts.withSteps) return; // Light refresh: never touch cached steps.

    // Only recipes that actually carry steps participate in the step refresh;
    // the rest keep whatever steps are already cached.
    const withSteps = recipes.filter((r) => Array.isArray(r.recipe_steps));

    // Clear existing steps for these recipes first (chunked IN lists) so
    // steps removed upstream don't linger.
    for (const batch of chunked(withSteps, INSERT_CHUNK_SIZE)) {
      const ids = batch.map((r) => r.id);
      const inList = ids.map(() => "?").join(", ");
      await db.runAsync(
        `DELETE FROM recipe_steps WHERE recipe_id IN (${inList});`,
        ids,
      );
    }

    // -- Step rows: chunked multi-row INSERT OR REPLACE ----------------------
    const stepRows: { step: RecipeStep; recipeId: number }[] = [];
    for (const recipe of withSteps) {
      for (const step of recipe.recipe_steps ?? []) {
        stepRows.push({ step, recipeId: recipe.id });
      }
    }
    for (const batch of chunked(stepRows, INSERT_CHUNK_SIZE)) {
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: (string | number | null)[] = [];
      for (const { step, recipeId } of batch) {
        params.push(
          step.id,
          recipeId,
          step.step_number,
          step.description,
          step.description_ar ?? null,
          step.step_type ?? null,
          step.publisher_minutes ?? null,
          step.community_minutes ?? null,
        );
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO recipe_steps
          (id, recipe_id, step_number, description, description_ar, step_type,
           publisher_minutes, community_minutes)
         VALUES ${placeholders};`,
        params,
      );
    }
  }));
}

/** Page size for the progressive first-launch seed. */
const SEED_PAGE_SIZE = 50;
/** Hard safety cap for the background seed continuation (pages 2..N). */
const SEED_MAX_PAGES = 20;
/** Hard safety cap for the light background refresh. */
const REFRESH_MAX_PAGES = 10;

/**
 * Cold-cache seed, first page only: fetches one seed page (with steps) and
 * upserts it, returning the inserted recipes so the UI can render after ~¼
 * of the dataset instead of waiting for the whole multi-MB download.
 */
export async function seedCacheFirstPage(): Promise<Recipe[]> {
  const page = await fetchSeedPage(1, SEED_PAGE_SIZE);
  await upsertRecipes(page.recipes, { withSteps: true });
  return page.recipes;
}

/**
 * Seed continuation: fetch + upsert the remaining seed pages (with steps),
 * starting at page 2. Stops at the last page, an empty page, or the cap.
 * `opts.maxRecipes` (counting the already-seeded first page) lowers the cap:
 * 200 → stop after page 4 (4 × 50); without it the SEED_MAX_PAGES safety cap
 * applies (20 pages = 1,000 recipes).
 */
export async function seedCacheRemainingPages(
  opts: { maxRecipes?: number } = {},
): Promise<void> {
  const maxPages = opts.maxRecipes
    ? Math.max(1, Math.ceil(opts.maxRecipes / SEED_PAGE_SIZE))
    : SEED_MAX_PAGES;
  const cap = Math.min(maxPages, SEED_MAX_PAGES);
  for (let page = 2; page <= cap; page++) {
    const result = await fetchSeedPage(page, SEED_PAGE_SIZE);
    if (result.recipes.length === 0) break;
    await upsertRecipes(result.recipes, { withSteps: true });
    if (result.currentPage >= result.lastPage) break;
  }
}

/**
 * Clear the offline recipe cache (recipe_steps + recipes rows) while KEEPING
 * favorites, notes, and pace tables intact. Those tables reference recipes(id)
 * with ON DELETE CASCADE, so the deletes run with foreign-key enforcement
 * temporarily disabled on this same connection — the favorite/note rows then
 * survive, pointing at recipe ids the next sync deterministically re-creates.
 */
export async function clearRecipeCache(): Promise<void> {
  const db = await getDb();
  // Serialized: the FK PRAGMA toggles are connection-global and must never
  // interleave with another writer's transaction.
  await runSerialized(async () => {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    try {
      await db.execAsync("DELETE FROM recipe_steps;");
      await db.execAsync("DELETE FROM recipes;");
    } finally {
      await db.execAsync("PRAGMA foreign_keys = ON;");
    }
  });
}

/**
 * Light background refresh: fetch all recipe pages WITHOUT steps (small
 * payloads) and upsert them, leaving the cached step library untouched.
 */
export async function refreshCacheLight(): Promise<void> {
  for (let page = 1; page <= REFRESH_MAX_PAGES; page++) {
    const result = await fetchRecipePage(page, 100);
    if (result.recipes.length === 0) break;
    await upsertRecipes(result.recipes, { withSteps: false });
    if (result.currentPage >= result.lastPage) break;
  }
}

/**
 * Return cached recipes, optionally filtered by a client-side title search.
 */
export async function getCachedRecipes(opts: {
  search?: string;
} = {}): Promise<Recipe[]> {
  const db = await getDb();
  const search = opts.search?.trim();
  const rows: RecipeRow[] = search
    ? await db.getAllAsync<RecipeRow>(
        // Recipes with a photo surface first; alphabetical within each group.
        // Search matches the English title OR the Arabic title (if present).
        `SELECT * FROM recipes
         WHERE title LIKE ? OR title_ar LIKE ?
         ORDER BY image_url IS NULL, title COLLATE NOCASE ASC;`,
        `%${search}%`,
        `%${search}%`,
      )
    : await db.getAllAsync<RecipeRow>(
        `SELECT * FROM recipes ORDER BY image_url IS NULL, title COLLATE NOCASE ASC;`,
      );

  return rows.map(parseRecipe);
}

/**
 * Return a single cached recipe together with its ordered recipe_steps.
 * Returns null when the recipe is not present in the cache.
 */
export async function getCachedRecipe(id: number | string): Promise<Recipe | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecipeRow>(
    `SELECT * FROM recipes WHERE id = ?;`,
    Number(id),
  );
  if (!row) return null;

  const recipe = parseRecipe(row);
  const stepRows = await db.getAllAsync<RecipeStepRow>(
    `SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number ASC;`,
    Number(id),
  );
  recipe.recipe_steps = stepRows.map(parseStep);
  return recipe;
}

/** Number of recipes currently in the cache (used for first-launch detection). */
export async function countCachedRecipes(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM recipes;`,
  );
  return row?.count ?? 0;
}

/** Cached step-row count — used to detect a wiped step library. */
export async function countCachedRecipeSteps(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM recipe_steps;`,
  );
  return row?.count ?? 0;
}

/**
 * Self-heal a damaged cache: recipes present but the step library empty can
 * result from an older refresh that used INSERT OR REPLACE on recipes (the
 * recipe_steps ON DELETE CASCADE wiped them). Re-runs the paged seed (with
 * steps) to restore the offline step library. Returns true when a repair ran.
 */
export async function repairCachedStepsIfNeeded(): Promise<boolean> {
  const [recipeCount, stepCount] = await Promise.all([
    countCachedRecipes(),
    countCachedRecipeSteps(),
  ]);
  if (recipeCount === 0 || stepCount > 0) return false;
  await seedCacheFirstPage();
  await seedCacheRemainingPages();
  return true;
}

// ---- Favorites (local, offline) ---------------------------------------------

/** Ids of favorited recipes, newest favorite first. */
export async function getFavoriteIds(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ recipe_id: number }>(
    `SELECT recipe_id FROM favorites
     ORDER BY created_at DESC, recipe_id DESC;`,
  );
  return rows.map((row) => row.recipe_id);
}

/** Whether the given recipe is favorited. */
export async function isFavorite(id: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ recipe_id: number }>(
    `SELECT recipe_id FROM favorites WHERE recipe_id = ?;`,
    id,
  );
  return row != null;
}

/**
 * Toggle the favorite state of a recipe. Returns the NEW state (true =
 * favorited). Toggling off deletes the row; toggling on (re-)inserts with a
 * fresh created_at, bumping the recipe to the front of the favorites lists.
 */
export async function toggleFavorite(id: number): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ recipe_id: number }>(
    `SELECT recipe_id FROM favorites WHERE recipe_id = ?;`,
    id,
  );
  if (existing) {
    await db.runAsync(`DELETE FROM favorites WHERE recipe_id = ?;`, [id]);
    return false;
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO favorites (recipe_id, created_at) VALUES (?, ?);`,
    [id, Date.now()],
  );
  return true;
}

/**
 * Full Recipe objects for all favorites, newest favorite first. The INNER JOIN
 * skips favorite ids whose recipe row is missing from the cache.
 */
export async function getFavoriteRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecipeRow>(
    `SELECT recipes.* FROM favorites
       INNER JOIN recipes ON recipes.id = favorites.recipe_id
     ORDER BY favorites.created_at DESC, favorites.recipe_id DESC;`,
  );
  return rows.map(parseRecipe);
}

// ---- Personal recipe notes (local) -----------------------------------------

/** The saved note for a recipe, or null when the recipe has no note. */
export async function getNote(recipeId: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ note: string }>(
    `SELECT note FROM notes WHERE recipe_id = ?;`,
    recipeId,
  );
  return row?.note ?? null;
}

/**
 * Save (or clear) the personal note for a recipe. An empty/whitespace-only
 * note deletes the row, so `getNote` returns null again. Uses ON CONFLICT DO
 * UPDATE (not INSERT OR REPLACE) to match the upsert style used elsewhere.
 */
export async function saveNote(recipeId: number, note: string): Promise<void> {
  const db = await getDb();
  if (!note.trim()) {
    await db.runAsync(`DELETE FROM notes WHERE recipe_id = ?;`, [recipeId]);
    return;
  }
  await db.runAsync(
    `INSERT INTO notes (recipe_id, note, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(recipe_id) DO UPDATE SET
       note = excluded.note, updated_at = excluded.updated_at;`,
    [recipeId, note, Date.now()],
  );
}

/** Ids of recipes with a saved note, most recently updated first. */
export async function getNotedRecipeIds(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ recipe_id: number }>(
    `SELECT recipe_id FROM notes
     ORDER BY updated_at DESC, recipe_id DESC;`,
  );
  return rows.map((row) => row.recipe_id);
}

/**
 * Full Recipe objects together with their notes, newest note first. The INNER
 * JOIN skips note ids whose recipe row is missing from the cache (orphans).
 */
export async function getNotedRecipes(): Promise<
  { recipe: Recipe; note: string; updatedAt: number }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<
    RecipeRow & { note: string; updated_at: number }
  >(
    `SELECT recipes.*, notes.note AS note, notes.updated_at AS updated_at
       FROM notes
       INNER JOIN recipes ON recipes.id = notes.recipe_id
     ORDER BY notes.updated_at DESC, notes.recipe_id DESC;`,
  );
  return rows.map((row) => ({
    recipe: parseRecipe(row),
    note: row.note,
    updatedAt: row.updated_at,
  }));
}

// ---- Pending cook sessions (offline queue) ---------------------------------

interface PendingCookSessionRow {
  id: number;
  payload: string;
  created_at: number;
}

/**
 * Persist a cook-session payload locally so it can be synced later when the
 * device is back online. The raw JSON is stored verbatim.
 */
export async function enqueuePendingCookSession(
  payload: CookSessionPayload,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_cook_sessions (payload, created_at) VALUES (?, ?);`,
    [JSON.stringify(payload), Date.now()],
  );
}

/** Number of cook sessions waiting to be synced. */
export async function getPendingCookSessionCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pending_cook_sessions;`,
  );
  return row?.count ?? 0;
}

/**
 * Attempt to upload every queued cook session. Walks rows oldest-first; on
 * success deletes the row. On a network failure (no server reply — still
 * offline) it stops, since later rows would fail too. A row the SERVER
 * rejects (4xx/5xx — including 401 from an expired token, which would keep
 * failing without re-auth) is DEAD-LETTERED: deleted with a warning so one
 * bad row can't block every session behind it, and the flush continues with
 * the next row. Returns the number of rows successfully flushed.
 *
 * Uses `postCookSessionRaw` directly (which throws on any failure) rather than
 * `submitCookSession`, so a failure here doesn't re-enqueue and loop.
 */
export async function flushPendingCookSessions(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingCookSessionRow>(
    `SELECT * FROM pending_cook_sessions ORDER BY created_at ASC, id ASC;`,
  );

  let flushed = 0;
  for (const row of rows) {
    let payload: CookSessionPayload;
    try {
      payload = JSON.parse(row.payload) as CookSessionPayload;
    } catch {
      // Unparseable row — drop it so it doesn't block the queue forever.
      await db.runAsync(`DELETE FROM pending_cook_sessions WHERE id = ?;`, [
        row.id,
      ]);
      continue;
    }

    try {
      await postCookSessionRaw(payload);
    } catch (error) {
      if (isOfflineError(error)) {
        // No server reply: still offline — stop here, later rows would fail
        // too. They retry on the next flush.
        return flushed;
      }

      // The server answered and rejected this row (a non-axios throw, e.g.
      // a SecureStore failure, lands here too). Dead-letter it: delete the
      // row so one bad row can't block the sessions behind it, then keep
      // flushing the rest.
      const status =
        axios.isAxiosError(error) && error.response != null
          ? error.response.status
          : "n/a";
      console.warn(
        `[RecipeReal] Dead-lettering cook session ${payload.idempotency_key}: server rejected it (status ${status}); removing it from the pending queue.`,
      );
      await db.runAsync(`DELETE FROM pending_cook_sessions WHERE id = ?;`, [
        row.id,
      ]);
      continue;
    }

    await db.runAsync(`DELETE FROM pending_cook_sessions WHERE id = ?;`, [
      row.id,
    ]);
    flushed += 1;
  }

  return flushed;
}

// ---- Pace calibration cache (Week 3) ---------------------------------------

interface PaceCalibrationRow {
  step_type: string;
  personal_avg_minutes: number | null;
  community_avg_minutes: number | null;
  multiplier: number | null;
  confidence: number | null;
}

function parsePaceCalibration(row: PaceCalibrationRow): PaceCalibration {
  return {
    step_type: row.step_type,
    personal_avg_minutes: row.personal_avg_minutes,
    community_avg_minutes: row.community_avg_minutes,
    multiplier: row.multiplier ?? 1,
    confidence: row.confidence ?? 0,
  };
}

/**
 * Bulk-replace the cached pace calibrations. Runs within a single transaction:
 * clears all rows, then inserts each calibration keyed by step_type.
 */
export async function cachePaceCalibrations(
  items: PaceCalibration[],
): Promise<void> {
  const db = await getDb();
  await runSerialized(() => db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM pace_calibrations;");
    for (const item of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO pace_calibrations
          (step_type, personal_avg_minutes, community_avg_minutes,
           multiplier, confidence)
         VALUES (?, ?, ?, ?, ?);`,
        [
          item.step_type,
          item.personal_avg_minutes,
          item.community_avg_minutes,
          item.multiplier,
          item.confidence,
        ],
      );
    }
  }));
}

/** Return all cached pace calibrations. */
export async function getCachedPaceCalibrations(): Promise<PaceCalibration[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaceCalibrationRow>(
    `SELECT * FROM pace_calibrations;`,
  );
  return rows.map(parsePaceCalibration);
}

/**
 * Refresh pace calibrations from the network, cache the result, and return it.
 * Best-effort: on any error, falls back to the cached rows so callers can
 * degrade gracefully when offline.
 */
export async function refreshPaceCalibrations(): Promise<PaceCalibration[]> {
  try {
    const items = await getPaceCalibrations();
    await cachePaceCalibrations(items);
    return items;
  } catch (error) {
    console.warn("[RecipeReal] refreshPaceCalibrations failed:", error);
    return getCachedPaceCalibrations();
  }
}
