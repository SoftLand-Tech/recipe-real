/**
 * Favorites screen (namespace `favorites.*`) — OWNED BY SLICE ACCOUNT.
 * Favorites are device-local (localStorage 'rr_favorites_v1', no backend
 * endpoint). Arabic mirrors mobile/src/i18n/ar.ts.
 */
export const ar: Record<string, string> = {
  "favorites.pageTitle": "المفضلة",
  "favorites.subtitle": "اطبخها مجددًا — وصفاتك المحفوظة",
  "favorites.count": "{n} وصفة",
  "favorites.deviceLocal":
    "تُحفظ المفضلة في هذا المتصفح لا في حسابك، وتعمل حتى دون تسجيل الدخول.",
  "favorites.emptyTitle": "لا مفضلات بعد",
  "favorites.emptyCaption": "اضغط القلب على أي وصفة لحفظها هنا.",
  "favorites.browseRecipes": "استعرض الوصفات",
  "favorites.removeA11y": "إزالة {title} من المفضلة",
  "favorites.someFailed": "تعذّر تحميل {n} من المفضلات.",
};
