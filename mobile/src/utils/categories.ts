/**
 * Display-only translation of the SERVER Food.com category strings. The
 * underlying English strings are the source of truth for filtering (chip id,
 * ?filter= param, server `category` matching), so this map is ONLY ever used
 * at render time — never for routing or query construction.
 */

/** Frozen English → Arabic category label map (verbatim curated set). */
export const CATEGORY_AR: Readonly<Record<string, string>> = Object.freeze({
  Dessert: "حلويات",
  "Main Course": "طبق رئيسي",
  Breakfast: "فطور",
  "Side Dish": "طبق جانبي",
  Bread: "خبز",
  "Lunch/Snacks": "غداء ووجبات خفيفة",
  Vegetable: "خضار",
  "One Dish Meal": "وجبة من طبق واحد",
  Sauce: "صلصة",
  Sauces: "صلصات",
  Soup: "شوربة",
  Salad: "سلطة",
  Appetizer: "مقبلات",
  "Quick Breads": "خبز سريع",
  Breads: "خبز ومعجنات",
  Chicken: "دجاج",
  "Chicken Breast": "صدر دجاج",
  "Yeast Breads": "خبز بالخميرة",
  Potato: "بطاطس",
  Snack: "وجبة خفيفة",
  Meat: "لحم",
  Beverage: "مشروب",
  Beverages: "مشروبات",
  "Bar Cookie": "كيك مقطع",
  "Drop Cookies": "كوكيز",
  Pie: "فطيرة",
  "Savory Pies": "فطائر مالحة",
  Cheese: "جبن",
  Candy: "حلوى",
  Steak: "ستيك",
  Curries: "كاري",
  Stew: "يخنة",
  Poultry: "دواجن",
  Spreads: "أطعمة للفرد",
  "Very Low Carbs": "كربوهيدرات منخفضة جدًا",
  Rice: "أرز",
  "Salad Dressings": "تتبيلات سلطة",
  Cheesecake: "تشيز كيك",
  Corn: "ذرة",
  "Household Cleaner": "منظفات منزلية",
});

/**
 * Localized category label for display. When `lang` is "ar" and a mapping
 * exists, returns the Arabic translation; otherwise the original label
 * (null-safe). The returned value must never be fed back into filters.
 */
export function localizedCategory(
  label: string | null | undefined,
  lang: string,
): string {
  if (lang === "ar" && label != null) {
    return CATEGORY_AR[label] ?? label;
  }
  return label ?? "";
}