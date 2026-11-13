/**
 * Tiny bounded in-memory SWR cache + in-flight request deduplication store.
 * Intentionally has zero imports so `@/api/http` and `@/api/client` can share
 * it without introducing require cycles.
 */

const MAX_CACHE_ENTRIES = 50;

interface CacheEntry<T = unknown> {
  data: T;
  savedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Return cached data for `key` if present and younger than `ttlMs`, else
 * `undefined`. Refreshes LRU insertion order on hit.
 */
export function getCached<T>(key: string, ttlMs: number): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.savedAt >= ttlMs) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.data as T;
}

/**
 * Store `data` under `key`, evicting the oldest entry if the cache exceeds
 * `MAX_CACHE_ENTRIES`.
 */
export function setCached<T>(key: string, data: T): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, savedAt: Date.now() });
}

/**
 * Deduplicate concurrent requests sharing `key`. Rejections are never
 * memoized: the in-flight slot is always cleared in `finally`.
 */
export function dedupeInFlight<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, promise);
  return promise;
}

/** Delete an exact cache entry (and any matching in-flight entry). */
export function invalidateKey(key: string): void {
  cache.delete(key);
  inFlight.delete(key);
}

/** Delete all cached entries (and in-flight tracking) whose key starts with `prefix`. */
export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) {
      inFlight.delete(key);
    }
  }
}

/** Drop all cached entries and in-flight tracking (e.g. on logout or 401). */
export function clearSwrCache(): void {
  cache.clear();
  inFlight.clear();
}
