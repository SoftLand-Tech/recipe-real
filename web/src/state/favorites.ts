import { useCallback, useSyncExternalStore } from "react";

/**
 * Device-local favorites (contract: key 'rr_favorites_v1').
 *
 * There is NO backend favorites endpoint — the mobile app stores favorites in
 * on-device SQLite, and the web mirrors that product decision with
 * localStorage. Consequence (accepted): favorites are per-browser, not
 * per-account. Owned by the FOUNDATION because two slices consume it:
 * RECIPE (favorite toggle on the detail page) and ACCOUNT (favorites tab).
 *
 * Shape: string[] of recipe ids (strings for JSON stability; ids are numeric
 * on the wire). Mutations emit both an in-module listener set and a window
 * CustomEvent ('rr:favorites-changed') so non-React callers (toasts, future
 * service code) can react too.
 */

export const FAVORITES_KEY = "rr_favorites_v1";
export const FAVORITES_CHANGED_EVENT = "rr:favorites-changed";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Corrupt storage (manual edit, partial write) reads as empty — never
    // crash the app over a favorites cache.
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // Quota/private-mode failures are non-fatal: the in-memory list keeps
    // working for this session.
  }
}

// In-memory mirror so subscriptions update synchronously after mutations.
let cache: string[] | null = null;

function current(): string[] {
  if (cache === null) {
    cache = read();
  }
  return cache;
}

function commit(next: string[]): string[] {
  cache = next;
  write(next);
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT));
  emit();
  return next;
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Storage events fire when ANOTHER tab mutates the key — keep tabs in sync.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === FAVORITES_KEY) {
      cache = null; // invalidate; next current() re-reads
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function isFavorite(recipeId: number | string): boolean {
  return current().includes(String(recipeId));
}

/** Toggle and return the NEW id list (the id after toggling is IN the list iff it was added). */
export function toggleFavorite(recipeId: number | string): string[] {
  const id = String(recipeId);
  const list = current();
  return commit(list.includes(id) ? list.filter((v) => v !== id) : [id, ...list]);
}

/** Snapshot accessor for non-hook callers (kept for parity with the hook below). */
export function favoriteIds(): string[] {
  return [...current()];
}

/**
 * React binding. `ids` is a fresh array on every change (safe to map),
 * `isFavorite`/`toggle` are stable references safe for effect deps.
 */
export function useFavorites(): {
  ids: string[];
  isFavorite: (recipeId: number | string) => boolean;
  toggle: (recipeId: number | string) => void;
} {
  const ids = useSyncExternalStore(subscribe, favoriteIds);

  const toggle = useCallback((recipeId: number | string): void => {
    toggleFavorite(recipeId);
  }, []);

  return { ids, isFavorite, toggle };
}
