/**
 * App shell (FOUNDATION OWNED): the chrome every in-app route renders in —
 * desktop top nav bar (≥768px) + mobile bottom tab bar, per DESIGN.md's
 * "mobile-web: bottom tab bar; desktop ≥768px: top nav bar".
 *
 * RTL-safe by construction: layout uses logical utilities only (mx-auto,
 * gap, ms-/me-), and the direction itself comes from <html dir> which the
 * I18nProvider flips with the language. Content column is capped at
 * ~1100px, centered, on the warm cream ground.
 */
import { Suspense } from "react";
import { Link, NavLink, Outlet } from "react-router";

import { MAIN_TABS, SECONDARY_LINKS } from "@/app/nav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/i18n";
import { cn } from "@/utils/cn";

/**
 * Tab icons drawn inline per DESIGN.md ("icons are hand-drawn inline SVG —
 * 1.8–2.4 stroke, round caps and joins — never emoji, never an icon font").
 */
function TabIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" {...common} />
        <path d="M5.5 9.5V21h13V9.5" {...common} />
      </>
    ),
    browse: (
      <>
        <circle cx="12" cy="12" r="9" {...common} />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" {...common} />
      </>
    ),
    community: (
      <>
        <circle cx="9" cy="8" r="3.2" {...common} />
        <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" {...common} />
        <circle cx="17" cy="9" r="2.6" {...common} />
        <path d="M16.2 14.7c2.3.2 4 1.6 4.4 4.3" {...common} />
      </>
    ),
    favorites: (
      <path
        d="M12 20C6 15.5 3 12.6 3 9.2 3 6.9 4.8 5 7.2 5c1.8 0 3.3 1 4.8 3 1.5-2 3-3 4.8-3C19.2 5 21 6.9 21 9.2c0 3.4-3 6.3-9 10.8Z"
        {...common}
      />
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="3.5" {...common} />
        <path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5" {...common} />
      </>
    ),
    create: <path d="M12 5v14M5 12h14" {...common} />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      {paths[name]}
    </svg>
  );
}

/** Brand lockup: the shipped RecipeReal mark + DM Sans wordmark ("Real" in
 *  orange), matching the landing exactly — same 34px `recipereallogo.webp`
 *  the marketing nav and footer render. */
function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-md font-body text-[22px] font-extrabold tracking-tight text-ink"
    >
      <img
        src="/app/img/recipereallogo.webp"
        alt=""
        width={34}
        height={33}
        className="h-[34px] w-[34px] object-contain"
      />
      Recipe<span className="text-orange">Real</span>
    </Link>
  );
}

export function AppShell() {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      {/* ---- Top bar (cream, sticky, hairline underside) -------------------- */}
      <header className="sticky top-0 z-40 border-b border-hair/70 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center gap-4 px-4 md:px-6">
          <Brand />

          {/* Desktop links: main tabs + Create, per nav.ts. */}
          <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label={t("nav.primary")}>
            {MAIN_TABS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-pill px-3 py-1.5 font-body text-[14.5px] font-semibold transition-colors",
                    isActive ? "text-orange-deep" : "text-muted hover:text-ink",
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
            <NavLink
              to={SECONDARY_LINKS[0].to}
              className="rounded-pill bg-orange px-3.5 py-1.5 font-body text-[14px] font-bold text-white transition-colors hover:bg-orange-deep"
            >
              {t(SECONDARY_LINKS[0].labelKey)}
            </NavLink>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            {/* Compact create entry for phones (no desktop pill there). */}
            <NavLink
              to="/create"
              aria-label={t("nav.create")}
              title={t("nav.create")}
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-orange text-white transition-colors hover:bg-orange-deep md:hidden"
            >
              <TabIcon name="create" />
            </NavLink>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ---- Content column (~1100px, generous breathing room) -------------- */}
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-12 md:pt-10">
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <Spinner size="lg" label={t("common.loading")} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* ---- Mobile bottom tab bar (≥768px hides; desktop uses top bar) ----- */}
      <nav
        aria-label={t("nav.tabs")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-white/95 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-[1100px] items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {MAIN_TABS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-w-16 flex-col items-center gap-1 rounded-pill px-2 py-2.5 font-body text-[11px] font-bold transition-colors",
                  isActive ? "bg-orange-soft text-orange-deep" : "text-faint hover:text-ink",
                )
              }
            >
              <TabIcon name={item.labelKey.split(".")[1]} />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
