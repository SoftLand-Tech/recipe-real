/**
 * Browse (route /browse): Categories / Search / Fridge tabs. OWNED BY SLICE
 * BROWSE.
 *
 * Web adaptation of mobile's browse screen (the single search+chips+filters
 * surface) into three tabs, keeping the API call semantics identical:
 *   - Categories: GET /api/recipes/categories chips → the category's recipes
 *     via GET /api/recipes/search with `category` (case-insensitive server
 *     match), "Under 30" quick chip (max_time=30), plus the Any/30/45/60
 *     total-time chips and Default/Fastest sort — mobile's buildSearchParams
 *     minus its SQLite-only cleanup sort.
 *   - Search: 300ms-debounced `q` (mobile uses 350ms; the web contract pins
 *     300ms), recent searches persisted in localStorage.
 *   - Fridge: multi-ingredient chips (5 max, bilingual staples + custom
 *     entries) collapsed into ONE space-joined `q` of English stems — the
 *     exact param mobile sends (see api/recipes.ts fridgeQuery).
 * Deep links: /browse?filter=<category|quick> selects the Categories chip
 * (consume-once), /browse?focus=1 opens Search with the field focused.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import {
  fetchCategories,
  fridgeQuery,
  FRIDGE_STAPLES,
  isFridgeStaple,
  MAX_FRIDGE_ITEMS,
  normalizeFridgeText,
} from "@/api/recipes";
import type { CategoryCount, SearchParams, SearchSort } from "@/api/types";
import { BrowseCategoryChip } from "@/components/BrowseCategoryChip";
import { Chip } from "@/components/Chip";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n";

import { BrowseRecipeGrid } from "./BrowseRecipeGrid";

/** Search debounce (contract: 300ms on the web; mobile uses 350ms). */
const SEARCH_DEBOUNCE_MS = 300;

/** Visible category chips — capped at mobile's 8 so the row stays one glance. */
const CATEGORY_CHIP_LIMIT = 8;

/** Recent searches persisted on the device (web-only nicety, optional). */
const RECENT_KEY = "rr_recent_searches_v1";
const RECENT_LIMIT = 8;

type TabId = "categories" | "search" | "fridge";

/**
 * Active list filter on the Categories tab: a server category string or the
 * "quick" time filter. The category id IS the label — the exact string is
 * sent to the server (case-insensitive match), display is localized.
 */
type ListFilter =
  | { kind: "all" }
  | { kind: "quick" }
  | { kind: "category"; id: string; label: string };

/** Parse the ?filter= param (Home's craving chips deep link). */
function parseParamFilter(value: string): ListFilter | null {
  if (!value) return null;
  if (value === "quick") return { kind: "quick" };
  return { kind: "category", id: value, label: value };
}

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    // Corrupt/unreadable — behave as empty.
    return [];
  }
}

function writeRecents(list: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Best-effort persistence (private mode).
  }
}

const TABS: { id: TabId; key: string }[] = [
  { id: "categories", key: "browse.tabCategories" },
  { id: "search", key: "browse.tabSearch" },
  { id: "fridge", key: "browse.tabFridge" },
];

