/**
 * Deterministic title → category mapping, mirroring the backend seeder's
 * keyword rules. Pure functions with zero imports — safe to use anywhere
 * (list filtering, detail screens, tests) with no bundle weight.
 */

/** Display order for the category filter chips ("other" is never shown). */
export const CATEGORIES = [
  { id: "pasta", label: "Pasta" },
  { id: "soup", label: "Soup" },
  { id: "curry", label: "Curry" },
  { id: "breakfast", label: "Breakfast" },
  { id: "salad", label: "Salad" },
  { id: "seafood", label: "Seafood" },
  { id: "bowl", label: "Bowls" },
  { id: "taco", label: "Tacos" },
  { id: "pizza", label: "Pizza" },
  { id: "burger", label: "Burgers" },
  { id: "sandwich", label: "Sandwiches" },
  { id: "stirfry", label: "Stir-fry" },
  { id: "sheetpan", label: "Roasted" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"] | "other";

/**
 * Matching precedence — first match wins. Deliberately NOT the display order:
 * curry beats soup ("curry soup" is a curry), and soup beats breakfast so
 * "egg drop soup" lands in Soup rather than Breakfast.
 */
const CATEGORY_RULES: ReadonlyArray<readonly [CategoryId, RegExp]> = [
  [
    "pasta",
    /spaghetti|penne|pasta|linguine|fettuccine|rigatoni|carbonara|lasagna|gnocchi|macaroni|noodle|cacio|bolognese|pesto|arrabbiata|puttanesca|alfredo|risotto|ramen|udon/,
  ],
  [
    "curry",
    /curry|tikka|korma|vindaloo|dal|makhani|biryani|masala|rogan/,
  ],
  [
    "soup",
    /soup|chowder|minestrone|pho|broth|gumbo|bisque|stew|goulash|posole|pozole|laksa/,
  ],
  [
    "breakfast",
    /egg|omelet|omelette|pancake|waffle|oatmeal|porridge|frittata|hash|breakfast|granola|shakshuka|avocado toast|french toast|scramble|benedict/,
  ],
  [
    "salad",
    /salad|slaw|caprese|cobb|caesar|niçoise|nicoise|tabbouleh|fattoush/,
  ],
  [
    "seafood",
    /salmon|shrimp|prawn|tuna|cod|halibut|sea bass|seafood|crab|lobster|scallops|mussels|clam|tilapia|trout|swordfish|snapper|barramundi|oyster/,
  ],
  [
    "bowl",
    /bowl|poke|bibimbap|grain|quinoa|buddha/,
  ],
  [
    "taco",
    /taco|burrito|quesadilla|fajita|enchilada|taquito|nacho/,
  ],
  [
    "pizza",
    /pizza|flatbread|calzone|margherita|focaccia/,
  ],
  [
    "burger",
    /burger|slider|patty/,
  ],
  [
    "sandwich",
    /sandwich|panini|wrap|melt|grilled cheese|cuban|banh mi|po.?boy|hoagie|muffuletta/,
  ],
  [
    "stirfry",
    /stir[- ]?fry|lo mein|chow mein|fried rice|kung pao|teriyaki|sweet and sour|pad thai|drunken noodle|mongolian/,
  ],
  [
    "sheetpan",
    /sheet pan|sheet-pan|roasted|traybake|one-pan|one pan/,
  ],
];

/** Map a recipe title to a category. Titles are matched case-insensitively. */
export function categorizeTitle(title: string): CategoryId {
  const t = title.toLowerCase();
  for (const [id, re] of CATEGORY_RULES) {
    if (re.test(t)) return id;
  }
  return "other";
}

/** Human label for a category id ("other" → "More"). */
export function categoryLabel(id: CategoryId): string {
  if (id === "other") return "More";
  return CATEGORIES.find((c) => c.id === id)?.label ?? "More";
}
