/**
 * Recipe composer page — /create/recipe (new) and /create/recipe/:id (edit).
 * OWNED BY SLICE CREATE. Routes are auth-gated by foundation.
 *
 * Edit mode prefill is ported from mobile's composer: the recipe loads via
 * GET /api/recipes/:id (public read), bilingual pairs are deduped
 * (splitBilingualPair), per-step minutes come from recipe_steps
 * (publisher → ai fallback) and the total falls back publisher → community.
 * Load failures (404, network…) map to a bilingual retry state; a 403 on
 * SAVE (editing someone else's row) surfaces as a friendly error.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { isRateLimitedError } from "@/api/http";
import {
  createUserRecipe,
  deleteUserRecipe,
  fetchComposerCategories,
  getRecipeForEdit,
  updateUserRecipe,
} from "@/api/userRecipes";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import {
  ComposerForm,
  splitBilingualPair,
  type ComposerInitialData,
  type ComposerStepDraft,
  type ComposerSubmitInput,
} from "@/components/ComposerForm";
import { useLang, useT } from "@/i18n";

import type { CategoryCount, Recipe } from "@/api/types";

/** Back link target + header per mode. */
type ComposerMode = "create" | "edit";

export default function RecipeComposerPage() {
  const { id } = useParams<{ id: string }>();
  const editId = id != null && /^\d+$/.test(id) ? Number(id) : null;
  const mode: ComposerMode = editId != null ? "edit" : "create";

  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [initial, setInitial] = useState<ComposerInitialData | null>(
    mode === "create" ? buildEmptyInitial() : null,
  );
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);

  // ---- Edit-mode prefill (retryable) -------------------------------------------
  const prefill = useCallback(async () => {
    if (editId == null) return;
    setLoading(true);
    setLoadError(null);
    try {
      const recipe = await getRecipeForEdit(editId);
      setInitial(recipeToInitial(recipe, lang));
    } catch (err) {
      // 404 (or any failure) → bilingual load-error state; ownership itself
      // is enforced server-side on PATCH (403 → save-time error).
      setLoadError(
        isRateLimitedError(err)
          ? 429
          : ((err as { response?: { status?: number } })?.response?.status ??
            0),
      );
    } finally {
      setLoading(false);
    }
  }, [editId, lang]);

  useEffect(() => {
    // Deferred one microtask: prefill() setStates synchronously before its
    // first await, which the hooks lint forbids directly in an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void prefill();
    });
    return () => {
      cancelled = true;
    };
  }, [prefill]);

  // Category chips (publish-mode section of the form; fetched once here so
  // the request isn't tied to the form's lifecycle).
  useEffect(() => {
    let cancelled = false;
    fetchComposerCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        // Picker simply stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Save / delete wrappers ---------------------------------------------------

  const save = useCallback(
    async (input: ComposerSubmitInput) =>
      mode === "edit" && editId != null
        ? updateUserRecipe(editId, input)
        : createUserRecipe(input),
    [mode, editId],
  );

  const onSaved = useCallback(
    (recipe: Recipe) => navigate(`/recipe/${recipe.id}`),
    [navigate],
  );

  const onDelete = useCallback(async () => {
    if (editId == null) return;
    await deleteUserRecipe(editId);
    navigate("/create/recipes");
  }, [editId, navigate]);

  // ---- Render ---------------------------------------------------------------------

  const headerTitle =
    mode === "edit" ? t("create.editTitle") : t("create.newTitle");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to={mode === "edit" ? "/create/recipes" : "/create"}
          className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-body text-[14px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 rtl:-scale-x-100"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
          {t("common.back")}
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,3.5vw,2.1rem)] font-semibold leading-tight text-ink">
          {headerTitle}
        </h1>
      </header>

      {loading ? (
        <Card className="flex min-h-64 flex-col items-center justify-center gap-3 p-8">
          <Spinner size="lg" label={t("common.loading")} />
          <p className="font-body text-[14px] text-muted">
            {t("create.loadingRecipe")}
          </p>
        </Card>
      ) : loadError != null ? (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="font-body text-[15px] font-semibold text-ink">
            {loadError === 404 || loadError === 403
              ? t("create.loadNotEditable")
              : loadError === 429
                ? t("common.rateLimited")
                : t("create.loadFailed")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="ghost"
              className="px-5 py-2.5 text-[14px]"
              onClick={() => void prefill()}
            >
              {t("common.retry")}
            </Button>
            <Link
              to="/create"
              className="rounded-pill bg-orange px-6 py-2.5 font-body text-[14px] font-bold text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-orange-deep"
            >
              {t("common.back")}
            </Link>
          </div>
        </Card>
      ) : initial != null ? (
        <ComposerForm
          key={editId ?? "new"}
          mode={mode}
          initial={initial}
          categories={categories}
          save={save}
          onSaved={onSaved}
          onDelete={mode === "edit" ? onDelete : undefined}
        />
      ) : null}
    </div>
  );
}

