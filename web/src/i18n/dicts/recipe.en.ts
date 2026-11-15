/**
 * Recipe detail screen (namespace `recipe.*`) — OWNED BY SLICE RECIPE.
 * Vocabulary mirrors mobile's `detail.` / `quick.` / `notes.` keys
 * (mobile/src/i18n/en.ts).
 */
export const en: Record<string, string> = {
  "recipe.pageTitle": "Recipe",
  "recipe.loadingRecipe": "Loading recipe…",
  "recipe.loadFailed": "Couldn't load this recipe.",
  "recipe.backA11y": "Back",
  "recipe.shareA11y": "Share",
  "recipe.favoriteAddA11y": "Add to favorites",
  "recipe.favoriteRemoveA11y": "Remove from favorites",
  "recipe.shareCopied": "Link copied",

  // ---- Hero meta ----
  "recipe.ratingWithCount": "★ {rating} · {n} reviews",
  "recipe.ratingOnly": "★ {rating}",

  // ---- Claimed vs. really takes (the signature pair; teal = measured) ----
  "recipe.beTheFirst": "Be the first!",
  "recipe.realitySlower": "⏱ Takes ~{pct}% longer than claimed",
  "recipe.realityFaster": "⚡ ~{pct}% faster than claimed",
  "recipe.realityAccurate": "Claimed time checks out",
  "recipe.cleanupAfter": "+ ~{time} cleanup after",
  "recipe.dishes": "{n} dishes",
  "recipe.dishwasherSafe": "Dishwasher-safe",
  "recipe.handWash": "Hand-wash",
  "recipe.greaseLow": "Low grease",
  "recipe.greaseMedium": "Medium grease",
  "recipe.greaseHigh": "High grease",

  // ---- Ingredients (servings scaler + checklist) ----
  "recipe.ingredients": "Ingredients",
  "recipe.noIngredients": "No ingredients listed.",
  "recipe.servingsScaled": "{n} servings",
  "recipe.scaleA11y": "Scale ingredients {n}×",
  "recipe.clearChecked": "Clear checked",
  "recipe.checkedA11y": "{text}, checked",

  // ---- Steps ----
  "recipe.stepsTitle": "Steps",
  "recipe.handsOff": "Hands-off",
  "recipe.adjustedForYou": "~{time} for you",
  "recipe.stepOf": "Step {n}",

  // ---- Cook-mode CTA + owner controls ----
  "recipe.startCookMode": "Start Cook Mode",
  "recipe.editRecipe": "Edit recipe",

  // ---- Quick-time contribution ("it actually took N min") ----
  "recipe.quickDidYouMake": "Did you make this recipe?",
  "recipe.quickOptional": "optional",
  "recipe.quickPlates": "Plates made",
  "recipe.quickHandsOn": "Hands-on time (min)",
  "recipe.quickTotal": "Total time (min)",
  "recipe.quickCleanup": "Washing & cleanup (min)",
  "recipe.quickSubmit": "Submit",
  "recipe.quickThanksBreakdown": "Thanks! Cooks average ~{time} now",
  "recipe.quickThanksOwn": "Thanks for contributing your time!",
  "recipe.quickThanksOwnTime": "Thanks! Your time was recorded.",
  "recipe.quickThanksCleanup": "Cleanup average ~{cleanup}",
  "recipe.quickHandsOnTooLong": "Hands-on time can't exceed the total time.",
  "recipe.quickError": "Couldn't submit. Please try again.",
  "recipe.quickSignInRequired": "Sign in to contribute your time.",

  // ---- Community notes ----
  "recipe.notesTitle": "Community notes",
  "recipe.notesEmpty": "No community notes yet. Be the first to share a tip!",
  "recipe.notesLoadFailed": "Couldn't load the notes.",
  "recipe.loadMoreNotes": "Load more",
  "recipe.noteComposePlaceholder": "Share a tip with other cooks…",
  "recipe.noteSend": "Post",
  "recipe.notesSignIn": "Sign in to join the conversation.",
  "recipe.notePostFailed": "Couldn't post your note. Please try again.",
  "recipe.noteHalalBlocked": "Please remove these terms: {terms}",
  "recipe.noteDeleteConfirmTitle": "Delete this note?",
  "recipe.noteDeleteConfirmBody":
    "It will be removed for everyone. This cannot be undone.",
  "recipe.noteDeleted": "Note deleted",
  "recipe.noteReportConfirmTitle": "Report this note?",
  "recipe.noteReportConfirmBody":
    "Our team reviews reports and removes content that breaks the rules.",
  "recipe.noteReported": "Reported — thank you",
  "recipe.reportAction": "Report",
};
