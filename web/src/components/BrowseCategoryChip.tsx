/**
 * BrowseCategoryChip — a server category chip with display-only localization.
 * OWNED BY SLICE BROWSE.
 *
 * The server's English category strings are the source of truth for
 * filtering (chip id, ?filter= param, server `category` matching), so the
 * Arabic map below is ONLY applied at render time — never fed back into
 * queries (port of mobile utils/categories.ts). The optional count comes
 * from GET /api/recipes/categories.
 */
import { useLang } from "@/i18n";
import { cn } from "@/utils/cn";

/** Frozen English → Arabic category label map (curated, mobile parity). */
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

/** Localized category label for DISPLAY only (never for filtering). */
export function localizedCategoryLabel(
  label: string | null | undefined,
  lang: string,
): string {
  if (label == null) return "";
  return lang === "ar" ? (CATEGORY_AR[label] ?? label) : label;
}

export interface BrowseCategoryChipProps {
  /** The ORIGINAL server category string (never pre-localized). */
  label: string;
  /** Recipe count from /recipes/categories, rendered muted after the label. */
  count?: number | null;
  /** Selected state (soft-apricot ground, ember text). */
  active?: boolean;
  /** Extra classes for the pill (e.g. disabled opacity). */
  className?: string;
}

export function BrowseCategoryChip({
  label,
  count,
  active = false,
  className,
}: BrowseCategoryChipProps) {
  const { lang } = useLang();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5",
        "font-body text-[13px] font-bold tracking-wide",
        active ? "bg-orange-soft text-orange-deep" : "bg-cream-deep text-muted",
        className,
      )}
    >
      {localizedCategoryLabel(label, lang)}
      {count != null ? (
        <span className={cn("text-[11.5px]", active ? "text-orange-deep/70" : "text-faint")}>
          {count.toLocaleString()}
        </span>
      ) : null}
    </span>
  );
}
