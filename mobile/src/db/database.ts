import * as SQLite from "expo-sqlite";

import { postCookSessionRaw, seedRecipes } from "@/api/client";
import type { CookSessionPayload, Recipe, RecipeStep } from "@/types";

const DB_NAME = "recipereal.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync("PRAGMA journal_mode = WAL;");
    await dbInstance.execAsync("PRAGMA foreign_keys = ON;");
  }
  return dbInstance;
}

/**
 * Create the local cache tables mirroring recipes + recipe_steps.
 * Safe to call repeatedly (uses IF NOT EXISTS).
 */
export async function initDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      source_url TEXT,
      ingredients TEXT NOT NULL,
      steps TEXT NOT NULL,
      publisher_time_minutes INTEGER,
      community_avg_minutes REAL,
      cleanup_avg_minutes REAL
    );

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

    CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
      ON recipe_steps(recipe_id);

    CREATE TABLE IF NOT EXISTS pending_cook_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
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

  return {
    id: row.id,
    title: row.title,
    source_url: row.source_url,
    ingredients,
    steps,
    publisher_time_minutes: row.publisher_time_minutes,
    community_avg_minutes: row.community_avg_minutes,
    cleanup_avg_minutes: row.cleanup_avg_minutes,
  };
}

function parseStep(row: RecipeStepRow): RecipeStep {
  return {
    id: row.id,
    step_number: row.step_number,
    description: row.description,
    step_type: row.step_type ?? "prep",
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
      await db.runAsync(
        `INSERT OR REPLACE INTO recipes
          (id, title, source_url, ingredients, steps,
           publisher_time_minutes, community_avg_minutes, cleanup_avg_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          recipe.id,
          recipe.title,
          recipe.source_url ?? null,
          JSON.stringify(recipe.ingredients ?? []),
          JSON.stringify(recipe.steps ?? []),
          recipe.publisher_time_minutes ?? null,
          recipe.community_avg_minutes ?? null,
          recipe.cleanup_avg_minutes ?? null,
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
