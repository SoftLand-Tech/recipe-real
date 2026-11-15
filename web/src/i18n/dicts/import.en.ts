/**
 * AI recipe import + drafts review (namespace import.*) — OWNED BY SLICE
 * CREATE. Mirrors mobile's import.* copy tone; the flow is private-by-default
 * and publishing is always an explicit action.
 */
export const en: Record<string, string> = {
  "import.pageTitle": "Import recipe",
  "import.subtitle":
    "Use a public social link or upload a recipe video/image. AI extracts a private draft you review before anything goes public.",

  // ---- New import form -----------------------------------------------------------
  "import.sourceTitle": "Recipe source",
  "import.sourceUrl": "Recipe link",
  "import.sourceUrlPlaceholder": "TikTok, Instagram, Facebook, X, or another URL",
  "import.sourceUrlHint": "Public links work best. You can also add a video or image below.",
  "import.primary": "Primary source",
  "import.primaryHint": "Video up to 100MB, or image up to 8MB",
  "import.choosePrimary": "Choose a video or image",
  "import.attachments": "Extra photos",
  "import.addAttachments": "Add photos",
  "import.remove": "Remove",
  "import.sourceRequired": "Add a public link or choose a video/image.",
  "import.urlInvalid": "Enter a valid http(s) link.",
  "import.unsupportedType": "That file type isn't supported.",
  "import.fileTooBig": "That file is too large (max {mb}MB).",
  "import.start": "Import with AI",
  "import.processing": "Extracting recipe…",
  "import.rateLimited": "Too many tries — wait about a minute, then try again.",
  "import.failed": "The recipe couldn't be extracted. Try again.",
  "import.createdToast": "Import started — we'll extract the recipe in a moment.",
  "import.publishedToast": "Published! Opening your recipe…",

  // ---- Queue -----------------------------------------------------------------------
  "import.queueTitle": "Your imports",
  "import.queueSubtitle": "Videos and links still extracting, ready to review, or failed.",
  "import.emptyTitle": "No imports yet",
  "import.emptyBody": "Paste a recipe link above or upload a video to get started.",
  "import.statusQueued": "Queued",
  "import.extracting": "Extracting… {n}%",
  "import.statusReady": "Ready to review",
  "import.statusFailed": "Failed",
  "import.statusPublished": "Published",
  "import.kindVideo": "Recipe video",
  "import.kindImage": "Recipe image",
  "import.kindLink": "Recipe link",
  "import.review": "Review",
  "import.retry": "Retry",
  "import.dismiss": "Delete",
  "import.viewRecipe": "View recipe",
  "import.retryFailed": "Couldn't retry this import. Please try again.",
  "import.retryLimit": "Too many retries — create a new import instead.",
  "import.deletedToast": "Import deleted.",
  "import.deleteFailed": "Couldn't delete this import. Please try again.",
  "import.deleteConfirmTitle": "Delete this import?",
  "import.deleteConfirmMessage":
    "The extracted draft and its source files will be removed. This can't be undone.",
  "import.loadFailed": "Couldn't load your imports. Please try again.",
  "import.notFound": "This import doesn't exist anymore.",
  "import.pollRateLimited": "Checking too often — slowing down updates.",

  // ---- Draft review ------------------------------------------------------------------
  "import.reviewTitle": "Review draft",
  "import.reviewSubtitle":
    "Check what AI extracted, fix anything off, then publish when it reads right.",
  "import.publishNotice":
    "Nothing is public yet — publishing adds this recipe to your public profile.",
  "import.notReady": "Still extracting — check back shortly.",
  "import.alreadyPublished": "This import was already published.",
  "import.importFailed": "Extraction failed.",
  "import.backToQueue": "Back to imports",
  "import.reviewWarnings": "Review these extraction warnings",
};
