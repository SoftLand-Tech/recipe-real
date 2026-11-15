/**
 * Browse screen (namespace `browse.*`) — OWNED BY SLICE BROWSE.
 * Filter vocabulary mirrors mobile's filter.* keys (re-namespaced here per
 * the binding namespace map: BROWSE owns home/browse/reality only).
 */
export const en: Record<string, string> = {
  "browse.pageTitle": "Browse",
  "browse.searchPlaceholder": "Search recipes",
  "browse.clearSearch": "Clear search",
  "browse.searchHint":
    "Search by title or ingredient — try “chicken biryani”.",

  // Tabs
  "browse.tabCategories": "Categories",
  "browse.tabSearch": "Search",
  "browse.tabFridge": "Fridge",

  // Category chips + advanced filters
  "browse.chipAll": "All",
  "browse.chipQuick": "Under 30 min",
  "browse.filterTotalTime": "Total time",
  "browse.filterAny": "Any",
  "browse.filterTime30": "≤ 30 min",
  "browse.filterTime45": "≤ 45 min",
  "browse.filterTime60": "≤ 60 min",
  "browse.filterSort": "Sort",
  "browse.sortDefault": "Default",
  "browse.sortFastest": "Fastest",

  // Fridge filter
  "browse.fridgeTitle": "Cook with what's in your fridge",
  "browse.fridgeHint":
    "Pick up to {max} staples — recipes using them all are ranked first.",
  "browse.fridgePlaceholder": "Add ingredient (e.g. garlic)…",
  "browse.fridgeAdd": "Add ingredient",
  "browse.fridgeCount": "{count}/{max}",
  "browse.fridgeLimit": "Up to {max} ingredients",
  "browse.ingChicken": "Chicken",
  "browse.ingRice": "Rice",
  "browse.ingBeef": "Beef",
  "browse.ingEggs": "Eggs",
  "browse.ingPasta": "Pasta",
  "browse.ingPotato": "Potato",
  "browse.ingTomato": "Tomato",
  "browse.ingLentils": "Lentils",
  "browse.removeIngredient": "Remove {label}",

  // Results
  "browse.noMatch": "No recipes match — try another filter.",
  "browse.noResultsFor": 'No results for "{query}"',
  "browse.countOf": "{shown} of {total} recipes",
  "browse.loadMore": "Load more",
  "browse.loadingMore": "Loading more…",
  "browse.emptyTitle": "No recipes yet",
  "browse.emptyBody": "The kitchen is warming up — check back soon.",

  // Recent searches
  "browse.recentSearches": "Recent searches",
  "browse.clearRecent": "Clear",

  // Card a11y
  "browse.favoriteAdd": "Add to favorites",
  "browse.favoriteRemove": "Remove from favorites",
  "browse.ratingAria": "Rated {rating} out of 5",
};
