/**
 * Notification inbox (namespace `notifications.*`) — OWNED BY SLICE ACCOUNT.
 * Arabic mirrors mobile/src/i18n/ar.ts notif.* + rel.* vocabulary (the
 * relative-time keys live under this namespace on the web: `rel.*` is not
 * an ACCOUNT-owned prefix).
 */
export const ar: Record<string, string> = {
  "notifications.pageTitle": "الإشعارات",
  "notifications.markAllRead": "تحديد الكل كمقروء",
  "notifications.likedYourPost": "أعجب {name} بمنشورك",
  "notifications.commented": "علّق {name}: {snippet}",
  "notifications.commentedYourPost": "علّق {name} على منشورك",
  "notifications.someone": "شخص ما",
  "notifications.moderationTitle": "تنبيه إشرافي",
  "notifications.moderationDefault": "اتخذ المشرف إجراءً بشأن المحتوى الخاص بك.",
  "notifications.empty": "لا إشعارات بعد",
  "notifications.emptyCaption": "الإعجابات والتعليقات على منشوراتك ستظهر هنا.",
  "notifications.loadFailed": "تعذّر تحميل الإشعارات.",
  "notifications.postGone": "هذا المنشور لم يعد متاحًا.",
  "notifications.loadMore": "تحميل المزيد",
  "notifications.unreadA11y": "{n} غير مقروء",

  // Relative time (mobile's rel.* vocabulary, namespaced here).
  "notifications.relNow": "الآن",
  "notifications.relMinutesAgo": "قبل {n} د",
  "notifications.relHoursAgo": "قبل {n} س",
  "notifications.relDaysAgo": "قبل {n} يوم",
  "notifications.relWeeksAgo": "قبل {n} أسبوع",
  "notifications.relMonthsAgo": "قبل {n} شهر",
};
