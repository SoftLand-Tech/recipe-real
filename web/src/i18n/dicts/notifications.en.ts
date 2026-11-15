/**
 * Notification inbox (namespace `notifications.*`) — OWNED BY SLICE ACCOUNT.
 * Arabic mirrors mobile/src/i18n/ar.ts notif.* + rel.* vocabulary (the
 * relative-time keys live under this namespace on the web: `rel.*` is not
 * an ACCOUNT-owned prefix).
 */
export const en: Record<string, string> = {
  "notifications.pageTitle": "Notifications",
  "notifications.markAllRead": "Mark all read",
  "notifications.likedYourPost": "{name} liked your post",
  "notifications.commented": "{name} commented: {snippet}",
  "notifications.commentedYourPost": "{name} commented on your post",
  "notifications.someone": "Someone",
  "notifications.moderationTitle": "Moderation notice",
  "notifications.moderationDefault": "A moderator took action on your content.",
  "notifications.empty": "No notifications yet",
  "notifications.emptyCaption": "Likes and comments on your posts will show up here.",
  "notifications.loadFailed": "Couldn't load the notifications.",
  "notifications.postGone": "That post is no longer available.",
  "notifications.loadMore": "Load more",
  "notifications.unreadA11y": "{n} unread",

  // Relative time (mobile's rel.* vocabulary, namespaced here).
  "notifications.relNow": "just now",
  "notifications.relMinutesAgo": "{n}m ago",
  "notifications.relHoursAgo": "{n}h ago",
  "notifications.relDaysAgo": "{n}d ago",
  "notifications.relWeeksAgo": "{n}w ago",
  "notifications.relMonthsAgo": "{n}mo ago",
};
