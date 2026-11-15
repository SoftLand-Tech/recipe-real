/**
 * Own-profile hub (/account, authed) — OWNED BY SLICE ACCOUNT.
 *
 * The web twin of mobile's profile tab hero, scoped to what the web route
 * table offers: identity + counters from GET /api/users/me/profile, quick
 * links into edit profile / my recipes / favorites / notifications (with
 * the live unread badge) / settings. Followers/following counts link to the
 * public follow lists; deep content lists live in their own slices.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { fetchMyProfile } from "@/api/account";
import { useUnreadNotificationCount } from "@/api/notifications";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/auth/AuthContext";
import { useLang, useT, type TranslateFn } from "@/i18n";

import type { MyProfile } from "@/api/types";

type LoadState = "loading" | "ready" | "error";

/** Localized "Member since March 2024" (public-locale month/year, like mobile). */
function memberSince(t: TranslateFn, lang: string, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  try {
    const date = new Date(then).toLocaleDateString(lang === "ar" ? "ar" : "en-US", {
      month: "long",
      year: "numeric",
    });
    return t("account.memberSince", { date });
  } catch {
    return "";
  }
}

/** One counter tile; `to` turns it into a link (recipes count → management). */
function StatTile({
  value,
  label,
  to,
}: {
  value: number;
  label: string;
  to?: string;
}) {
  const inner = (
    <>
      <span className="font-body text-[19px] font-extrabold tabular-nums text-ink">
        {String(value)}
      </span>
      <span className="font-body text-[11.5px] font-semibold leading-tight text-muted">
        {label}
      </span>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="flex min-w-14 flex-col items-center gap-0.5 rounded-pill px-2 py-1 transition-colors hover:bg-orange-soft hover:text-orange-deep"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex min-w-14 flex-col items-center gap-0.5 px-2 py-1">{inner}</div>;
}

export default function AccountHubPage() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const unread = useUnreadNotificationCount();

  // Initial load inline in the effect (await-first IIFE: no synchronous
  // setState); retries re-trigger it by bumping the tick.
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyProfile();
        if (cancelled) return;
        setProfile(me);
        setState("ready");
      } catch {
        if (cancelled) return;
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  /** Retry from the error state (skeleton again) — from an event, not an effect. */
  const retry = useCallback(() => {
    setState((prev) => (prev === "error" ? "loading" : prev));
    setReloadTick((tick) => tick + 1);
  }, []);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-2xl" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Card className="mt-4 p-6">
          <div className="flex items-center gap-5">
            <Skeleton circle className="h-24 w-24" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 flex-1" />
            ))}
          </div>
        </Card>
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <h1 className="font-display text-[1.5rem] font-semibold text-ink">
            {t("common.error")}
          </h1>
          <p className="font-body text-[15px] text-muted">{t("account.loadFailed")}</p>
          <Button type="button" onClick={retry}>
            {t("common.retry")}
          </Button>
        </Card>
      </div>
    );
  }

  if (profile == null) return null;

  const displayName = (profile.user.display_name ?? profile.user.name ?? user?.name ?? "").trim();
  const since = memberSince(t, lang, profile.user.created_at);
  const uid = profile.user.id;

  const links: Array<{ to: string; label: string; badge?: number }> = [
    { to: "/account/profile", label: t("account.editProfile") },
    { to: "/create/recipes", label: t("account.myRecipes") },
    { to: "/favorites", label: t("account.favorites") },
    { to: "/notifications", label: t("account.notifications"), badge: unread },
    { to: "/settings", label: t("account.settings") },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
        {displayName || t("account.pageTitle")}
      </h1>

      {/* Identity hero */}
      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Link
            to="/account/profile"
            aria-label={t("account.editProfile")}
            className="group relative rounded-full"
          >
            <AccountAvatar
              name={displayName}
              url={profile.user.avatar_url}
              size="lg"
            />
            <span className="absolute bottom-0 end-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange text-white transition-colors group-hover:bg-orange-deep">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.45rem] font-semibold leading-tight text-ink">
              {displayName || "?"}
            </p>
            {profile.user.bio?.trim() ? (
              <p className="mt-1.5 font-body text-[14.5px] leading-relaxed text-muted">
                {profile.user.bio}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {profile.user.email ? (
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-cream-deep px-3 py-1 font-body text-[12px] font-semibold text-muted"
                  title={t("account.privateEmailA11y")}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <rect x="5" y="11" width="14" height="9" rx="2.5" />
                    <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
                  </svg>
                  <span className="truncate">{profile.user.email}</span>
                </span>
              ) : null}
              {since ? (
                <span className="font-body text-[12px] text-faint">{since}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Counters */}
        <div className="mt-6 flex items-start justify-between gap-2 border-t border-hair pt-5">
          <StatTile
            value={profile.counts.recipes}
            label={t("account.statRecipes")}
            to="/create/recipes"
          />
          <StatTile value={profile.counts.posts} label={t("account.statPosts")} />
          <StatTile
            value={profile.counts.followers}
            label={t("account.statFollowers")}
            to={`/u/${uid}/followers`}
          />
          <StatTile
            value={profile.counts.following}
            label={t("account.statFollowing")}
            to={`/u/${uid}/following`}
          />
        </div>
      </Card>

      {/* Quick links */}
      <Card className="mt-6 overflow-hidden">
        <ul className="divide-y divide-hair">
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="flex items-center gap-3 px-5 py-4 font-body text-[15px] font-bold text-ink transition-colors hover:bg-cream-deep hover:text-orange-deep"
              >
                <span className="flex-1">{link.label}</span>
                {link.badge ? (
                  <span
                    className="rounded-pill bg-orange px-2.5 py-0.5 font-body text-[12px] font-extrabold text-white tabular-nums"
                    aria-label={t("notifications.unreadA11y", { n: link.badge })}
                  >
                    {String(link.badge)}
                  </span>
                ) : null}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px] shrink-0 text-faint rtl:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
