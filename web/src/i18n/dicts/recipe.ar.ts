/**
 * Recipe detail screen — Arabic (namespace `recipe.*`), OWNED BY SLICE RECIPE.
 * Terminology mirrors mobile/src/i18n/ar.ts (`detail.` / `quick.` / `notes.`).
 */
export const ar: Record<string, string> = {
  "recipe.pageTitle": "وصفة",
  "recipe.loadingRecipe": "جارٍ تحميل الوصفة…",
  "recipe.loadFailed": "تعذّر تحميل هذه الوصفة.",
  "recipe.backA11y": "رجوع",
  "recipe.shareA11y": "مشاركة",
  "recipe.favoriteAddA11y": "إضافة إلى المفضلة",
  "recipe.favoriteRemoveA11y": "إزالة من المفضلة",
  "recipe.shareCopied": "تم نسخ الرابط",

  // ---- Hero meta ----
  "recipe.ratingWithCount": "★ {rating} · {n} تقييم",
  "recipe.ratingOnly": "★ {rating}",

  // ---- Claimed vs. really takes (the signature pair; teal = measured) ----
  "recipe.beTheFirst": "كن أول من يجرّب!",
  "recipe.realitySlower": "⏱ يستغرق ~{pct}% وقتًا أطول من المزعوم",
  "recipe.realityFaster": "⚡ أسرع بنسبة ~{pct}% من المزعوم",
  "recipe.realityAccurate": "الوقت المزعوم دقيق",
  "recipe.cleanupAfter": "+ ~{time} تنظيفًا بعدها",
  "recipe.dishes": "{n} أطباق",
  "recipe.dishwasherSafe": "آمن لغسالة الصحون",
  "recipe.handWash": "غسل يدوي",
  "recipe.greaseLow": "دهون قليلة",
  "recipe.greaseMedium": "دهون متوسطة",
  "recipe.greaseHigh": "دهون مرتفعة",

  // ---- Ingredients (servings scaler + checklist) ----
  "recipe.ingredients": "المكونات",
  "recipe.noIngredients": "لا توجد مكونات مدرجة.",
  "recipe.servingsScaled": "{n} حصص",
  "recipe.scaleA11y": "مضاعفة المكونات {n}×",
  "recipe.clearChecked": "مسح المؤشرات",
  "recipe.checkedA11y": "{text}، محدّد",

  // ---- Steps ----
  "recipe.stepsTitle": "الخطوات",
  "recipe.handsOff": "بدون متابعة",
  "recipe.adjustedForYou": "~{time} لك",
  "recipe.stepOf": "الخطوة {n}",

  // ---- Cook-mode CTA + owner controls ----
  "recipe.startCookMode": "ابدأ وضع الطهي",
  "recipe.editRecipe": "تعديل الوصفة",

  // ---- Quick-time contribution ("it actually took N min") ----
  "recipe.quickDidYouMake": "هل طبخت هذه الوصفة؟",
  "recipe.quickOptional": "اختياري",
  "recipe.quickPlates": "عدد الأطباق",
  "recipe.quickHandsOn": "وقت العمل (دقيقة)",
  "recipe.quickTotal": "الوقت الكلي (دقيقة)",
  "recipe.quickCleanup": "الغسيل والتنظيف (دقيقة)",
  "recipe.quickSubmit": "إرسال",
  "recipe.quickThanksBreakdown": "شكرًا! متوسط الطبّاخين الآن ~{time}",
  "recipe.quickThanksOwn": "شكرًا لمساهمتك بوقتك!",
  "recipe.quickThanksOwnTime": "شكرًا! تم تسجيل وقتك.",
  "recipe.quickThanksCleanup": "متوسط التنظيف ~{cleanup}",
  "recipe.quickHandsOnTooLong": "لا يمكن أن يتجاوز وقت العمل الوقت الكلي.",
  "recipe.quickError": "تعذّر الإرسال. حاول مجددًا.",
  "recipe.quickSignInRequired": "سجّل الدخول للمساهمة بوقتك.",

  // ---- Community notes ----
  "recipe.notesTitle": "ملاحظات المجتمع",
  "recipe.notesEmpty": "لا ملاحظات عامة بعد. كن أول من يشارك نصيحة!",
  "recipe.notesLoadFailed": "تعذّر تحميل الملاحظات.",
  "recipe.loadMoreNotes": "تحميل المزيد",
  "recipe.noteComposePlaceholder": "شارك نصيحة مع بقية الطهاة…",
  "recipe.noteSend": "نشر",
  "recipe.notesSignIn": "سجّل الدخول للمشاركة في النقاش.",
  "recipe.notePostFailed": "تعذّر نشر ملاحظتك. حاول مرة أخرى.",
  "recipe.noteHalalBlocked": "يرجى إزالة هذه المصطلحات: {terms}",
  "recipe.noteDeleteConfirmTitle": "حذف هذه الملاحظة؟",
  "recipe.noteDeleteConfirmBody": "ستُحذف للجميع ولا يمكن التراجع.",
  "recipe.noteDeleted": "حُذفت الملاحظة",
  "recipe.noteReportConfirmTitle": "الإبلاغ عن هذه الملاحظة؟",
  "recipe.noteReportConfirmBody": "يراجع فريقنا البلاغات ويحذف ما يخالف القواعد.",
  "recipe.noteReported": "تم البلاغ — شكرًا",
  "recipe.reportAction": "إبلاغ",
};
