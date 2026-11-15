/**
 * الاستيراد بالذكاء الاصطناعي ومراجعة المسودات (النطاق import.*) —
 * ملك شريحة CREATE. النسخ منقولة عن mobile/src/i18n/ar.ts (قسم import.*)،
 * والتدفق خاص افتراضيًا والنشر إجراء صريح دائمًا.
 */
export const ar: Record<string, string> = {
  "import.pageTitle": "استيراد وصفة",
  "import.subtitle":
    "استخدم رابطًا عامًا أو ارفع فيديو/صورة للوصفة. يستخرج الذكاء الاصطناعي مسودة خاصة تراجعها قبل أن يصبح أي شيء عامًا.",

  // ---- نموذج استيراد جديد ------------------------------------------------------------
  "import.sourceTitle": "مصدر الوصفة",
  "import.sourceUrl": "رابط الوصفة",
  "import.sourceUrlPlaceholder": "TikTok أو Instagram أو Facebook أو X أو أي رابط آخر",
  "import.sourceUrlHint": "تعمل الروابط العامة بشكل أفضل. يمكنك أيضًا إضافة فيديو أو صورة أدناه.",
  "import.primary": "المصدر الأساسي",
  "import.primaryHint": "فيديو حتى ١٠٠ ميغابايت، أو صورة حتى ٨ ميغابايت",
  "import.choosePrimary": "اختر فيديو أو صورة",
  "import.attachments": "صور إضافية",
  "import.addAttachments": "إضافة صور",
  "import.remove": "إزالة",
  "import.sourceRequired": "أضف رابطًا عامًا أو اختر فيديو أو صورة.",
  "import.urlInvalid": "أدخل رابط http(s) صالحًا.",
  "import.unsupportedType": "نوع الملف غير مدعوم.",
  "import.fileTooBig": "الملف كبير جدًا ({mb} ميغابايت كحد أقصى).",
  "import.start": "استيراد بالذكاء الاصطناعي",
  "import.processing": "جارٍ استخراج الوصفة…",
  "import.rateLimited": "محاولات كثيرة — انتظر دقيقة تقريبًا ثم حاول مجددًا.",
  "import.failed": "تعذّر استخراج الوصفة. حاول مرة أخرى.",
  "import.createdToast": "بدأ الاستيراد — سنستخرج الوصفة بعد قليل.",
  "import.publishedToast": "تم النشر! جارٍ فتح وصفتك…",

  // ---- قائمة الاستيرادات --------------------------------------------------------------
  "import.queueTitle": "استيراداتك",
  "import.queueSubtitle": "فيديوهات وروابط قيد الاستخراج أو جاهزة للمراجعة أو فشلت.",
  "import.emptyTitle": "لا استيرادات بعد",
  "import.emptyBody": "الصق رابط وصفة أعلاه أو ارفع فيديو للبدء.",
  "import.statusQueued": "في الانتظار",
  "import.extracting": "جارٍ الاستخراج… {n}٪",
  "import.statusReady": "جاهز للمراجعة",
  "import.statusFailed": "فشل",
  "import.statusPublished": "منشور",
  "import.kindVideo": "فيديو الوصفة",
  "import.kindImage": "صورة الوصفة",
  "import.kindLink": "رابط الوصفة",
  "import.review": "مراجعة",
  "import.retry": "إعادة المحاولة",
  "import.dismiss": "حذف",
  "import.viewRecipe": "عرض الوصفة",
  "import.retryFailed": "تعذّرت إعادة محاولة هذا الاستيراد. حاول مرة أخرى.",
  "import.retryLimit": "محاولات كثيرة — أنشئ استيرادًا جديدًا بدلًا من ذلك.",
  "import.deletedToast": "تم حذف الاستيراد.",
  "import.deleteFailed": "تعذّر حذف هذا الاستيراد. حاول مرة أخرى.",
  "import.deleteConfirmTitle": "حذف هذا الاستيراد؟",
  "import.deleteConfirmMessage":
    "ستُحذف المسودة المستخرجة وملفات مصدرها نهائيًا. لا يمكن التراجع.",
  "import.loadFailed": "تعذّر تحميل استيراداتك. حاول مرة أخرى.",
  "import.notFound": "هذا الاستيراد لم يعد موجودًا.",
  "import.pollRateLimited": "التحقق متكرر أكثر من اللازم — سنبطئ التحديثات.",

  // ---- مراجعة المسودة --------------------------------------------------------------------
  "import.reviewTitle": "مراجعة المسودة",
  "import.reviewSubtitle":
    "راجع ما استخرجه الذكاء الاصطناعي، صحّح ما يلزم، ثم انشر عندما يصبح مناسبًا.",
  "import.publishNotice":
    "لا شيء عام بعد — النشر يضيف هذه الوصفة إلى ملفك الشخصي العام.",
  "import.notReady": "ما زال الاستخراج جاريًا — عد بعد قليل.",
  "import.alreadyPublished": "تم نشر هذا الاستيراد بالفعل.",
  "import.importFailed": "فشل الاستخراج.",
  "import.backToQueue": "العودة إلى الاستيرادات",
  "import.reviewWarnings": "راجع ملاحظات الاستخراج",
};
