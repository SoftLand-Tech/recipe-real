/**
 * Community feed (namespace `community.*`) — OWNED BY SLICE COMMUNITY.
 * Vocabulary mirrors mobile/src/i18n/en.ts (community section); web-only
 * keys (lightbox, relative time, share-to-clipboard) follow the same voice.
 */
export const en: Record<string, string> = {
  // ---- Page + feed ----------------------------------------------------------
  "community.pageTitle": "Community",
  "community.sortLabel": "Feed ordering",
  "community.sortSuggested": "For you",
  "community.sortLatest": "Latest",
  "community.sortTrending": "Top this week",
  "community.compose": "New post",
  "community.signInPrompt": "Sign in to like, comment, and post.",
  "community.loadFailed": "Couldn't load the posts.",
  "community.detailLoadFailed": "Couldn't load this post.",
  "community.emptyTitle": "No posts yet",
  "community.emptyBody":
    "Share a win, a fail, or a question — it helps other cooks.",
  "community.emptyBeFirst": "Be the first to post",
  "community.loadMore": "Load more",

  // ---- Card actions -----------------------------------------------------------
  "community.likeAction": "Like",
  "community.commentAction": "Comment",
  "community.shareAction": "Share",
  "community.shareA11y": "Share post",
  "community.linkCopied": "Link copied to clipboard",
  "community.linkCopyFailed": "Couldn't copy the link.",
  "community.likeFailed": "Couldn't send your like. Please try again.",
  "community.commentCountOne": "1 comment",
  "community.commentCount": "{n} comments",
  "community.seeMore": "See more",
  "community.seeLess": "See less",
  "community.edited": "edited",
  "community.viewProfile": "View {name}'s profile",
  "community.postActions": "Post actions",

  // ---- Photos -------------------------------------------------------------------
  "community.addImages": "Add photos",
  "community.addMoreImages": "Add more",
  "community.removeImage": "Remove photo {n}",
  "community.openPhoto": "Open photo {n}",
  "community.photoAlt": "Photo by {name}",
  "community.lightboxLabel": "Photo viewer",
  "community.lightboxClose": "Close",
  "community.lightboxPrev": "Previous photo",
  "community.lightboxNext": "Next photo",

  // ---- Moderation (mobile parity — store policy) -----------------------------------
  "community.editPost": "Edit post",
  "community.deletePost": "Delete post",
  "community.deletePostConfirm":
    "This permanently deletes your post with its likes and comments. This cannot be undone.",
  "community.saveEdit": "Save",
  "community.editFailed": "Couldn't save your edit. Please try again.",
  "community.deleteFailed": "Couldn't delete. Please try again.",
  "community.deleteCommentConfirm":
    "This permanently deletes your comment. This cannot be undone.",
  "community.reportAction": "Report",
  "community.reportPost": "Report post",
  "community.reportComment": "Report comment",
  "community.reportConfirm": "Report this content to our moderators for review?",
  "community.reported": "Reported",
  "community.reportFailed": "Couldn't send your report. Please try again.",
  "community.blockUser": "Block user",
  "community.blockConfirm":
    "Block {name}? Their posts and comments will be hidden from you.",
  "community.blockBtn": "Block",
  "community.blocked": "Blocked",
  "community.blockFailed": "Couldn't block this user. Please try again.",

  // ---- Composer + comments ----------------------------------------------------------
  "community.composePlaceholder": "How did it go? Wins and fails both help other cooks.",
  "community.attachRecipe": "Attach a recipe",
  "community.postAction": "Post",
  "community.posting": "Posting…",
  "community.postFailed": "Couldn't publish your post. Please try again.",
  "community.publishingPost": "Publishing your post…",
  "community.errBodyRequired": "Write something first.",
  "community.errBodyLong": "Posts are limited to 2000 characters.",
  "community.uploadingImages": "Uploading {n} photo(s)…",
  "community.errImageUpload": "One or more photos failed to upload. Please try again.",
  "community.halalBlocked": "Please remove these terms: {terms}",
  "community.commentPlaceholder": "Add a comment…",
  "community.commentSend": "Send",
  "community.commentFailed": "Couldn't post your comment. Please try again.",
  "community.commentsEmpty": "No comments yet — start the conversation!",
  "community.commentsLoadFailed": "Couldn't load the comments.",

  // ---- Relative time -----------------------------------------------------------------
  "community.relNow": "just now",
  "community.relMinutesAgo": "{n}m ago",
  "community.relHoursAgo": "{n}h ago",
  "community.relDaysAgo": "{n}d ago",
  "community.relWeeksAgo": "{n}w ago",
  "community.relMonthsAgo": "{n}mo ago",
};
