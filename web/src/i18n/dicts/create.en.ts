/**
 * Create namespace (create.*) — OWNED BY SLICE CREATE.
 * Covers the create hub, the recipe composer (new/edit) and its validation
 * copy. Terminology mirrors mobile's composer.* strings.
 */
export const en: Record<string, string> = {
  "create.pageTitle": "Create",
  "create.recipeComposerTitle": "New recipe",

  // ---- Hub --------------------------------------------------------------------
  "create.hubSubtitle": "Share a recipe you know by heart — or let AI pull one in for you.",
  "create.writeTitle": "Write a recipe",
  "create.writeBody": "Type it out step by step, in English, Arabic, or both.",
  "create.importTitle": "Import from a link, photo or video",
  "create.importBody": "Paste a public recipe link or upload a video — AI extracts the draft for you to review.",
  "create.summaryTitle": "Your kitchen",
  "create.recipesChip": "{n} recipes",
  "create.activeImportsChip": "{n} extracting",
  "create.readyImportsChip": "{n} ready to review",

  // ---- Composer page states -----------------------------------------------------
  "create.newTitle": "New recipe",
  "create.editTitle": "Edit recipe",
  "create.loadingRecipe": "Loading recipe…",
  "create.loadFailed": "Couldn't load this recipe. Please try again.",
  "create.loadNotEditable":
    "This recipe isn't available to edit — it may not exist or belong to another account.",

  // ---- Photo ---------------------------------------------------------------------
  "create.photo": "Photo",
  "create.addPhotoHint": "Add a cover photo",
  "create.imageHint": "JPG, PNG or WebP · up to 4MB",
  "create.changePhoto": "Change photo",
  "create.removeImage": "Remove photo",

  // ---- Basics --------------------------------------------------------------------
  "create.basics": "Basics",
  "create.basicsHint": "Name your recipe and tell cooks what it is.",
  "create.titleLabel": "Recipe title",
  "create.titleEn": "Title (English)",
  "create.titleAr": "Title (Arabic)",
  "create.titlePlaceholder": "e.g. One-pan lemon chicken",
  "create.titleArPlaceholder": "مثال: دجاج الليمون بالمقلاة",
  "create.addTranslation": "Add translation",
  "create.hideTranslation": "Hide translation",

  // ---- Timing --------------------------------------------------------------------
  "create.timing": "Servings & time",
  "create.servings": "Servings",
  "create.minutes": "Total time (min)",
  "create.prepMinutes": "Prep (min)",
  "create.cookMinutes": "Cook (min)",
  "create.unitMin": "min",
  "create.sourceUrl": "Source link",
  "create.sourceUrlPlaceholder": "Original recipe URL",
  "create.moreDetails": "More details",
  "create.optional": "optional",
  "create.category": "Category",
  "create.servingsMinusA11y": "Decrease servings",
  "create.servingsPlusA11y": "Increase servings",

  // ---- Ingredients ------------------------------------------------------------------
  "create.ingredients": "Ingredients",
  "create.ingredientsHint": "One per row, up to 60.",
  "create.ingredientPlaceholder": "e.g. 2 cups rice",
  "create.ingredientA11y": "Ingredient {n}",
  "create.addIngredient": "Add ingredient",
  "create.removeRow": "Remove",

  // ---- Steps --------------------------------------------------------------------------
  "create.steps": "Steps",
  "create.stepsHint": "What to do, in order. Arabic and minutes are optional.",
  "create.stepDescriptionPlaceholder": "What to do…",
  "create.stepArPlaceholder": "Arabic (optional)",
  "create.stepA11y": "Step {n}",
  "create.stepMinutesA11y": "Step {n} minutes",
  "create.addStep": "Add step",
  "create.stepType.active": "Active",
  "create.stepType.passive": "Hands-off",
  "create.stepType.cleanup": "Cleanup",

  // ---- Actions ---------------------------------------------------------------------------
  "create.save": "Save recipe",
  "create.saveChanges": "Save changes",
  "create.saving": "Saving…",
  "create.publish": "Publish",
  "create.deleteRecipe": "Delete recipe",
  "create.deleteConfirmTitle": "Delete recipe",
  "create.deleteConfirmMessage":
    "Your recipe and its steps will be permanently deleted. This can't be undone.",
  "create.deleteConfirmBtn": "Delete",

  // ---- Halal gate (server rejections surfaced verbatim) -------------------------------------
  "create.halalTitle": "Some ingredients violate the halal policy and can't be published:",
  "create.halalBlocked": "Please remove these terms: {terms}",

  // ---- Validation errors (mirrors the server rules) ------------------------------------------
  "create.errTitleRequired": "Please add a title.",
  "create.errMinutesRequired": "Please add the total time in minutes.",
  "create.errMinutesRange": "Total time must be between 1 and 1440 minutes.",
  "create.errServings": "Servings must be between 1 and 50.",
  "create.errDescriptionLong": "Description is too long (max 2000 characters).",
  "create.errSourceUrlLong": "The source link is too long (max 255 characters).",
  "create.errIngredients": "Add at least one ingredient.",
  "create.errIngredientsMax": "Too many ingredients (max 60).",
  "create.errIngredientLong": "An ingredient line is too long (max 300 characters).",
  "create.errSteps": "Add at least one step.",
  "create.errStepsMax": "Too many steps (max 40).",
  "create.errStepLong": "A step is too long (max 2000 characters).",
  "create.errStepMinutes": "Step minutes must be between 0 and 1440.",
  "create.errImageType": "Photos must be JPG, PNG or WebP.",
  "create.errImageTooBig": "Photo is too large (max {mb}MB).",
  "create.errImageUpload": "Couldn't upload the photo. Please try again.",
  "create.errGeneric": "Couldn't save the recipe. Please try again.",
  "create.errDelete": "Couldn't delete the recipe. Please try again.",
  "create.errNotOwner": "You can only edit your own recipes.",

  // ---- Unsaved-changes guard -------------------------------------------------------------------
  "create.discardTitle": "Discard changes?",
  "create.discardMessage": "Your recipe won't be saved.",
  "create.discardBtn": "Discard",
  "create.keepEditing": "Keep editing",

  // ---- More-details section ----------------------------------------------------------------------
  "create.description": "Description",
  "create.descriptionPlaceholder": "Anything worth knowing before cooking?",
};
