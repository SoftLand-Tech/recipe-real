/**
 * Ingredients card (slice RECIPE): servings scaler (1×/2×/3× chips), the
 * checkable ingredient checklist persisted per recipe in localStorage, and
 * structured "½ cup | brown sugar, packed" rows when the parsed data lines
 * up 1:1 with the (possibly localized) text list — plain bullets otherwise.
 */
import { memo, useCallback, useMemo, useState } from "react";

import { Card } from "@/components/Card";
import { useT } from "@/i18n";
import type { Recipe } from "@/api/types";
import {
  formatIngredientDisplay,
  parseStructuredIngredients,
  scaledServings,
  type StructuredIngredient,
} from "@/routes/recipe/RecipeIngredientMath";
import { useLocalizedRecipe } from "@/routes/recipe/RecipeLocalizedText";
import { cn } from "@/utils/cn";

const SCALE_MULTIPLIERS = [1, 2, 3] as const;

/** localStorage key prefix for per-recipe checked ingredient indices. */
const CHECKED_ING_KEY_PREFIX = "rr_checked_ing_";

function readChecked(recipeId: number): Set<number> {
  try {
    const raw = window.localStorage.getItem(`${CHECKED_ING_KEY_PREFIX}${recipeId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter(
        (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0,
      ),
    );
  } catch {
    return new Set();
  }
}

function writeChecked(recipeId: number, indices: Set<number>): void {
  try {
    if (indices.size === 0) {
      window.localStorage.removeItem(`${CHECKED_ING_KEY_PREFIX}${recipeId}`);
    } else {
      window.localStorage.setItem(
        `${CHECKED_ING_KEY_PREFIX}${recipeId}`,
        JSON.stringify(Array.from(indices)),
      );
    }
  } catch {
    // Best-effort persistence; the in-session checklist keeps working.
  }
}

const IngredientRow = memo(function IngredientRow({
  index,
  ingredient,
  structured,
  scaleMultiplier,
  checked,
  onToggle,
}: {
  index: number;
  ingredient: string;
  structured?: StructuredIngredient;
  scaleMultiplier: number;
  checked: boolean;
  onToggle: (index: number) => void;
}) {
  const t = useT();
  const { hasStructure, qtyPart, itemText, fullText } = formatIngredientDisplay(
    ingredient,
    structured,
    scaleMultiplier,
  );
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(index)}
        aria-pressed={checked}
        aria-label={t("recipe.checkedA11y", { text: fullText })}
        className="flex w-full items-start gap-3 rounded-md py-1.5 text-start hover:bg-cream-deep/60"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
            checked
              ? "border-orange bg-orange text-white"
              : "border-faint/60 text-transparent",
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <span
          className={cn(
            "text-[15px] leading-relaxed",
            checked ? "text-faint line-through" : "text-ink",
          )}
        >
          {hasStructure ? (
            <>
              <span className="font-bold">{qtyPart}</span>
              {` ${itemText}`}
            </>
          ) : (
            fullText
          )}
        </span>
      </button>
    </li>
  );
});

export function RecipeIngredientsCard({ recipe }: { recipe: Recipe }) {
  const t = useT();
  const lr = useLocalizedRecipe();

  const [mult, setMult] = useState(1);
  // Checklist is hydrated once per mount from localStorage (the parent keys
  // this component by recipe.id, so a recipe change remounts it) — a lazy
  // initializer reads storage before first paint with no effect dance.
  const [checked, setChecked] = useState<Set<number>>(() =>
    readChecked(recipe.id),
  );

  const onToggle = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        writeChecked(recipe.id, next);
        return next;
      });
    },
    [recipe.id],
  );

  const onClear = useCallback(() => {
    setChecked(new Set());
    writeChecked(recipe.id, new Set());
  }, [recipe.id]);

  const ingredientLines = useMemo(
    () => lr.ingredients(recipe),
    [lr, recipe],
  );
  const structuredIngredients = useMemo(
    () => parseStructuredIngredients(recipe.ingredients_structured),
    [recipe.ingredients_structured],
  );
  // Use the structured rows only when they line up 1:1 with the (possibly
  // localized) text list — otherwise plain bullets stay the fallback.
  const structuredAligned =
    ingredientLines.length > 0 &&
    structuredIngredients.length === ingredientLines.length;

  const servings = scaledServings(recipe, mult);

  if (ingredientLines.length === 0) {
    return (
      <Card className="px-6 py-6">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t("recipe.ingredients")}
        </h2>
        <p className="mt-3 text-[14.5px] text-muted">
          {t("recipe.noIngredients")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
            {t("recipe.ingredients")}
          </h2>
          {servings != null ? (
            <p className="mt-0.5 text-[13.5px] font-semibold text-muted">
              {t("recipe.servingsScaled", { n: servings })}
            </p>
          ) : null}
        </div>
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={t("recipe.ingredients")}
        >
          {SCALE_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMult(m)}
              aria-pressed={mult === m}
              aria-label={t("recipe.scaleA11y", { n: m })}
              className={cn(
                "rounded-pill px-3.5 py-1.5 font-body text-[13px] font-bold transition-colors",
                mult === m
                  ? "bg-orange-soft text-orange-deep"
                  : "bg-cream-deep text-muted hover:text-ink",
              )}
            >
              {`${m}×`}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 flex flex-col">
        {ingredientLines.map((ingredient, idx) => (
          <IngredientRow
            key={`ing-${idx}`}
            index={idx}
            ingredient={ingredient}
            structured={structuredAligned ? structuredIngredients[idx] : undefined}
            scaleMultiplier={mult}
            checked={checked.has(idx)}
            onToggle={onToggle}
          />
        ))}
      </ul>

      {checked.size > 0 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="rounded-pill px-3 py-1.5 font-body text-[13px] font-bold text-muted hover:text-ink"
          >
            {t("recipe.clearChecked")}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
