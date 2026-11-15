/**
 * شاشة الاستعراض (النطاق `browse.*`) — OWNED BY SLICE BROWSE.
 * مفردات الفلاتر منقولة عن مفاتيح filter.* في التطبيق (أُعيدت تسميتها
 * هنا وفق خريطة النطاقات الملزمة: شريحة الاستعراض تملك home/browse/reality فقط).
 */
export const ar: Record<string, string> = {
  "browse.pageTitle": "استعرض الوصفات",
  "browse.searchPlaceholder": "ابحث في الوصفات",
  "browse.clearSearch": "مسح البحث",
  "browse.searchHint": "ابحث بالاسم أو المكوّن — جرّب «دجاج بالأرز».",

  // التبويبات
  "browse.tabCategories": "التصنيفات",
  "browse.tabSearch": "البحث",
  "browse.tabFridge": "الثلاجة",

  // رقائق التصنيفات والفلاتر المتقدمة
  "browse.chipAll": "الكل",
  "browse.chipQuick": "أقل من ٣٠ دقيقة",
  "browse.filterTotalTime": "الوقت الكلي",
  "browse.filterAny": "أي مدة",
  "browse.filterTime30": "≤ ٣٠ دقيقة",
  "browse.filterTime45": "≤ ٤٥ دقيقة",
  "browse.filterTime60": "≤ ٦٠ دقيقة",
  "browse.filterSort": "الترتيب",
  "browse.sortDefault": "الافتراضي",
  "browse.sortFastest": "الأسرع",

  // فلتر الثلاجة
  "browse.fridgeTitle": "اطبخ بما في ثلاجتك",
  "browse.fridgeHint": "اختر حتى {max} مكوّنات — نرتّب أولًا الوصفات التي تستخدمها كلها.",
  "browse.fridgePlaceholder": "أضف مكوّنًا (مثل: ثوم)…",
  "browse.fridgeAdd": "إضافة مكوّن",
  "browse.fridgeCount": "{count}/{max}",
  "browse.fridgeLimit": "بحد أقصى {max} مكوّنات",
  "browse.ingChicken": "دجاج",
  "browse.ingRice": "أرز",
  "browse.ingBeef": "لحم",
  "browse.ingEggs": "بيض",
  "browse.ingPasta": "معكرونة",
  "browse.ingPotato": "بطاطس",
  "browse.ingTomato": "طماطم",
  "browse.ingLentils": "عدس",
  "browse.removeIngredient": "إزالة {label}",

  // النتائج
  "browse.noMatch": "لا توجد وصفات مطابقة — جرّب فلترًا آخر.",
  "browse.noResultsFor": "لا نتائج عن «{query}»",
  "browse.countOf": "{shown} من {total} وصفة",
  "browse.loadMore": "تحميل المزيد",
  "browse.loadingMore": "جارٍ تحميل المزيد…",
  "browse.emptyTitle": "لا توجد وصفات بعد",
  "browse.emptyBody": "المطبخ يسخن — عد قريبًا.",

  // عمليات البحث السابقة
  "browse.recentSearches": "عمليات بحث سابقة",
  "browse.clearRecent": "مسح",

  // إمكانية الوصول للبطاقات
  "browse.favoriteAdd": "أضف إلى المفضلة",
  "browse.favoriteRemove": "إزالة من المفضلة",
  "browse.ratingAria": "التقييم {rating} من ٥",
};
