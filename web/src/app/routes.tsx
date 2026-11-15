/**
 * Route table (FOUNDATION OWNED — slices replace their stub page components,
 * never this file).
 *
 * Full route table from the slice contracts, mounted under basename '/app'.
 * Every non-foundation page is a React.lazy stub inside the owning slice's
 * folder, so slice work compiles to its own chunk and merges without
 * touching this file. Auth-gated routes (own profile data, notifications,
 * composing, creating) are wrapped in <RequireAuth>; every public read
 * (recipes, posts, profiles, favorites) stays usable signed-out.
 */
import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import { AppShell } from "@/app/AppShell";
import { RequireAuth } from "@/auth/AuthContext";

// FOUNDATION
const LoginPage = lazy(() => import("@/routes/login/LoginPage"));
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"));

// BROWSE
const HomePage = lazy(() => import("@/routes/browse/HomePage"));
const BrowsePage = lazy(() => import("@/routes/browse/BrowsePage"));
const RealityPage = lazy(() => import("@/routes/browse/RealityPage"));

// RECIPE
const RecipeDetailPage = lazy(() => import("@/routes/recipe/RecipeDetailPage"));
const CookModePage = lazy(() => import("@/routes/recipe/CookModePage"));

// COMMUNITY
const CommunityFeedPage = lazy(() =>
  import("@/routes/community/CommunityFeedPage"),
);
const PostDetailPage = lazy(() => import("@/routes/community/PostDetailPage"));
const ComposePage = lazy(() => import("@/routes/community/ComposePage"));

// ACCOUNT
const AccountHubPage = lazy(() => import("@/routes/account/AccountHubPage"));
const AccountProfilePage = lazy(() =>
  import("@/routes/account/AccountProfilePage"),
);
const PublicProfilePage = lazy(() =>
  import("@/routes/account/PublicProfilePage"),
);
const FollowersPage = lazy(() => import("@/routes/account/FollowersPage"));
const FollowingPage = lazy(() => import("@/routes/account/FollowingPage"));
const SettingsPage = lazy(() => import("@/routes/account/SettingsPage"));
const NotificationsPage = lazy(() =>
  import("@/routes/account/NotificationsPage"),
);
const FavoritesPage = lazy(() => import("@/routes/account/FavoritesPage"));

// CREATE
const CreateHubPage = lazy(() => import("@/routes/create/CreateHubPage"));
const RecipeComposerPage = lazy(() =>
  import("@/routes/create/RecipeComposerPage"),
);
const ImportPage = lazy(() => import("@/routes/create/ImportPage"));
const MyRecipesPage = lazy(() => import("@/routes/create/MyRecipesPage"));

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppShell />,
      children: [
        // ---- BROWSE -----------------------------------------------------
        { index: true, element: <HomePage /> },
        { path: "browse", element: <BrowsePage /> },
        { path: "reality", element: <RealityPage /> },

        // ---- RECIPE -------------------------------------------------------
        { path: "recipe/:id", element: <RecipeDetailPage /> },
        { path: "cook/:id", element: <CookModePage /> },

        // ---- COMMUNITY ----------------------------------------------------
        { path: "community", element: <CommunityFeedPage /> },
        { path: "community/compose", element: <RequireAuth><ComposePage /></RequireAuth> },
        { path: "post/:id", element: <PostDetailPage /> },

        // ---- ACCOUNT ------------------------------------------------------
        { path: "u/:id", element: <PublicProfilePage /> },
        { path: "u/:id/followers", element: <FollowersPage /> },
        { path: "u/:id/following", element: <FollowingPage /> },
        { path: "account", element: <RequireAuth><AccountHubPage /></RequireAuth> },
        { path: "account/profile", element: <RequireAuth><AccountProfilePage /></RequireAuth> },
        { path: "settings", element: <SettingsPage /> },
        { path: "notifications", element: <RequireAuth><NotificationsPage /></RequireAuth> },
        // Favorites are device-local (localStorage rr_favorites_v1) — usable anon.
        { path: "favorites", element: <FavoritesPage /> },

        // ---- CREATE ---------------------------------------------------------
        { path: "create", element: <RequireAuth><CreateHubPage /></RequireAuth> },
        { path: "create/recipe", element: <RequireAuth><RecipeComposerPage /></RequireAuth> },
        { path: "create/recipe/:id", element: <RequireAuth><RecipeComposerPage /></RequireAuth> },
        { path: "create/import", element: <RequireAuth><ImportPage /></RequireAuth> },
        { path: "create/recipes", element: <RequireAuth><MyRecipesPage /></RequireAuth> },

        { path: "*", element: <NotFoundPage /> },
      ],
    },
    // Sign-in lives OUTSIDE the shell: a clean, focused kitchen-table hero
    // with no nav chrome competing with the single action.
    { path: "/login", element: <LoginPage /> },
    // NOTE: unknown paths (e.g. /xyz) fall into the "/" layout route's child
    // catch-all above (NotFoundPage inside the shell); no top-level "*"
    // route exists — it would shadow that and silently redirect home.
  ],
  // The SPA is served same-origin at /app by Laravel; every route above is
  // resolved relative to that base.
  { basename: "/app" },
);
