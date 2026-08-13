import * as SQLite from "expo-sqlite";

import { getPaceCalibrations, postCookSessionRaw, seedRecipes } from "@/api/client";
import type {
  CookSessionPayload,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/types";

const DB_NAME = "recipereal.db";

/** Current version of the local cache schema. Bump when columns/tables change. */
const CACHE_SCHEMA_VERSION = 2;

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync("PRAGMA journal_mode = WAL;");
    await dbInstance.execAsync("PRAGMA foreign_keys = ON;");
  }
  return dbInstance;
}

/** Full DDL for the recipes cache table (Week 4 shape, incl. cleanup cols). */
const RECIPES_DDL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    source_url TEXT,
    ingredients TEXT NOT NULL,
    steps TEXT NOT NULL,
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
 * the schema to CACHE_SCHEMA_VERSION when needed. Safe to call repeatedly.
 *
 * Schema bumps drop + recreate the recipe cache tables (the app re-seeds them
 * on the next `seedAndCacheRecipes` call). The pending-cook-session and
 * pace-calibration tables are left untouched on a bump (their data is not
 * trivially re-derivable).
 */
export async function initDatabase(): Promise<void> {
  const db = await getDb();

  // Always ensure the meta + non-recipe tables exist.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    ${PENDING_COOK_SESSIONS_DDL}

    ${PACE_CALIBRATIONS_DDL}
  `);

  // Read the recorded schema version (missing on first launch / pre-Week-4).
  const metaRow = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM meta WHERE key = 'schema_version';`,
  );
  const recorded = metaRow?.value ? Number(metaRow.value) : 0;
  const needsBump =
    !Number.isFinite(recorded) || recorded < CACHE_SCHEMA_VERSION;

  if (needsBump) {
    // Drop the recipe cache tables so they get recreated at the current shape.
    await db.execAsync(`
      DROP TABLE IF EXISTS recipe_steps;
      DROP TABLE IF EXISTS recipes;

      ${RECIPES_DDL}
      ${RECIPE_STEPS_DDL}
      ${RECIPE_STEPS_INDEX_DDL}
    `);
    await db.runAsync(
      `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [String(CACHE_SCHEMA_VERSION)],
    );
  } else {
    // Already at the current version: just ensure tables exist (idempotent).
    await db.execAsync(`
      ${RECIPES_DDL}
      ${RECIPE_STEPS_DDL}
      ${RECIPE_STEPS_INDEX_DDL}
    `);
  }
}

/** Row shape for the cached recipe table. */
interface RecipeRow {
  id: number;
  title: string;
  source_url: string | null;
  ingredients: string;
  steps: string;
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
  step_type: string | null;
  publisher_minutes: number | null;
  community_minutes: number | null;
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
    ingredients,
    steps,
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
    step_type: row.step_type ?? "active",
    publisher_minutes: row.publisher_minutes,
    community_minutes: row.community_minutes,
  };
}

/**
 * Download the full seed dataset and bulk-replace it into the local cache.
 * Runs within a single transaction for atomicity.
 */
export async function seedAndCacheRecipes(): Promise<Recipe[]> {
  const recipes = await seedRecipes();
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    // Clear existing cache before re-seeding (full replace).
    await db.execAsync("DELETE FROM recipe_steps;");
    await db.execAsync("DELETE FROM recipes;");

    for (const recipe of recipes) {
      const factors = recipe.cleanup_factors;
      await db.runAsync(
        `INSERT OR REPLACE INTO recipes
          (id, title, source_url, ingredients, steps,
           publisher_time_minutes, community_avg_minutes, cleanup_avg_minutes,
           cleanup_estimate_minutes, dish_count, grease_level, dishwasher_safe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          recipe.id,
          recipe.title,
          recipe.source_url ?? null,
          JSON.stringify(recipe.ingredients ?? []),
          JSON.stringify(recipe.steps ?? []),
          recipe.publisher_time_minutes ?? null,
          recipe.community_avg_minutes ?? null,
          recipe.cleanup_avg_minutes ?? null,
          recipe.cleanup_estimate_minutes ?? null,
          factors?.dish_count ?? null,
          factors?.grease_level ?? null,
          factors?.dishwasher_safe == null ? null : factors.dishwasher_safe ? 1 : 0,
        ],
      );

      const steps = recipe.recipe_steps ?? [];
      for (const step of steps) {
        await db.runAsync(
          `INSERT OR REPLACE INTO recipe_steps
            (id, recipe_id, step_number, description, step_type,
             publisher_minutes, community_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            step.id,
            recipe.id,
            step.step_number,
            step.description,
            step.step_type ?? null,
            step.publisher_minutes ?? null,
            step.community_minutes ?? null,
          ],
        );
      }
    }
  });

  return recipes;
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
        `SELECT * FROM recipes WHERE title LIKE ? ORDER BY title COLLATE NOCASE ASC;`,
        `%${search}%`,
      )
    : await db.getAllAsync<RecipeRow>(
        `SELECT * FROM recipes ORDER BY title COLLATE NOCASE ASC;`,
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
 * success deletes the row, on network failure stops (later rows likely fail
 * too). Returns the number of rows successfully flushed.
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
      // Stop on the first failure: assume still offline.
      return flushed;
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
  await db.withTransactionAsync(async () => {
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
  });
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
