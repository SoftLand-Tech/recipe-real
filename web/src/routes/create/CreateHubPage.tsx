/**
 * Create hub — /create. OWNED BY SLICE CREATE (auth-gated by foundation).
 *
 * Warm entry point with the two big write paths — write a recipe from
 * scratch, or bring one in from a link/photo/video — plus a cheap summary of
 * the account's recipes and in-flight/ready imports (one page each; failures
 * degrade silently to hidden chips).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { listMyRecipeImports } from "@/api/imports";
import { fetchMyRecipes } from "@/api/userRecipes";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n";

/** Both summary fetches resolve (or fail) together; nulls = not loaded. */
interface HubSummary {
  recipes: number | null;
  activeImports: number | null;
  readyImports: number | null;
}

export default function CreateHubPage() {
  const t = useT();
  const [summary, setSummary] = useState<HubSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchMyRecipes(1), listMyRecipeImports()]).then(
      ([mine, imports]) => {
        if (cancelled) return;
        setSummary({
          recipes:
            mine.status === "fulfilled"
              ? (mine.value.meta?.total ?? mine.value.data.length)
              : null,
          activeImports:
            imports.status === "fulfilled"
              ? imports.value.filter(
                  (row) => row.status === "queued" || row.status === "processing",
                ).length
              : null,
          readyImports:
            imports.status === "fulfilled"
              ? imports.value.filter((row) => row.status === "ready").length
              : null,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight text-ink">
          {t("create.pageTitle")}
        </h1>
        <p className="font-body text-[15px] leading-relaxed text-muted">
          {t("create.hubSubtitle")}
        </p>
      </header>

      {/* Two big write-path cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/create/recipe" className="block rounded-card focus-visible:outline-none">
          <Card interactive className="flex h-full flex-col gap-3 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-orange-soft text-orange-deep">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                <path d="m14.5 6.5 3 3" />
              </svg>
            </span>
            <h2 className="font-display text-[20px] font-semibold leading-snug text-ink">
              {t("create.writeTitle")}
            </h2>
            <p className="font-body text-[14px] leading-relaxed text-muted">
              {t("create.writeBody")}
            </p>
          </Card>
        </Link>

        <Link to="/create/import" className="block rounded-card focus-visible:outline-none">
          <Card interactive className="flex h-full flex-col gap-3 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-orange-soft text-orange-deep">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3c.6 3.9 3.5 6.8 7.4 7.4-3.9.6-6.8 3.5-7.4 7.4-.6-3.9-3.5-6.8-7.4-7.4C8.5 9.8 11.4 6.9 12 3Z" />
                <path d="M18.5 15.5c.3 1.7 1.5 2.9 3.2 3.2-1.7.3-2.9 1.5-3.2 3.2-.3-1.7-1.5-2.9-3.2-3.2 1.7-.3 2.9-1.5 3.2-3.2Z" />
              </svg>
            </span>
            <h2 className="font-display text-[20px] font-semibold leading-snug text-ink">
              {t("create.importTitle")}
            </h2>
            <p className="font-body text-[14px] leading-relaxed text-muted">
              {t("create.importBody")}
            </p>
          </Card>
        </Link>
      </div>

      {/* Cheap account summary (silent-fail) */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[17px] font-semibold text-ink">
          {t("create.summaryTitle")}
        </h2>
        {summary == null ? (
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-11 w-40 rounded-pill" />
            <Skeleton className="h-11 w-44 rounded-pill" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {summary.recipes != null ? (
              <Link
                to="/create/recipes"
                className="inline-flex items-center gap-2 rounded-pill border border-[#E8DFD2] bg-white px-4 py-2 font-body text-[13.5px] font-bold text-ink transition-colors hover:border-orange hover:text-orange-deep"
              >
                {t("create.recipesChip", { n: summary.recipes })}
              </Link>
            ) : null}
            {summary.activeImports != null && summary.activeImports > 0 ? (
              <Link
                to="/create/import"
                className="inline-flex items-center gap-2 rounded-pill bg-orange-soft px-4 py-2 font-body text-[13.5px] font-bold text-orange-deep transition-colors hover:bg-orange-soft/70"
              >
                {t("create.activeImportsChip", {
                  n: summary.activeImports,
                })}
              </Link>
            ) : null}
            {summary.readyImports != null && summary.readyImports > 0 ? (
              <Link
                to="/create/import"
                className="inline-flex items-center gap-2 rounded-pill bg-dark-2 px-4 py-2 font-body text-[13.5px] font-bold text-white transition-colors hover:opacity-90"
              >
                {t("create.readyImportsChip", { n: summary.readyImports })}
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
