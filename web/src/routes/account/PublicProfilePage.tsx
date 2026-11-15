/**
 * Public profile (/u/:id, PUBLIC — must work signed-out) — OWNED BY SLICE
 * ACCOUNT.
 *
 * Web twin of mobile's user/[id]: identity + counts from
 * GET /api/users/{id}/profile (is_following/is_self ride along when a token
 * exists), newest recipes grid from GET /api/users/{id}/recipes, an
 * optimistic follow/unfollow button (anon → login prompt), and the ⋯ menu
 * with Report (reports their newest post, like mobile) and Block
 * (POST /api/users/{id}/block). Anonymous visitors get the full read-only
 * page; only the write actions prompt sign-in.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { fetchUserRecipes, reportUserByNewestPost } from "@/api/account";
import { blockUser, fetchPublicProfile, followUser, unfollowUser } from "@/api/follow";
import { AccountAvatar } from "@/components/AccountAvatar";
import { AccountConfirmDialog } from "@/components/AccountConfirmDialog";
import { AccountRecipeCard } from "@/components/AccountRecipeCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ProfileFollowButton } from "@/components/ProfileFollowButton";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useLang, useT } from "@/i18n";

import type { MyProfile, Recipe } from "@/api/types";

type LoadState = "loading" | "ready" | "error";
type MenuState = null | "menu" | "report" | "block";

export default function PublicProfilePage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userId = id != null ? Number(id) : NaN;
  const { status } = useAuth();
  const { lang } = useLang();

  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesPage, setRecipesPage] = useState(1);
  const [recipesHasMore, setRecipesHasMore] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const validId = Number.isFinite(userId) && userId > 0;

  // Initial load inline in the effect (await-first IIFE: no synchronous
  // setState); retries re-trigger it by bumping the tick. !validId is
  // handled in render — the effect only runs for a real id.
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [me, recipePage] = await Promise.all([
          fetchPublicProfile(userId),
          fetchUserRecipes(userId, 1).catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(me);
        if (recipePage) {
          setRecipes(recipePage.data);
          setRecipesPage(1);
          setRecipesHasMore(recipePage.meta.current_page < recipePage.meta.last_page);
        }
        setState("ready");
      } catch {
        if (cancelled) return;
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validId, userId, reloadTick]);

  /** Retry from the error state (skeleton again) — from an event, not an effect. */
  const retry = useCallback(() => {
    if (!validId) return;
    setState((prev) => (prev === "error" ? "loading" : prev));
    setReloadTick((tick) => tick + 1);
  }, [validId]);

  const loadMoreRecipes = useCallback(async () => {
    if (loadingRecipes || !recipesHasMore || !validId) return;
    setLoadingRecipes(true);
    try {
      const page = await fetchUserRecipes(userId, recipesPage + 1);
      setRecipes((prev) => [
        ...prev,
        ...page.data.filter((row) => !prev.some((other) => other.id === row.id)),
      ]);
      setRecipesPage((value) => value + 1);
      setRecipesHasMore(page.meta.current_page < page.meta.last_page);
    } catch {
      // Non-fatal: the Load more button stays as the retry affordance.
    } finally {
      setLoadingRecipes(false);
    }
  }, [loadingRecipes, recipesHasMore, validId, userId, recipesPage]);

  const loginRedirect = useCallback(() => {
    const returnTo = encodeURIComponent(`/u/${userId}`);
    navigate(`/login?returnTo=${returnTo}`);
  }, [navigate, userId]);

  /** Optimistic follow flip with rollback (mobile semantics). */
  const toggleFollow = useCallback(async () => {
    if (profile == null || followBusy) return;
    if (status !== "authed") {
      loginRedirect();
      return;
    }
    const prev = profile;
    const nextFollowing = !profile.is_following;
    setFollowBusy(true);
    setProfile({
      ...profile,
      is_following: nextFollowing,
      counts: {
        ...profile.counts,
        followers: Math.max(0, profile.counts.followers + (nextFollowing ? 1 : -1)),
      },
    });
    try {
      if (nextFollowing) await followUser(profile.user.id);
      else await unfollowUser(profile.user.id);
    } catch {
      setProfile(prev);
      toast.error(t("profile.followFailed"));
    } finally {
      setFollowBusy(false);
    }
  }, [profile, followBusy, status, loginRedirect, toast, t]);

  const handleReport = useCallback(async () => {
    if (profile == null || actionBusy) return;
    if (status !== "authed") {
      setMenu(null);
      loginRedirect();
      return;
    }
    setActionBusy(true);
    try {
      const reported = await reportUserByNewestPost(profile.user.id);
      setMenu(null);
      if (reported) toast.show(t("profile.reported"));
      else toast.show(t("profile.reportNoPosts"));
    } catch {
      toast.error(t("profile.reportFailed"));
    } finally {
      setActionBusy(false);
    }
  }, [profile, actionBusy, status, loginRedirect, toast, t]);

  const handleBlock = useCallback(async () => {
    if (profile == null || actionBusy) return;
    if (status !== "authed") {
      setMenu(null);
      loginRedirect();
      return;
    }
    setActionBusy(true);
    try {
      await blockUser(profile.user.id);
      setMenu(null);
      toast.show(
        t("profile.blockedMessage", { name: displayNameOf(profile) }),
      );
      // Away from the blocked profile (mobile pops back after its sheet).
      if (window.history.length > 1) navigate(-1);
      else navigate("/", { replace: true });
    } catch {
      toast.error(t("profile.blockFailed"));
    } finally {
      setActionBusy(false);
    }
  }, [profile, actionBusy, status, loginRedirect, toast, t, navigate]);

  if (!validId) {
    // Malformed :id — nothing to fetch; error card without retry.
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <h1 className="font-display text-[1.5rem] font-semibold text-ink">
            {t("common.error")}
          </h1>
          <p className="font-body text-[15px] text-muted">
            {t("profile.publicLoadFailed")}
          </p>
        </Card>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl" aria-busy="true">
        <Card className="p-6">
          <div className="flex items-center gap-5">
            <Skeleton circle className="h-24 w-24" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-3 border-t border-hair pt-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 flex-1" />
            ))}
          </div>
        </Card>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2.5 px-4 pb-5 pt-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state === "error" || profile == null) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <h1 className="font-display text-[1.5rem] font-semibold text-ink">
            {t("common.error")}
          </h1>
          <p className="font-body text-[15px] text-muted">
            {t("profile.publicLoadFailed")}
          </p>
          {validId ? (
            <Button type="button" onClick={retry}>
              {t("common.retry")}
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  const displayName = displayNameOf(profile);
  const isSelf = profile.is_self === true;
  const isFollowing = status === "authed" && profile.is_following === true;

  const cookingSince = (() => {
    const then = Date.parse(profile.user.created_at);
    if (!Number.isFinite(then)) return null;
    try {
      const date = new Date(then).toLocaleDateString(lang === "ar" ? "ar" : "en-US", {
        month: "long",
        year: "numeric",
      });
      return t("profile.cookingSince", { date });
    } catch {
      return null;
    }
  })();

  return (
    <div className="mx-auto max-w-3xl">
      {/* Self-preview banner */}
      {isSelf ? (
        <Card className="mb-4 flex flex-wrap items-center gap-3 px-5 py-3.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-orange"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5" />
          </svg>
          <p className="flex-1 font-body text-[14px] font-semibold text-ink">
            {t("profile.thisIsYou")}
          </p>
          <Link
            to="/account/profile"
            className="rounded-pill bg-orange-soft px-4 py-1.5 font-body text-[13px] font-bold text-orange-deep transition-colors hover:bg-orange hover:text-white"
          >
            {t("profile.editProfile")}
          </Link>
        </Card>
      ) : null}

      {/* Identity hero */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-5">
          <AccountAvatar name={displayName} url={profile.user.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold leading-tight text-ink">
                {displayName}
              </h1>
              {/* ⋯ moderation menu (hidden on your own profile) */}
              {!isSelf ? (
                <div className="relative ms-auto">
                  <button
                    type="button"
                    aria-label={t("profile.userActions")}
                    aria-haspopup="menu"
                    aria-expanded={menu === "menu"}
                    onClick={() => setMenu(menu === "menu" ? null : "menu")}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-cream-deep hover:text-ink"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                  {menu === "menu" ? (
                    <>
                      <button
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setMenu(null)}
                      />
                      <div
                        role="menu"
                        className="absolute end-0 top-11 z-40 w-52 overflow-hidden rounded-md border border-hair bg-white shadow-[var(--shadow-card-hover)]"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setMenu("report")}
                          className="block w-full px-4 py-3 text-start font-body text-[14px] font-semibold text-ink transition-colors hover:bg-cream-deep"
                        >
                          {t("profile.reportUser")}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setMenu("block")}
                          className="block w-full border-t border-hair px-4 py-3 text-start font-body text-[14px] font-semibold text-orange-deep transition-colors hover:bg-cream-deep"
                        >
                          {t("profile.blockUser")}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            {cookingSince ? (
              <p className="mt-1 font-body text-[12.5px] text-faint">{cookingSince}</p>
            ) : null}
            {profile.user.bio?.trim() ? (
              <p className="mt-2 font-body text-[14.5px] leading-relaxed text-muted">
                {profile.user.bio}
              </p>
            ) : null}
          </div>
        </div>

        {/* Counters */}
        <div className="mt-6 flex items-start justify-between gap-2 border-t border-hair pt-5">
          <div className="flex min-w-14 flex-col items-center gap-0.5 px-2 py-1">
            <span className="font-body text-[19px] font-extrabold tabular-nums text-ink">
              {String(profile.counts.recipes)}
            </span>
            <span className="font-body text-[11.5px] font-semibold text-muted">
              {t("account.statRecipes")}
            </span>
          </div>
          <div className="flex min-w-14 flex-col items-center gap-0.5 px-2 py-1">
            <span className="font-body text-[19px] font-extrabold tabular-nums text-ink">
              {String(profile.counts.posts)}
            </span>
            <span className="font-body text-[11.5px] font-semibold text-muted">
              {t("account.statPosts")}
            </span>
          </div>
          <Link
            to={`/u/${profile.user.id}/followers`}
            className="flex min-w-14 flex-col items-center gap-0.5 rounded-pill px-2 py-1 transition-colors hover:bg-orange-soft"
          >
            <span className="font-body text-[19px] font-extrabold tabular-nums text-ink">
              {String(profile.counts.followers)}
            </span>
            <span className="font-body text-[11.5px] font-semibold text-muted">
              {t("account.statFollowers")}
            </span>
          </Link>
          <Link
            to={`/u/${profile.user.id}/following`}
            className="flex min-w-14 flex-col items-center gap-0.5 rounded-pill px-2 py-1 transition-colors hover:bg-orange-soft"
          >
            <span className="font-body text-[19px] font-extrabold tabular-nums text-ink">
              {String(profile.counts.following)}
            </span>
            <span className="font-body text-[11.5px] font-semibold text-muted">
              {t("account.statFollowing")}
            </span>
          </Link>
        </div>

        {!isSelf ? (
          <div className="mt-6">
            <ProfileFollowButton
              following={isFollowing}
              busy={followBusy}
              onToggle={() => void toggleFollow()}
            />
          </div>
        ) : null}
      </Card>

      {/* Recipes */}
      <section className="mt-8" aria-label={t("account.statRecipes")}>
        {recipes.length === 0 ? (
          <EmptyState title={t("profile.noUserRecipes")} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <AccountRecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
            {recipesHasMore ? (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  loading={loadingRecipes}
                  disabled={loadingRecipes}
                  onClick={() => void loadMoreRecipes()}
                >
                  {t("profile.recipesLoadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Report confirm */}
      <AccountConfirmDialog
        open={menu === "report"}
        destructive
        busy={actionBusy}
        title={t("profile.reportUser")}
        message={t("profile.reportConfirm", { name: displayName })}
        confirmLabel={t("profile.reportUser")}
        onConfirm={() => void handleReport()}
        onCancel={() => setMenu(null)}
      />

      {/* Block confirm */}
      <AccountConfirmDialog
        open={menu === "block"}
        destructive
        busy={actionBusy}
        title={t("profile.blockUser")}
        message={t("profile.blockConfirm", { name: displayName })}
        confirmLabel={t("profile.blockBtn")}
        onConfirm={() => void handleBlock()}
        onCancel={() => setMenu(null)}
      />
    </div>
  );
}

/** Display name with the public fallback (payload already carries one). */
function displayNameOf(profile: MyProfile): string {
  return (profile.user.display_name ?? profile.user.name ?? "").trim() || "?";
}
