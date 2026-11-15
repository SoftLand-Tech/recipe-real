/**
 * Dictionary aggregator (FOUNDATION OWNED).
 *
 * Imports EVERY namespace's en/ar pair and merges them into the two flat
 * records the i18n facade looks keys up in. Slices never edit this file —
 * their per-slice `<ns>.en.ts` / `<ns>.ar.ts` files are already wired here,
 * so a new key lands in both languages the moment it's added to those files.
 *
 * Namespaces (binding, from the slice contracts — no key collisions):
 *   FOUNDATION common/nav/auth · BROWSE home/browse/reality ·
 *   RECIPE recipe/cook/pace · ACCOUNT account/profile/settings/
 *   notifications/favorites/follow · COMMUNITY community/post/composer ·
 *   CREATE create/import/myRecipes
 */
import { ar as accountAr } from "./account.ar";
import { en as accountEn } from "./account.en";
import { ar as authAr } from "./auth.ar";
import { en as authEn } from "./auth.en";
import { ar as browseAr } from "./browse.ar";
import { en as browseEn } from "./browse.en";
import { ar as commonAr } from "./common.ar";
import { en as commonEn } from "./common.en";
import { ar as communityAr } from "./community.ar";
import { en as communityEn } from "./community.en";
import { ar as composerAr } from "./composer.ar";
import { en as composerEn } from "./composer.en";
import { ar as cookAr } from "./cook.ar";
import { en as cookEn } from "./cook.en";
import { ar as createAr } from "./create.ar";
import { en as createEn } from "./create.en";
import { ar as favoritesAr } from "./favorites.ar";
import { en as favoritesEn } from "./favorites.en";
import { ar as followAr } from "./follow.ar";
import { en as followEn } from "./follow.en";
import { ar as homeAr } from "./home.ar";
import { en as homeEn } from "./home.en";
import { ar as importAr } from "./import.ar";
import { en as importEn } from "./import.en";
import { ar as myRecipesAr } from "./myRecipes.ar";
import { en as myRecipesEn } from "./myRecipes.en";
import { ar as navAr } from "./nav.ar";
import { en as navEn } from "./nav.en";
import { ar as notificationsAr } from "./notifications.ar";
import { en as notificationsEn } from "./notifications.en";
import { ar as paceAr } from "./pace.ar";
import { en as paceEn } from "./pace.en";
import { ar as postAr } from "./post.ar";
import { en as postEn } from "./post.en";
import { ar as profileAr } from "./profile.ar";
import { en as profileEn } from "./profile.en";
import { ar as realityAr } from "./reality.ar";
import { en as realityEn } from "./reality.en";
import { ar as recipeAr } from "./recipe.ar";
import { en as recipeEn } from "./recipe.en";
import { ar as settingsAr } from "./settings.ar";
import { en as settingsEn } from "./settings.en";

/** Merged English dictionary (fallback language). */
export const en: Record<string, string> = Object.assign(
  {},
  // FOUNDATION
  commonEn,
  navEn,
  authEn,
  // BROWSE
  homeEn,
  browseEn,
  realityEn,
  // RECIPE
  recipeEn,
  cookEn,
  paceEn,
  // ACCOUNT
  accountEn,
  profileEn,
  settingsEn,
  notificationsEn,
  favoritesEn,
  followEn,
  // COMMUNITY
  communityEn,
  postEn,
  composerEn,
  // CREATE
  createEn,
  importEn,
  myRecipesEn,
);

/** Merged Arabic dictionary. */
export const ar: Record<string, string> = Object.assign(
  {},
  // FOUNDATION
  commonAr,
  navAr,
  authAr,
  // BROWSE
  homeAr,
  browseAr,
  realityAr,
  // RECIPE
  recipeAr,
  cookAr,
  paceAr,
  // ACCOUNT
  accountAr,
  profileAr,
  settingsAr,
  notificationsAr,
  favoritesAr,
  followAr,
  // COMMUNITY
  communityAr,
  postAr,
  composerAr,
  // CREATE
  createAr,
  importAr,
  myRecipesAr,
);
