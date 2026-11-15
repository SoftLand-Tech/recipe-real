/**
 * Full-screen cook mode — Arabic (namespace `cook.*`), OWNED BY SLICE RECIPE.
 * Terminology mirrors mobile/src/i18n/ar.ts (cook.* keys).
 */
export const ar: Record<string, string> = {
  "cook.pageTitle": "وضع الطهي",
  "cook.stepOf": "الخطوة {current} / {total}",
  "cook.stepTypeActive": "نشطة",
  "cook.stepTypePassive": "بدون متابعة",
  "cook.stepTypeCleanup": "تنظيف",

  // ---- Controls ----
  "cook.startCooking": "ابدأ الطهي",
  "cook.pauseCooking": "إيقاف مؤقت",
  "cook.resumeCooking": "استئناف",
  "cook.finishCooking": "إنهاء",
  "cook.previous": "الخطوة السابقة",
  "cook.next": "الخطوة التالية",
  "cook.nextStep": "التالية",
  "cook.closeA11y": "إغلاق وضع الطهي",
  "cook.largeText": "خط كبير",
  "cook.largeTextOn": "الخط الكبير مفعّل",

  // ---- Status hints ----
  "cook.hintIdle": "اضغط ابدأ عندما تبدأ الطهي",
  "cook.hintRunning": "جارٍ قياس طهيك كاملًا…",
  "cook.hintPaused": "متوقف مؤقتًا",
  "cook.hintHandsOff": "بدون متابعة — يمكنك الابتعاد",
  "cook.tapCardNext": "اضغط على البطاقة للخطوة التالية",

  // ---- Per-step pace bar (teal = measured) ----
  "cook.stepExpected": "هذه الخطوة: ~{n}د",
  "cook.stepExpectedForYou": "هذه الخطوة: ~{n}د على وتيرتك",
  "cook.stepOver": "تجاوزت التقدير بـ{n}د",
  "cook.stepPaceA11y": "الوقت في هذه الخطوة",

  // ---- Step alarm (Web Audio beep + Notification) ----
  "cook.alarmChip": "⏲ {minutes} دقيقة",
  "cook.alarmSet": "اضبط منبه {minutes} دقيقة",
  "cook.alarmArmed": "المنبه مفعّل",
  "cook.alarmCancel": "إلغاء",
  "cook.alarmDoneTitle": "RecipeReal",
  "cook.alarmDoneBody": "الخطوة {n}: انتهت {minutes} دقيقة",

  // ---- Confirmations ----
  "cook.finishTitle": "إنهاء الطهي؟",
  "cook.finishMessage": "سيُحفظ وقت المؤقت كوقتك الحقيقي لهذه الوصفة.",
  "cook.finishRemainingOne":
    "لا تزال هناك خطوة واحدة متبقية. هل تريد الإنهاء مبكرًا وتسجيل وقت الطهي؟",
  "cook.finishRemainingMany":
    "لا تزال هناك {n} خطوات متبقية. هل تريد الإنهاء مبكرًا وتسجيل وقت الطهي؟",
  "cook.finishLogTime": "إنهاء وتسجيل الوقت",
  "cook.keepCooking": "متابعة الطهي",
  "cook.discardTitle": "مغادرة وضع الطهي؟",
  "cook.discardMessage": "سيُفقد المؤقت وأوقات الخطوات المسجّلة لهذا الطهي.",
  "cook.discardExitBtn": "تجاهل والخروج",

  // ---- Feedback phase ----
  "cook.youCooked": "طبختها!",
  "cook.yourTime": "وقتك",
  "cook.publisherEst": "تقدير الوصفة",
  "cook.cleanupEstimate": "تقدير التنظيف: ~{n} دقيقة",
  "cook.cleanupLabel": "التنظيف: {time}",
  "cook.feedbackPrompt": "كيف كانت مقارنةً بالتقدير؟",
  "cook.faster": "أسرع",
  "cook.fasterSub": "أنهيت أسرع من الوقت المتوقع",
  "cook.asExpected": "كما توقعت",
  "cook.asExpectedSub": "قريب من الوقت المتوقع",
  "cook.slower": "أبطأ",
  "cook.slowerSub": "استغرق وقتًا أطول من المذكور",
  "cook.skip": "تخطي",
  "cook.done": "تم",

  // ---- Submission ----
  "cook.saving": "جارٍ الحفظ…",
  "cook.saved": "تم الحفظ.",
  "cook.saveFailed": "تعذّر الحفظ. حاول مجددًا لاحقًا.",
  "cook.pacePending": "تتحدّث معايرة وتيرتك في الخلفية.",
  "cook.savedSignedOut":
    "لم يُحفظ هذا الطهي. سجّل الدخول قبل الإنهاء لتسجيل وقتك ومعايرة وتيرتك.",
  "cook.signInToSave": "سجّل الدخول للحفظ",

  // ---- Manual time adjustment ----
  "cook.adjustTime": "ضبط الوقت",
  "cook.adjustHint": "نسيت الإيقاف المؤقت؟ حدّد الوقت الذي استغرقته فعلًا.",
  "cook.adjustUse": "اعتماد هذا الوقت",
  "cook.adjustMinus": "دقيقة أقل",
  "cook.adjustPlus": "دقيقة أكثر",
  "cook.adjustedNote": "المقاس {measured} · المعدّل {adjusted}",

  // ---- States ----
  "cook.noSteps": "لا تحتوي هذه الوصفة على خطوات للطهي بعد.",
  "cook.loadFailed": "تعذّر تحميل هذه الوصفة.",
  "cook.tabHiddenNotice": "عدت! واصل المؤقت القياس أثناء غيابك.",
  "cook.alarmFiredTitle": "انتهى الوقت!",
  "cook.alarmFiredBody": "الخطوة {n}: انتهت {minutes} دقيقة",
};