export default function BrowsePage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- Tabs + deep links (?filter= / ?focus=1) ------------------------------
  // Deep links only ever arrive at MOUNT (Home links here from a different
  // route), so initial state is derived from the URL and the params are then
  // stripped consume-once — repeat navigation re-applies them.
  const [tab, setTab] = useState<TabId>(() =>
    searchParams.get("focus") === "1" ? "search" : "categories",
  );
  const focusOnceRef = useRef(searchParams.get("focus") === "1");

  // ---- Categories tab state ----------------------------------------------------
  const [filter, setFilter] = useState<ListFilter>(
    () => parseParamFilter(searchParams.get("filter") ?? "") ?? { kind: "all" },
  );
  const [timeMax, setTimeMax] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "fastest">("default");
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const categoryChips = categories.slice(0, CATEGORY_CHIP_LIMIT);

  // Consume-once: strip the deep-link params after mount state has read them.
  useEffect(() => {
    if (searchParams.get("filter") == null && searchParams.get("focus") == null) {
      return;
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => {
        // Chips fall back to hidden; All/Quick still work.
      });
    return () => {
      active = false;
    };
  }, []);

  // Search params for the Categories tab — mobile's buildSearchParams minus
  // the q/fridge parts (those live on their own tabs here): quick = min(30,
  // timeMax|30), category only when selected, sort only when fastest.
  const categoriesParams = useMemo<SearchParams>(
    () => ({
      ...(filter.kind === "category" ? { category: filter.label } : {}),
      ...(filter.kind === "quick"
        ? { maxTime: Math.min(30, timeMax ?? 30) }
        : timeMax != null
          ? { maxTime: timeMax }
          : {}),
      ...(sortMode === "fastest" ? { sort: "fastest" as SearchSort } : {}),
    }),
    [filter, timeMax, sortMode],
  );

  const hasCategoriesFilters =
    filter.kind !== "all" || timeMax != null || sortMode !== "default";

  // ---- Search tab state ---------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(readRecents);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce typed input (300ms); chip/filter changes elsewhere commit
  // immediately because they never flow through this state. A committed
  // non-empty query is pushed onto recents inside the same (async) callback.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === committedQuery) return;
    const timer = window.setTimeout(() => {
      setCommittedQuery(trimmed);
      if (trimmed.length > 0) {
        setRecents((prev) => {
          if (prev[0] === trimmed) return prev;
          return [trimmed, ...prev.filter((r) => r !== trimmed)].slice(
            0,
            RECENT_LIMIT,
          );
        });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, committedQuery]);

  // Persist recents whenever they change (external-store sync).
  useEffect(() => {
    writeRecents(recents);
  }, [recents]);

  // Autofocus once when arriving via /browse?focus=1.
  useEffect(() => {
    if (focusOnceRef.current && tab === "search") {
      searchInputRef.current?.focus();
      focusOnceRef.current = false;
    }
  }, [tab]);

  const searchParamsForGrid = useMemo<SearchParams>(
    () => (committedQuery.length > 0 ? { q: committedQuery } : {}),
    [committedQuery],
  );

  // ---- Fridge tab state -----------------------------------------------------------
  const [fridgeItems, setFridgeItems] = useState<string[]>([]);
  const [fridgeInput, setFridgeInput] = useState("");
  const atFridgeLimit = fridgeItems.length >= MAX_FRIDGE_ITEMS;
  const customFridgeItems = fridgeItems.filter((item) => !isFridgeStaple(item));
  const fridgeTokensParam = useMemo<SearchParams>(
    () =>
      fridgeItems.length > 0
        ? { q: fridgeQuery(fridgeItems) }
        : {},
    [fridgeItems],
  );

  /** Toggle a chip (staple id or custom string), normalized for dedupe. */
  const toggleFridgeItem = (raw: string) => {
    const cleaned = raw.trim().replace(/\s+/g, " ").toLowerCase();
    const normalizedKey = normalizeFridgeText(cleaned);
    if (!normalizedKey) return;
    setFridgeItems((prev) => {
      const idx = prev.findIndex((x) => normalizeFridgeText(x) === normalizedKey);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_FRIDGE_ITEMS) return prev;
      return [...prev, cleaned];
    });
  };

  /** Add a custom ingredient: matches a staple's en/ar/id → its staple id. */
  const addCustomFridgeItem = (raw: string) => {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    const normalized = cleaned.toLowerCase();
    const normalizedAr = normalizeFridgeText(cleaned);
    const matched = FRIDGE_STAPLES.find(
      (s) =>
        s.id === normalized ||
        s.en === normalized ||
        normalizeFridgeText(s.ar) === normalizedAr,
    );
    const nextItem = matched ? matched.id : normalized;
    const nextKey = normalizeFridgeText(nextItem);
    setFridgeItems((prev) => {
      if (prev.some((x) => normalizeFridgeText(x) === nextKey)) return prev;
      if (prev.length >= MAX_FRIDGE_ITEMS) return prev;
      return [...prev, nextItem];
    });
  };

  const submitFridgeInput = () => {
    if (atFridgeLimit) return;
    const trimmed = fridgeInput.trim();
    if (!trimmed) return;
    addCustomFridgeItem(trimmed);
    setFridgeInput("");
  };

  // ---- Render helpers ---------------------------------------------------------------
  const activeFilterLabel =
    filter.kind === "category"
      ? filter.label
      : filter.kind === "quick"
        ? t("browse.chipQuick")
        : null;

  return (
    <div>
      <h1 className="font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-tight text-ink">
        {t("browse.pageTitle")}
      </h1>

      {/* ---- Tab bar ------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label={t("browse.pageTitle")}
        className="mt-5 flex w-fit gap-1.5 rounded-pill border border-hair bg-white p-1.5"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "rounded-pill px-4 py-2 font-body text-[14px] font-bold transition-colors md:px-5",
              tab === entry.id
                ? "bg-orange-soft text-orange-deep"
                : "text-muted hover:text-ink",
            )}
          >
            {t(entry.key)}
          </button>
        ))}
      </div>

      {/* ---- Categories tab -------------------------------------------------- */}
      {tab === "categories" ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFilter({ kind: "all" })}>
              <BrowseCategoryChip
                label={t("browse.chipAll")}
                active={filter.kind === "all"}
              />
            </button>
            {categoryChips.map((chip) => {
              const active =
                filter.kind === "category" &&
                filter.id.toLowerCase() === chip.category.toLowerCase();
              return (
                <button
                  key={chip.category}
                  type="button"
                  onClick={() =>
                    setFilter({
                      kind: "category",
                      id: chip.category,
                      label: chip.category,
                    })
                  }
                >
                  <BrowseCategoryChip
                    label={chip.category}
                    count={chip.count}
                    active={active}
                  />
                </button>
              );
            })}
            <button type="button" onClick={() => setFilter({ kind: "quick" })}>
              <BrowseCategoryChip
                label={t("browse.chipQuick")}
                active={filter.kind === "quick"}
              />
            </button>
          </div>

          {/* Advanced filters: total time + sort (mobile's panel chips). */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-faint">
              {t("browse.filterTotalTime")}
            </span>
            {[
              { max: null, key: "browse.filterAny" },
              { max: 30, key: "browse.filterTime30" },
              { max: 45, key: "browse.filterTime45" },
              { max: 60, key: "browse.filterTime60" },
            ].map((option) => (
              <Chip
                key={option.max ?? "any"}
                label={t(option.key)}
                active={timeMax === option.max}
                onClick={() => setTimeMax(option.max)}
              />
            ))}
            <span className="ms-2 font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-faint">
              {t("browse.filterSort")}
            </span>
            <Chip
              label={t("browse.sortDefault")}
              active={sortMode === "default"}
              onClick={() => setSortMode("default")}
            />
            <Chip
              label={t("browse.sortFastest")}
              active={sortMode === "fastest"}
              onClick={() => setSortMode("fastest")}
            />
          </div>

          {activeFilterLabel != null ? (
            <p className="mt-4 font-body text-[13.5px] font-semibold text-muted">
              {activeFilterLabel}
            </p>
          ) : null}

          <div className="mt-4">
            <BrowseRecipeGrid
              params={categoriesParams}
              emptyTitle={
                hasCategoriesFilters
                  ? t("browse.noMatch")
                  : t("browse.emptyTitle")
              }
              emptyBody={
                hasCategoriesFilters ? undefined : t("browse.emptyBody")
              }
            />
          </div>
        </section>
      ) : null}

      {/* ---- Search tab -------------------------------------------------------- */}
      {tab === "search" ? (
        <section className="mt-6">
          <div className="flex items-center gap-3 rounded-pill border border-hair bg-white px-5 py-3">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("browse.searchPlaceholder")}
              aria-label={t("browse.searchPlaceholder")}
              autoComplete="off"
              className="w-full bg-transparent font-body text-[15px] text-ink outline-none placeholder:text-faint"
            />
            {searchInput.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label={t("browse.clearSearch")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-faint transition-colors hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            ) : null}
          </div>

          {committedQuery.length === 0 ? (
            <div className="mt-6">
              <p className="font-body text-[14px] text-muted">
                {t("browse.searchHint")}
              </p>
              {recents.length > 0 ? (
                <>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <h2 className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-faint">
                      {t("browse.recentSearches")}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setRecents([]);
                        writeRecents([]);
                      }}
                      className="rounded-pill px-3 py-1 font-body text-[13px] font-bold text-orange-deep transition-colors hover:bg-orange-soft"
                    >
                      {t("browse.clearRecent")}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recents.map((recent) => (
                      <Chip
                        key={recent}
                        label={recent}
                        onClick={() => {
                          setSearchInput(recent);
                          setCommittedQuery(recent);
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mt-5">
              <BrowseRecipeGrid
                params={searchParamsForGrid}
                emptyTitle={t("browse.noResultsFor", {
                  query: committedQuery,
                })}
              />
            </div>
          )}
        </section>
      ) : null}

      {/* ---- Fridge tab ----------------------------------------------------------- */}
      {tab === "fridge" ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(1.25rem,2.2vw,1.6rem)] font-semibold leading-tight text-ink">
                {t("browse.fridgeTitle")}
              </h2>
              <p className="mt-1 font-body text-[13.5px] text-muted">
                {t("browse.fridgeHint", { max: MAX_FRIDGE_ITEMS })}
              </p>
            </div>
            {fridgeItems.length > 0 ? (
              <p
                className={cn(
                  "shrink-0 font-body text-[13px] font-bold",
                  atFridgeLimit ? "text-orange-deep" : "text-muted",
                )}
              >
                {t("browse.fridgeCount", {
                  count: fridgeItems.length,
                  max: MAX_FRIDGE_ITEMS,
                })}
              </p>
            ) : null}
          </div>

          {/* Staples + selected custom chips. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {FRIDGE_STAPLES.map((staple) => {
              const selected = fridgeItems.includes(staple.id);
              const disabled = atFridgeLimit && !selected;
              return (
                <Chip
                  key={staple.id}
                  label={t(staple.labelKey)}
                  active={selected}
                  disabled={disabled}
                  className={disabled ? "opacity-45" : undefined}
                  onClick={() => toggleFridgeItem(staple.id)}
                />
              );
            })}
            {customFridgeItems.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleFridgeItem(item)}
                aria-label={t("browse.removeIngredient", { label: item })}
                className="inline-flex items-center gap-1.5 rounded-pill bg-orange-soft px-3.5 py-1.5 font-body text-[13px] font-bold tracking-wide text-orange-deep"
              >
                {item}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            ))}
          </div>

          {/* Custom ingredient input. */}
          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitFridgeInput();
            }}
          >
            <input
              type="text"
              value={fridgeInput}
              onChange={(e) => setFridgeInput(e.target.value)}
              maxLength={40}
              disabled={atFridgeLimit}
              placeholder={t("browse.fridgePlaceholder")}
              aria-label={t("browse.fridgePlaceholder")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-pill border border-hair bg-white px-5 py-2.5 font-body text-[14.5px] text-ink outline-none placeholder:text-faint disabled:opacity-55"
            />
            <button
              type="submit"
              disabled={atFridgeLimit || fridgeInput.trim().length === 0}
              aria-label={t("browse.fridgeAdd")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill transition-colors disabled:border-hair disabled:bg-cream-deep disabled:text-faint bg-orange text-white hover:bg-orange-deep"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </form>
          {atFridgeLimit ? (
            <p className="mt-2 font-body text-[12.5px] text-faint">
              {t("browse.fridgeLimit", { max: MAX_FRIDGE_ITEMS })}
            </p>
          ) : null}

          {fridgeItems.length === 0 ? null : (
            <div className="mt-6">
              <BrowseRecipeGrid
                params={fridgeTokensParam}
                emptyTitle={t("browse.noMatch")}
              />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