// ---- Initial-data builders ---------------------------------------------------------

function buildEmptyInitial(): ComposerInitialData {
  return {
    title: "",
    titleAr: "",
    description: "",
    sourceUrl: "",
    servings: "",
    minutes: "",
    prepMinutes: "",
    cookMinutes: "",
    ingredients: [""],
    steps: [
      {
        description: "",
        description_ar: "",
        minutes: "",
        literal_minutes: "",
        step_type: "active",
      },
    ],
    imageUrl: null,
  };
}

/** Port of mobile's edit-mode prefill (GET /api/recipes/:id → form rows). */
function recipeToInitial(recipe: Recipe, lang: "en" | "ar"): ComposerInitialData {
  const titlePair = splitBilingualPair(recipe.title, recipe.title_ar, lang);

  const ing = (recipe.ingredients ?? []).filter(
    (row): row is string => typeof row === "string",
  );
  const ingRows = ing.length > 0 ? ing : [""];

  const structured = recipe.recipe_steps ?? [];
  const expanded: Record<number, boolean> = {};
  let stepRows: ComposerStepDraft[];
  if (structured.length > 0) {
    stepRows = structured.map((step, index) => {
      const pair = splitBilingualPair(
        step.description,
        step.description_ar,
        lang,
      );
      if (pair.bothDistinct) expanded[index] = true;
      return {
        description: pair.en,
        description_ar: pair.ar,
        minutes:
          step.publisher_minutes != null || step.ai_minutes != null
            ? String(Math.round(step.publisher_minutes ?? step.ai_minutes ?? 0))
            : "",
        literal_minutes:
          step.literal_minutes != null
            ? String(Math.round(step.literal_minutes))
            : "",
        step_type:
          step.step_type === "passive" || step.step_type === "cleanup"
            ? step.step_type
            : "active",
      };
    });
  } else {
    const plain = (recipe.steps ?? []).filter(
      (row): row is string => typeof row === "string",
    );
    stepRows =
      plain.length > 0
        ? plain.map((text) => ({
            description: text,
            description_ar: "",
            minutes: "",
            literal_minutes: "",
            step_type: "active" as const,
          }))
        : [
            {
              description: "",
              description_ar: "",
              minutes: "",
              literal_minutes: "",
              step_type: "active" as const,
            },
          ];
  }

  const mins =
    recipe.publisher_time_minutes ?? recipe.community_avg_minutes;

  return {
    title: titlePair.en,
    titleAr: titlePair.ar,
    description: recipe.description ?? "",
    sourceUrl: recipe.source_url ?? "",
    servings:
      recipe.servings != null ? String(Math.round(recipe.servings)) : "",
    minutes: mins != null ? String(Math.round(mins)) : "",
    prepMinutes:
      recipe.prep_time_minutes != null
        ? String(Math.round(recipe.prep_time_minutes))
        : "",
    cookMinutes:
      recipe.cook_time_minutes != null
        ? String(Math.round(recipe.cook_time_minutes))
        : "",
    ingredients: ingRows,
    steps: stepRows,
    imageUrl: recipe.image_url ?? null,
    structuredItems:
      recipe.ingredients_structured?.items &&
      recipe.ingredients_structured.items.length > 0
        ? recipe.ingredients_structured.items.map((item) => ({ ...item }))
        : null,
  };
}
