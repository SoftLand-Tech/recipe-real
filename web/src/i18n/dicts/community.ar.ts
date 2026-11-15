/**
 * موجز المجتمع (النطاق `community.*`) — ملك شريحة COMMUNITY.
 * المصطلحات منقولة عن mobile/src/i18n/ar.ts (قسم community)؛ والمفاتيح
 * الخاصة بالويب (العارض، الوقت النسبي، نسخ الرابط) بنفس النبرة.
 */
export const ar: Record<string, string> = {
  // ---- الصفحة والموجز ---------------------------------------------------------
  "community.pageTitle": "المجتمع",
  "community.sortLabel": "ترتيب الموجز",
  "community.sortSuggested": "لك",
  "community.sortLatest": "الأحدث",
  "community.sortTrending": "الأفضل هذا الأسبوع",
  "community.compose": "منشور جديد",
  "community.signInPrompt": "سجّل الدخول للإعجاب والتعليق والنشر.",
  "community.loadFailed": "تعذّر تحميل المنشورات.",
  "community.detailLoadFailed": "تعذّر تحميل هذا المنشور.",
  "community.emptyTitle": "لا منشورات بعد",
  "community.emptyBody": "شارك نجاحًا أو فشلًا أو سؤالًا — كلها تفيد الطبّاخين.",
  "community.emptyBeFirst": "كن أول من ينشر",
  "community.loadMore": "تحميل المزيد",

  // ---- إجراءات البطاقة ----------------------------------------------------------
  "community.likeAction": "إعجاب",
  "community.commentAction": "تعليق",
  "community.shareAction": "مشاركة",
  "community.shareA11y": "مشاركة المنشور",
  "community.linkCopied": "تم نسخ الرابط",
  "community.linkCopyFailed": "تعذّر نسخ الرابط.",
  "community.likeFailed": "تعذّر إرسال إعجابك. حاول مجددًا.",
  "community.commentCountOne": "تعليق واحد",
  "community.commentCount": "{n} تعليقات",
  "community.seeMore": "عرض المزيد",
  "community.seeLess": "عرض أقل",
  "community.edited": "تم تعديله",
  "community.viewProfile": "عرض ملف {name}",
  "community.postActions": "إجراءات المنشور",

  // ---- الصور --------------------------------------------------------------------
  "community.addImages": "إضافة صور",
  "community.addMoreImages": "إضافة المزيد",
  "community.removeImage": "إزالة الصورة {n}",
  "community.openPhoto": "فتح الصورة {n}",
  "community.photoAlt": "صورة بواسطة {name}",
  "community.lightboxLabel": "عارض الصور",
  "community.lightboxClose": "إغلاق",
  "community.lightboxPrev": "الصورة السابقة",
  "community.lightboxNext": "الصورة التالية",

  // ---- الإشراف (توافق مع الجوال — سياسة المتجر) --------------------------------------
  "community.editPost": "تعديل المنشور",
  "community.deletePost": "حذف المنشور",
  "community.deletePostConfirm":
    "سيحذف هذا منشورك نهائيًا مع إعجاباته وتعليقاته، ولا يمكن التراجع عنه.",
  "community.saveEdit": "حفظ",
  "community.editFailed": "تعذّر حفظ التعديل. حاول مجددًا.",
  "community.deleteFailed": "تعذّر الحذف. حاول مجددًا.",
  "community.deleteCommentConfirm":
    "سيحذف هذا تعليقك نهائيًا، ولا يمكن التراجع عنه.",
  "community.reportAction": "إبلاغ",
  "community.reportPost": "الإبلاغ عن المنشور",
  "community.reportComment": "الإبلاغ عن التعليق",
  "community.reportConfirm": "هل تريد الإبلاغ عن هذا المحتوى ليراجعه المشرفون؟",
  "community.reported": "تم الإبلاغ",
  "community.reportFailed": "تعذّر إرسال الإبلاغ. حاول مجددًا.",
  "community.blockUser": "حجب المستخدم",
  "community.blockConfirm": "هل تريد حجب {name}؟ ستُخفى منشوراته وتعليقاته عنك.",
  "community.blockBtn": "حجب",
  "community.blocked": "تم الحجب",
  "community.blockFailed": "تعذّر حجب هذا المستخدم. حاول مجددًا.",

  // ---- التحرير والتعليقات --------------------------------------------------------------
  "community.composePlaceholder": "كيف كانت النتيجة؟ النجاح والفشل كلاهما يفيد الطبّاخين.",
  "community.attachRecipe": "إرفاق وصفة",
  "community.postAction": "نشر",
  "community.posting": "جارٍ النشر…",
  "community.postFailed": "تعذّر نشر منشورك. حاول مجددًا.",
  "community.publishingPost": "جارٍ نشر منشورك…",
  "community.errBodyRequired": "اكتب شيئًا أولًا.",
  "community.errBodyLong": "المنشورات محدودة بـ 2000 حرف.",
  "community.uploadingImages": "جارٍ رفع {n} صورة(صور)…",
  "community.errImageUpload": "فشل رفع صورة أو أكثر. حاول مجددًا.",
  "community.halalBlocked": "يرجى إزالة هذه المصطلحات: {terms}",
  "community.commentPlaceholder": "أضف تعليقًا…",
  "community.commentSend": "إرسال",
  "community.commentFailed": "تعذّر نشر تعليقك. حاول مجددًا.",
  "community.commentsEmpty": "لا تعليقات بعد — ابدأ الحوار!",
  "community.commentsLoadFailed": "تعذّر تحميل التعليقات.",

  // ---- الوقت النسبي --------------------------------------------------------------------
  "community.relNow": "الآن",
  "community.relMinutesAgo": "قبل {n} د",
  "community.relHoursAgo": "قبل {n} س",
  "community.relDaysAgo": "قبل {n} يوم",
  "community.relWeeksAgo": "قبل {n} أسبوع",
  "community.relMonthsAgo": "قبل {n} شهر",
};
