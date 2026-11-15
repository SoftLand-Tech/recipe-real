/**
 * Profile screens: edit profile + public profile (namespace `profile.*`) —
 * OWNED BY SLICE ACCOUNT. Arabic mirrors mobile/src/i18n/ar.ts.
 */
export const ar: Record<string, string> = {
  "profile.pageTitle": "تعديل الملف الشخصي",
  "profile.publicTitle": "الملف الشخصي",
  "profile.title": "ملفك الشخصي",
  "profile.backToAccount": "العودة إلى الحساب",

  // ---- Edit form -----------------------------------------------------------
  "profile.displayName": "الاسم المعروض",
  "profile.displayNamePlaceholder": "الاسم المعروض",
  "profile.nameHint": "من حرفين إلى 40 حرفًا",
  "profile.bio": "النبذة",
  "profile.bioPlaceholder": "عرّف الطهاة بنفسك…",
  "profile.bioCount": "{n}/500",
  "profile.changePhoto": "تغيير الصورة",
  "profile.removePhoto": "إزالة الصورة",
  "profile.photoHint": "JPG أو PNG أو WebP — تُقتطع مربعة من المنتصف.",
  "profile.saved": "تم الحفظ ✓",
  "profile.errNameLength": "يجب أن يكون الاسم المعروض بين حرفين و40 حرفًا.",
  "profile.errBioLong": "النبذة يجب ألا تتجاوز 500 حرف.",
  "profile.errSave": "تعذّر حفظ الملف الشخصي. حاول مجددًا.",
  "profile.errBioRejected": "لا يمكن أن تتضمن النبذة مكونات غير حلال أو كحول — أعد صياغتها من فضلك.",
  "profile.errUploadAvatar": "تعذّر رفع الصورة. حاول مجددًا.",

  // ---- Public profile --------------------------------------------------------
  "profile.publicLoadFailed": "تعذّر تحميل هذا الملف الشخصي.",
  "profile.follow": "متابعة",
  "profile.unfollow": "إلغاء المتابعة",
  "profile.followingBtn": "متابَع",
  "profile.followFailed": "تعذّر تحديث المتابعة. حاول مجددًا.",
  "profile.cookingSince": "يطبخ منذ {date}",
  "profile.noUserRecipes": "لا توجد وصفات منشورة بعد.",
  "profile.recipesLoadMore": "تحميل المزيد",
  "profile.thisIsYou": "هذا ملفك الشخصي",
  "profile.editProfile": "تعديل الملف الشخصي",
  "profile.userActions": "إجراءات الملف الشخصي",
  "profile.reportUser": "الإبلاغ عن المستخدم",
  "profile.reportConfirm": "هل تريد الإبلاغ عن {name} ليراجعه المشرفون؟",
  "profile.reported": "تم الإبلاغ. شكرًا للحفاظ على ودّ RecipeReal.",
  "profile.reportNoPosts": "لا توجد منشورات لهذا المستخدم للإبلاغ عنها بعد.",
  "profile.reportFailed": "تعذّر إرسال الإبلاغ. حاول مجددًا.",
  "profile.blockUser": "حجب المستخدم",
  "profile.blockConfirm": "هل تريد حجب {name}؟ ستُخفى منشوراته وتعليقاته عنك.",
  "profile.blockBtn": "حجب",
  "profile.blockedMessage": "تم حجب {name}. ستُخفى منشوراته وتعليقاته الآن.",
  "profile.blockFailed": "تعذّر حجب هذا المستخدم. حاول مجددًا.",
};
