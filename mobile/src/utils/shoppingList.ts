import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOPPING_LIST_STORAGE_KEY = "recipereal.shoppingList.v1";

export interface ShoppingListItem {
  id: string;
  text: string;
  recipeId: number | null;
  recipeTitle: string | null;
  checked: boolean;
  createdAt: number;
}

export interface ShoppingListAddInput {
  text: string;
  recipeId?: number | null;
  recipeTitle?: string | null;
}

let idSequence = 0;
let mutationQueue: Promise<unknown> = Promise.resolve();

function generateItemId(): string {
  idSequence = (idSequence + 1) % 1_000_000;
  return `${Date.now()}-${idSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDedupKey(text: string, recipeId: number | null): string {
  return `${recipeId ?? "custom"}::${text.trim().toLowerCase()}`;
}

function isValidItem(entry: unknown): entry is ShoppingListItem {
  if (entry == null || typeof entry !== "object") return false;
  const candidate = entry as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0 &&
    (candidate.recipeId === null || typeof candidate.recipeId === "number") &&
    (candidate.recipeTitle === null ||
      typeof candidate.recipeTitle === "string") &&
    typeof candidate.checked === "boolean" &&
    typeof candidate.createdAt === "number"
  );
}

function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(fn, fn);
  mutationQueue = next.catch(() => {});
  return next;
}

async function readShoppingListRaw(): Promise<ShoppingListItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

async function writeShoppingList(items: ShoppingListItem[]): Promise<void> {
  await AsyncStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(items));
}

export async function getShoppingList(): Promise<ShoppingListItem[]> {
  return enqueueMutation(readShoppingListRaw);
}

export async function addShoppingListItems(
  items: ShoppingListAddInput[],
): Promise<ShoppingListItem[]> {
  return enqueueMutation(async () => {
    const existing = await readShoppingListRaw();
    const seen = new Set(
      existing.map((item) => normalizeDedupKey(item.text, item.recipeId)),
    );

    const added: ShoppingListItem[] = [];
    const now = Date.now();
    for (const entry of items) {
      const trimmed = entry.text.trim();
      if (!trimmed) continue;
      const recipeId =
        typeof entry.recipeId === "number" && Number.isFinite(entry.recipeId)
          ? entry.recipeId
          : null;
      const key = normalizeDedupKey(trimmed, recipeId);
      if (seen.has(key)) continue;
      seen.add(key);
      added.push({
        id: generateItemId(),
        text: trimmed,
        recipeId,
        recipeTitle: entry.recipeTitle?.trim() || null,
        checked: false,
        createdAt: now,
      });
    }

    if (added.length === 0) return existing;
    const next = [...added, ...existing];
    await writeShoppingList(next);
    return next;
  });
}

export async function toggleShoppingListItem(
  id: string,
): Promise<ShoppingListItem[]> {
  return enqueueMutation(async () => {
    const existing = await readShoppingListRaw();
    let changed = false;
    const next = existing.map((item) => {
      if (item.id !== id) return item;
      changed = true;
      return { ...item, checked: !item.checked };
    });
    if (!changed) return existing;
    await writeShoppingList(next);
    return next;
  });
}

export async function removeShoppingListItem(
  id: string,
): Promise<ShoppingListItem[]> {
  return enqueueMutation(async () => {
    const existing = await readShoppingListRaw();
    const next = existing.filter((item) => item.id !== id);
    if (next.length === existing.length) return existing;
    await writeShoppingList(next);
    return next;
  });
}

export async function clearCheckedShoppingListItems(): Promise<
  ShoppingListItem[]
> {
  return enqueueMutation(async () => {
    const existing = await readShoppingListRaw();
    const next = existing.filter((item) => !item.checked);
    if (next.length === existing.length) return existing;
    await writeShoppingList(next);
    return next;
  });
}
