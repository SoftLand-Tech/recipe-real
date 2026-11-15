/**
 * Profile screens: edit profile + public profile (namespace `profile.*`) —
 * OWNED BY SLICE ACCOUNT. Arabic mirrors mobile/src/i18n/ar.ts.
 */
export const en: Record<string, string> = {
  "profile.pageTitle": "Edit profile",
  "profile.publicTitle": "Profile",
  "profile.title": "Your profile",
  "profile.backToAccount": "Back to account",

  // ---- Edit form -----------------------------------------------------------
  "profile.displayName": "Display name",
  "profile.displayNamePlaceholder": "Display name",
  "profile.nameHint": "2–40 characters",
  "profile.bio": "Bio",
  "profile.bioPlaceholder": "Tell cooks about yourself…",
  "profile.bioCount": "{n}/500",
  "profile.changePhoto": "Change photo",
  "profile.removePhoto": "Remove photo",
  "profile.photoHint": "JPG, PNG or WebP — center-cropped to a square.",
  "profile.saved": "Saved ✓",
  "profile.errNameLength": "Display name must be 2–40 characters.",
  "profile.errBioLong": "Bio must be 500 characters or less.",
  "profile.errSave": "Couldn't save your profile. Please try again.",
  "profile.errBioRejected":
    "Bio can't mention haram ingredients or alcohol — please rephrase.",
  "profile.errUploadAvatar": "Couldn't upload photo. Please try again.",

  // ---- Public profile --------------------------------------------------------
  "profile.publicLoadFailed": "Couldn't load this profile.",
  "profile.follow": "Follow",
  "profile.unfollow": "Unfollow",
  "profile.followingBtn": "Following",
  "profile.followFailed": "Couldn't update follow. Please try again.",
  "profile.cookingSince": "Cooking since {date}",
  "profile.noUserRecipes": "No recipes published yet.",
  "profile.recipesLoadMore": "Load more",
  "profile.thisIsYou": "This is your public profile",
  "profile.editProfile": "Edit profile",
  "profile.userActions": "Profile actions",
  "profile.reportUser": "Report user",
  "profile.reportConfirm": "Report {name} to the moderators?",
  "profile.reported": "Reported. Thank you for keeping RecipeReal kind.",
  "profile.reportNoPosts": "This user has no posts to report yet.",
  "profile.reportFailed": "Couldn't send the report. Please try again.",
  "profile.blockUser": "Block user",
  "profile.blockConfirm": "Block {name}? Their posts and comments will be hidden from you.",
  "profile.blockBtn": "Block",
  "profile.blockedMessage": "{name} has been blocked. Their posts and comments are now hidden.",
  "profile.blockFailed": "Couldn't block this user. Please try again.",
};
