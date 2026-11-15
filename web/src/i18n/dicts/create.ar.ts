/**
 * نطاق الإنشاء (create.*) — ملك شريحة CREATE.
 * يغطي مركز الإنشاء ومحرر الوصفات (جديدة/تعديل) ورسائل التحقق.
 * المصطلحات منقولة عن mobile/src/i18n/ar.ts (قسم composer.*).
 */
export const ar: Record<string, string> = {
  "create.pageTitle": "إنشاء",
  "create.recipeComposerTitle": "وصفة جديدة",

  // ---- المركز --------------------------------------------------------------------
  "create.hubSubtitle": "شارك وصفة تحفظها عن ظهر قلب — أو دع الذكاء الاصطناعي يستخرجها لك.",
  "create.writeTitle": "اكتب وصفة",
  "create.writeBody": "اكتبها خطوة بخطوة، بالإنجليزية أو العربية أو كلتيهما.",
  "create.importTitle": "استيراد من رابط أو صورة أو فيديو",
  "create.importBody": "الصق رابط وصفة عامًا أو ارفع فيديو — يستخرج الذكاء الاصطناعي المسودة لتراجعها.",
  "create.summaryTitle": "مطبخك",
  "create.recipesChip": "{n} وصفة",
  "create.activeImportsChip": "{n} قيد الاستخراج",
  "create.readyImportsChip": "{n} جاهزة للمراجعة",

  // ---- حالات صفحة المحرر --------------------------------------------------------------
  "create.newTitle": "وصفة جديدة",
  "create.editTitle": "تعديل الوصفة",
  "create.loadingRecipe": "جارٍ تحميل الوصفة…",
  "create.loadFailed": "تعذّر تحميل هذه الوصفة. حاول مرة أخرى.",
  "create.loadNotEditable":
    "هذه الوصفة غير متاحة للتعديل — قد تكون غير موجودة أو تخص حسابًا آخر.",

  // ---- الصورة ---------------------------------------------------------------------
  "create.photo": "الصورة",
  "create.addPhotoHint": "أضف صورة للوصفة",
  "create.imageHint": "JPG أو PNG أو WebP · حتى ٤ ميغابايت",
  "create.changePhoto": "تغيير الصورة",
  "create.removeImage": "إزالة الصورة",

  // ---- الأساسيات ---------------------------------------------------------------------
  "create.basics": "الأساسيات",
  "create.basicsHint": "سمِّ وصفتك وعرّف الطهاة بها.",
  "create.titleLabel": "عنوان الوصفة",
  "create.titleEn": "العنوان (إنجليزي)",
  "create.titleAr": "العنوان (عربي)",
  "create.titlePlaceholder": "مثال: دجاج الليمون بمقلاة واحدة",
  "create.titleArPlaceholder": "One-pan lemon chicken",
  "create.addTranslation": "إضافة ترجمة",
  "create.hideTranslation": "إخفاء الترجمة",

  // ---- الحصص والوقت ---------------------------------------------------------------------
  "create.timing": "الحصص والوقت",
  "create.servings": "عدد الحصص",
  "create.minutes": "الوقت الكلي (دقيقة)",
  "create.prepMinutes": "التحضير (دقيقة)",
  "create.cookMinutes": "الطهي (دقيقة)",
  "create.unitMin": "دقيقة",
  "create.sourceUrl": "رابط المصدر",
  "create.sourceUrlPlaceholder": "رابط الوصفة الأصلي",
  "create.moreDetails": "تفاصيل إضافية",
  "create.optional": "اختياري",
  "create.category": "التصنيف",
  "create.servingsMinusA11y": "تقليل الحصص",
  "create.servingsPlusA11y": "زيادة الحصص",

  // ---- المكونات ---------------------------------------------------------------------------
  "create.ingredients": "المكونات",
  "create.ingredientsHint": "واحد في كل سطر، حتى ٦٠ مكونًا.",
  "create.ingredientPlaceholder": "مثال: ٢ كوب أرز",
  "create.ingredientA11y": "المكون {n}",
  "create.addIngredient": "إضافة مكون",
  "create.removeRow": "إزالة",

  // ---- الخطوات ------------------------------------------------------------------------------
  "create.steps": "الخطوات",
  "create.stepsHint": "ما يجب فعله بالترتيب. العربي والدقائق اختياريان.",
  "create.stepDescriptionPlaceholder": "ماذا تفعل…",
  "create.stepArPlaceholder": "English (optional)",
  "create.stepA11y": "الخطوة {n}",
  "create.stepMinutesA11y": "دقائق الخطوة {n}",
  "create.addStep": "إضافة خطوة",
  "create.stepType.active": "فعّالة",
  "create.stepType.passive": "بدون متابعة",
  "create.stepType.cleanup": "تنظيف",

  // ---- الإجراءات -------------------------------------------------------------------------------
  "create.save": "حفظ الوصفة",
  "create.saveChanges": "حفظ التغييرات",
  "create.saving": "جارٍ الحفظ…",
  "create.publish": "نشر",
  "create.deleteRecipe": "حذف الوصفة",
  "create.deleteConfirmTitle": "حذف الوصفة",
  "create.deleteConfirmMessage":
    "سيُحذف وصفتك وخطواتها نهائيًا. لا يمكن التراجع عن هذا الإجراء.",
  "create.deleteConfirmBtn": "حذف",

  // ---- بوابة الحلال (رفض الخادم يُعرض كما هو) ----------------------------------------------------
  "create.halalTitle": "بعض المكونات تخالف سياسة الحلال ولا يمكن نشرها:",
  "create.halalBlocked": "يرجى إزالة هذه المصطلحات: {terms}",

  // ---- أخطاء التحقق (تعكس قواعد الخادم) ----------------------------------------------------------
  "create.errTitleRequired": "يرجى إضافة عنوان.",
  "create.errMinutesRequired": "يرجى إضافة الوقت الكلي بالدقائق.",
  "create.errMinutesRange": "يجب أن يكون الوقت الكلي بين ١ و١٤٤٠ دقيقة.",
  "create.errServings": "يجب أن تكون الحصص بين ١ و٥٠.",
  "create.errDescriptionLong": "الوصف طويل جدًا (٢٠٠٠ حرفًا كحد أقصى).",
  "create.errSourceUrlLong": "رابط المصدر طويل جدًا (٢٥٥ حرفًا كحد أقصى).",
  "create.errIngredients": "أضف مكونًا واحدًا على الأقل.",
  "create.errIngredientsMax": "مكونات كثيرة جدًا (٦٠ كحد أقصى).",
  "create.errIngredientLong": "أحد أسطر المكونات طويل جدًا (٣٠٠ حرفًا كحد أقصى).",
  "create.errSteps": "أضف خطوة واحدة على الأقل.",
  "create.errStepsMax": "خطوات كثيرة جدًا (٤٠ كحد أقصى).",
  "create.errStepLong": "إحدى الخطوات طويلة جدًا (٢٠٠٠ حرفًا كحد أقصى).",
  "create.errStepMinutes": "دقائق الخطوة يجب أن تكون بين ٠ و١٤٤٠.",
  "create.errImageType": "يجب أن تكون الصورة بصيغة JPG أو PNG أو WebP.",
  "create.errImageTooBig": "الصورة كبيرة جدًا (٤ ميغابايت كحد أقصى).",
  "create.errImageUpload": "تعذّر رفع الصورة. حاول مرة أخرى.",
  "create.errGeneric": "تعذّر حفظ الوصفة. حاول مرة أخرى.",
  "create.errDelete": "تعذّر حذف الوصفة. حاول مرة أخرى.",
  "create.errNotOwner": "يمكنك تعديل وصفاتك فقط.",

  // ---- التنبيه على التغييرات غير المحفوظة ------------------------------------------------------------
  "create.discardTitle": "هل تريد تجاهل التغييرات؟",
  "create.discardMessage": "لن تُحفظ وصفتك.",
  "create.discardBtn": "تجاهل",
  "create.keepEditing": "متابعة التحرير",

  // ---- قسم التفاصيل الإضافية ----------------------------------------------------------------------
  "create.description": "الوصف",
  "create.descriptionPlaceholder": "أي شيء يستحق المعرفة قبل الطبخ؟",
};
