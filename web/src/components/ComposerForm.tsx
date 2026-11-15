/**
 * ComposerForm — the recipe editor shared by the CREATE slice's three write
 * paths (OWNED BY SLICE CREATE; "Composer"-prefixed shared component).
 *
 *   • RecipeComposerPage  → mode "create" | "edit"  (POST/PATCH /api/recipes)
 *   • ImportPage review   → mode "publish"          (POST .../publish)
 *
 * Faithful web port of mobile's recipe-composer.tsx form semantics:
 *   - the exact UserRecipeInput the API accepts (bilingual title/steps,
 *     ingredients, servings, time estimates, per-step type + minutes + alarm,
 *     cover photo via the foundation uploader);
 *   - client-side validation mirroring the Laravel rules (caught before the
 *     request leaves);
 *   - draft-safe UX: dirty tracking + a discard-confirm blocker on router
 *     navigation + beforeunload for the tab close;
 *   - halal-gate rejections surface verbatim as a terms card;
 *   - bilingual fields stay single-field unless the recipe actually has both
 *     languages (splitBilingualPair dedupes the server's NOT-NULL fallbacks).
 *
 * Publishing (import drafts) is an EXPLICIT user action — this form never
 * submits on load, blur or polling. In publish mode it also sends the
 * category + structured-ingredient extras the publish endpoint accepts.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router";

import { uploadImage } from "@/api/upload";
import { HalalRejectionError } from "@/api/userRecipes";
import { isRateLimitedError } from "@/api/http";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { CreateConfirmDialog } from "@/components/CreateConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLang, useT } from "@/i18n";
import { cn } from "@/utils/cn";

import type {
  CategoryCount,
  Recipe,
  UserRecipeInput,
  UserRecipeStepInput,
} from "@/api/types";

// ---- Server-mirrored validation limits (StoreUserRecipeRequest) ----------------
const TITLE_MAX = 255;
const DESCRIPTION_MAX = 2000;
const INGREDIENT_MAX = 300;
const INGREDIENTS_MIN = 1;
const INGREDIENTS_MAX = 60;
const STEP_MAX = 2000;
const STEPS_MIN = 1;
const STEPS_MAX = 40;
const MINUTES_MIN = 1;
const MINUTES_MAX = 1440;
const SERVINGS_MIN = 1;
const SERVINGS_MAX = 50;

const STEP_TYPES = ["active", "passive", "cleanup"] as const;
const TOTAL_TIME_PRESETS = [15, 30, 45, 60, 90] as const;
const STEP_TIME_PRESETS = [5, 10, 15] as const;
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/;

/** Cover-photo uploads (POST /api/uploads) accept these, ≤4MB. */
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COVER_MAX_BYTES = 4 * 1024 * 1024;

/** One dynamic step row (minutes kept as raw text until save). */
export interface ComposerStepDraft {
  description: string;
  description_ar: string;
  minutes: string;
  literal_minutes: string;
  step_type: (typeof STEP_TYPES)[number];
}

/** Prefilled form values supplied by the owning page. */
export interface ComposerInitialData {
  title: string;
  titleAr: string;
  description: string;
  sourceUrl: string;
  servings: string;
  minutes: string;
  prepMinutes: string;
  cookMinutes: string;
  ingredients: string[];
  steps: ComposerStepDraft[];
  /** Already-uploaded cover (edit mode / import draft); null when none. */
  imageUrl: string | null;
  /** Import drafts: the structured ingredient items to ride along. */
  structuredItems?: Array<Record<string, unknown>> | null;
  /** Import drafts: the extracted category to preselect. */
  category?: string | null;
}

/** What the form hands to the page's save() — UserRecipeInput (+publish extras). */
export type ComposerSubmitInput = UserRecipeInput & {
  category?: string;
};

/** Digits-only parse; empty (optional) fields parse to null. */
export function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Deduplicate single-language fallback values persisted on the server (where
 * NOT NULL `title`/`description` stores the Arabic text when English was
 * blank) so edit mode keeps the text in one field without auto-expanding the
 * secondary translation input. (Ported from mobile's composer.)
 */
export function splitBilingualPair(
  primary: string | null | undefined,
  arabic: string | null | undefined,
  appLang: "en" | "ar",
): { en: string; ar: string; bothDistinct: boolean } {
  const cleanEn = (primary ?? "").trim();
  const cleanAr = (arabic ?? "").trim();
  if (cleanEn !== "" && cleanAr !== "" && cleanEn === cleanAr) {
    if (appLang === "ar" || ARABIC_SCRIPT_RE.test(cleanAr)) {
      return { en: "", ar: cleanAr, bothDistinct: false };
    }
    return { en: cleanEn, ar: "", bothDistinct: false };
  }
  return {
    en: primary ?? "",
    ar: arabic ?? "",
    bothDistinct: cleanEn !== "" && cleanAr !== "",
  };
}

// ---- Small shared presentational helpers ----------------------------------------

const INPUT_CLS =
  "w-full rounded-md border border-hair bg-white px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-faint";
const LABEL_CLS =
  "block font-body text-[13px] font-bold tracking-wide text-muted";

/** Card section heading (Fraunces title + optional muted subtitle). */
function SectionHeader({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
}) {
  return (
    <div>
      <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
        {title}
        {hint ? (
          <span className="ms-1.5 font-body text-[12px] font-semibold text-faint">
            · {hint}
          </span>
        ) : null}
      </h2>
      {subtitle ? (
        <p className="mt-1 font-body text-[13.5px] leading-relaxed text-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/** Labeled field wrapper: label (+ optional marker) above the input. */
function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL_CLS}>
        {label}
        {optional ? (
          <span className="ms-1 font-semibold text-faint">
            · {t("create.optional")}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

/** A pristine step row (also the fallback when the last row is removed). */
const EMPTY_STEP: ComposerStepDraft = {
  description: "",
  description_ar: "",
  minutes: "",
  literal_minutes: "",
  step_type: "active",
};

// ---- The form -------------------------------------------------------------------

export interface ComposerFormProps {
  mode: "create" | "edit" | "publish";
  initial: ComposerInitialData;
  /** Server-driven category chips (publish mode only section). */
  categories: CategoryCount[];
  /** Import-draft extraction warnings, shown above the form. */
  importWarnings?: string[];
  /** Notice line rendered above the save button (e.g. publish = public). */
  actionNotice?: string;
  /** Performs the API write; the form handles validation, upload + errors. */
  save: (input: ComposerSubmitInput) => Promise<Recipe>;
  /** Called with the saved recipe for the page to navigate. */
  onSaved: (recipe: Recipe) => void;
  /** Optional delete action (edit mode) — behind a confirm dialog. */
  onDelete?: () => Promise<void>;
}

export function ComposerForm({
  mode,
  initial,
  categories,
  importWarnings = [],
  actionNotice,
  save,
  onSaved,
  onDelete,
}: ComposerFormProps) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const isArabicPrimary = lang === "ar";

  // ---- Form state (mirror of mobile's composer) --------------------------------
  const [title, setTitle] = useState(initial.title);
  const [titleAr, setTitleAr] = useState(initial.titleAr);
  const [showTitleTranslation, setShowTitleTranslation] = useState(
    initial.title.trim() !== "" &&
      initial.titleAr.trim() !== "" &&
      initial.title.trim() !== initial.titleAr.trim(),
  );
  const [description, setDescription] = useState(initial.description);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [servings, setServings] = useState(initial.servings);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [prepMinutes, setPrepMinutes] = useState(initial.prepMinutes);
  const [cookMinutes, setCookMinutes] = useState(initial.cookMinutes);
  const [category, setCategory] = useState(initial.category ?? "");
  const [ingredients, setIngredients] = useState<string[]>(
    initial.ingredients.length > 0 ? initial.ingredients : [""],
  );
  const [structuredItems, setStructuredItems] = useState<
    Array<Record<string, unknown>> | null
  >(initial.structuredItems ?? null);
  const [steps, setSteps] = useState<ComposerStepDraft[]>(
    initial.steps.length > 0 ? initial.steps : [EMPTY_STEP],
  );
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>(
    {},
  );
  const [showMoreDetails, setShowMoreDetails] = useState(
    Boolean(
      initial.description.trim() ||
        initial.prepMinutes ||
        initial.cookMinutes ||
        initial.sourceUrl.trim(),
    ),
  );

  // Cover photo: existing uploaded URL vs. a freshly picked File (uploaded
  // on save). `imageRemoved` lets edit/publish clear the existing photo.
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  // ---- Submission / error state --------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const ingredientInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Set right before an intentional exit (save/delete) — unblocks the router. */
  const exitGuard = useRef(false);

  // ---- Image picking --------------------------------------------------------------

  const pickImage = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      // Allow re-picking the same file after remove+re-add.
      event.target.value = "";
      if (file == null) return;
      if (!COVER_TYPES.includes(file.type)) {
        setImageError(t("create.errImageType"));
        return;
      }
      if (file.size > COVER_MAX_BYTES) {
        setImageError(t("create.errImageTooBig", { mb: 4 }));
        return;
      }
      setImageError(null);
      setPickedFile(file);
      setImageRemoved(false);
      if (pickedPreview) URL.revokeObjectURL(pickedPreview);
      setPickedPreview(URL.createObjectURL(file));
    },
    [pickedPreview, t],
  );

  const removeImage = useCallback(() => {
    setPickedFile(null);
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    setPickedPreview(null);
    setImageRemoved(true);
  }, [pickedPreview]);

  // Revoke the preview blob on unmount.
  useEffect(
    () => () => {
      if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    },
    [pickedPreview],
  );

  // ---- Dynamic row helpers (ported) ------------------------------------------------

  /** Ingredient edit; multi-line paste splits into rows (mobile parity). */
  const handleIngredientChange = useCallback((index: number, text: string) => {
    if (text.includes("\n") || text.includes("\r")) {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");
      if (lines.length === 0) {
        setIngredients((rows) =>
          rows.map((row, i) => (i === index ? "" : row)),
        );
        return;
      }
      setIngredients((rows) =>
        [
          ...rows.slice(0, index),
          ...lines,
          ...rows.slice(index + 1),
        ].slice(0, INGREDIENTS_MAX),
      );
      setStructuredItems((current) => {
        if (!current) return current;
        const nextItems = [
          ...current.slice(0, index),
          ...lines.map((line, offset) =>
            offset === 0
              ? { ...(current[index] ?? {}), raw: line }
              : { raw: line },
          ),
          ...current.slice(index + 1),
        ].slice(0, INGREDIENTS_MAX);
        return nextItems;
      });
      return;
    }

    setIngredients((rows) => rows.map((row, i) => (i === index ? text : row)));
    setStructuredItems((current) => {
      if (!current) return current;
      const items = [...current];
      items[index] = { ...(items[index] ?? {}), raw: text };
      return items;
    });
  }, []);

  /** Enter on an ingredient row focuses the next one, adding a row at the end. */
  const handleIngredientKeyDown = useCallback(
    (index: number, key: string) => {
      if (key !== "Enter") return;
      const isLast = index === ingredients.length - 1;
      if (!isLast) {
        ingredientInputRefs.current[index + 1]?.focus();
        return;
      }
      if (
        ingredients[index]?.trim() !== "" &&
        ingredients.length < INGREDIENTS_MAX
      ) {
        setIngredients((rows) => [...rows, ""]);
        setStructuredItems((current) =>
          current ? [...current, { raw: "" }] : current,
        );
        requestAnimationFrame(() => {
          ingredientInputRefs.current[ingredients.length]?.focus();
        });
      }
    },
    [ingredients],
  );

  const removeIngredientAt = useCallback((index: number) => {
    setIngredients((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
    setStructuredItems((current) =>
      current ? current.filter((_, i) => i !== index) : current,
    );
  }, []);

  const updateStepAt = useCallback(
    (index: number, patch: Partial<ComposerStepDraft>) => {
      setSteps((rows) =>
        rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  /** Step minutes edit; the literal "alarm" syncs for passive steps (mobile). */
  const updateStepDuration = useCallback((index: number, raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "");
    setSteps((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const hasDistinctLiteral =
          row.literal_minutes !== "" &&
          row.minutes !== "" &&
          row.literal_minutes !== row.minutes;
        let nextLiteral = row.literal_minutes;
        if (clean === "") {
          nextLiteral = "";
        } else if (!hasDistinctLiteral) {
          nextLiteral = row.step_type === "passive" ? clean : "";
        }
        return {
          ...row,
          minutes: clean,
          literal_minutes: nextLiteral,
        };
      }),
    );
  }, []);

  const updateStepType = useCallback(
    (index: number, nextType: (typeof STEP_TYPES)[number]) => {
      setSteps((rows) =>
        rows.map((row, i) => {
          if (i !== index) return row;
          const wasSynced =
            row.literal_minutes !== "" && row.literal_minutes === row.minutes;
          let nextLiteral = row.literal_minutes;
          if (nextType === "passive") {
            if (row.literal_minutes === "" && row.minutes !== "") {
              nextLiteral = row.minutes;
            }
          } else if (wasSynced) {
            nextLiteral = "";
          }
          return {
            ...row,
            step_type: nextType,
            literal_minutes: nextLiteral,
          };
        }),
      );
    },
    [],
  );

  const removeStepAt = useCallback((index: number) => {
    setSteps((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length > 0
        ? next
        : [
            {
              description: "",
              description_ar: "",
              minutes: "",
              literal_minutes: "",
              step_type: "active",
            },
          ];
    });
    setExpandedSteps((prev) => {
      const next: Record<number, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < index && v) next[idx] = true;
        else if (idx > index && v) next[idx - 1] = true;
      }
      return next;
    });
  }, []);

  // ---- Validation (mirrors the server rules; ported) -------------------------------

  const validate = useCallback((): string | null => {
    if (title.trim().length === 0 && titleAr.trim().length === 0) {
      return t("create.errTitleRequired");
    }
    if (minutes.trim().length === 0) return t("create.errMinutesRequired");
    const mins = parseIntOrNull(minutes);
    if (mins == null || mins < MINUTES_MIN || mins > MINUTES_MAX) {
      return t("create.errMinutesRange");
    }
    const plates = parseIntOrNull(servings);
    if (plates != null && (plates < SERVINGS_MIN || plates > SERVINGS_MAX)) {
      return t("create.errServings");
    }
    for (const timing of [prepMinutes, cookMinutes]) {
      const parsed = parseIntOrNull(timing);
      if (parsed != null && (parsed < 0 || parsed > MINUTES_MAX)) {
        return t("create.errMinutesRange");
      }
    }
    if (description.length > DESCRIPTION_MAX) {
      return t("create.errDescriptionLong");
    }
    if (sourceUrl.trim().length > 255) {
      return t("create.errSourceUrlLong");
    }
    const ing = ingredients.map((row) => row.trim()).filter((row) => row !== "");
    if (ing.length < INGREDIENTS_MIN) return t("create.errIngredients");
    if (ing.length > INGREDIENTS_MAX) return t("create.errIngredientsMax");
    if (ing.some((row) => row.length > INGREDIENT_MAX)) {
      return t("create.errIngredientLong");
    }
    const kept = steps.filter(
      (row) =>
        row.description.trim() !== "" || row.description_ar.trim() !== "",
    );
    if (kept.length < STEPS_MIN) return t("create.errSteps");
    if (kept.length > STEPS_MAX) return t("create.errStepsMax");
    if (
      kept.some(
        (row) =>
          row.description.trim().length > STEP_MAX ||
          row.description_ar.trim().length > STEP_MAX,
      )
    ) {
      return t("create.errStepLong");
    }
    if (
      kept.some((row) => {
        const m = parseIntOrNull(row.minutes);
        const literal = parseIntOrNull(row.literal_minutes);
        return (
          (m != null && (m < 0 || m > MINUTES_MAX)) ||
          (literal != null && (literal < 0 || literal > MINUTES_MAX))
        );
      })
    ) {
      return t("create.errStepMinutes");
    }
    return null;
  }, [
    title,
    titleAr,
    minutes,
    servings,
    prepMinutes,
    cookMinutes,
    description,
    sourceUrl,
    ingredients,
    steps,
    t,
  ]);

  // ---- Dirty tracking + navigation guard ---------------------------------------------

  const baseline = useMemo(
    () =>
      JSON.stringify({
        title: initial.title,
        titleAr: initial.titleAr,
        description: initial.description,
        sourceUrl: initial.sourceUrl,
        servings: initial.servings,
        minutes: initial.minutes,
        prepMinutes: initial.prepMinutes,
        cookMinutes: initial.cookMinutes,
        category: initial.category ?? "",
        ingredients: initial.ingredients,
        steps: initial.steps,
        image: initial.imageUrl,
      }),
    [initial],
  );

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        titleAr,
        description,
        sourceUrl,
        servings,
        minutes,
        prepMinutes,
        cookMinutes,
        category,
        ingredients,
        steps,
        image: pickedFile
          ? `file:${pickedFile.name}:${pickedFile.size}`
          : imageRemoved
            ? "removed"
            : initial.imageUrl,
      }),
    [
      title,
      titleAr,
      description,
      sourceUrl,
      servings,
      minutes,
      prepMinutes,
      cookMinutes,
      category,
      ingredients,
      steps,
      pickedFile,
      imageRemoved,
      initial.imageUrl,
    ],
  );

  const dirty = snapshot !== baseline;

  // Block router navigation while there are unsaved changes (mobile's
  // usePreventRemove). The mirrors are kept in refs via effects and read at
  // decision time, so the intentional exits (save/delete — which flip
  // exitGuard inside their handlers) pass straight through.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const savingRef = useRef(saving);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);
  const blocker = useBlocker(
    () => dirtyRef.current && !savingRef.current && !exitGuard.current,
  );

  // Tab close / reload with unsaved changes.
  useEffect(() => {
    if (!dirty || saving) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving]);

  // ---- Save ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (saving) return;
    setHalalTerms(null);
    const invalid = validate();
    if (invalid != null) {
      setError(invalid);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Cover photo first (POST /api/uploads); a failure keeps the form as-is.
      let imageUrl: string | null | undefined;
      if (pickedFile != null) {
        try {
          imageUrl = await uploadImage(pickedFile);
        } catch {
          setError(t("create.errImageUpload"));
          return;
        }
      } else if (imageRemoved) {
        imageUrl = null;
      }

      const cleanTitle = title.trim();
      const cleanTitleAr = titleAr.trim();

      const stepRows: UserRecipeStepInput[] = steps
        .filter(
          (row) =>
            row.description.trim() !== "" || row.description_ar.trim() !== "",
        )
        .map((row) => {
          const cleanEn = row.description.trim();
          const cleanAr = row.description_ar.trim();
          const estMinutes = parseIntOrNull(row.minutes);
          const litMinutes = parseIntOrNull(row.literal_minutes);
          return {
            description: cleanEn !== "" ? cleanEn : cleanAr,
            ...(cleanAr !== "" ? { description_ar: cleanAr } : {}),
            ...(estMinutes != null ? { minutes_estimated: estMinutes } : {}),
            ...(litMinutes != null ? { literal_minutes: litMinutes } : {}),
            step_type: row.step_type,
          };
        });

      const publishMode = mode === "publish";
      const input: ComposerSubmitInput = {
        title: cleanTitle !== "" ? cleanTitle : cleanTitleAr,
        ...(cleanTitleAr !== ""
          ? { title_ar: cleanTitleAr }
          : mode === "edit"
            ? // PATCH semantics: an empty AR title must CLEAR the stored one.
              { title_ar: null as unknown as string }
            : {}),
        ...(description.trim() !== ""
          ? { description: description.trim() }
          : {}),
        ...(sourceUrl.trim() !== "" ? { source_url: sourceUrl.trim() } : {}),
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        ...(parseIntOrNull(servings) != null
          ? { servings: parseIntOrNull(servings) ?? undefined }
          : {}),
        ...(parseIntOrNull(prepMinutes) != null
          ? { prep_time_minutes: parseIntOrNull(prepMinutes) ?? undefined }
          : {}),
        ...(parseIntOrNull(cookMinutes) != null
          ? { cook_time_minutes: parseIntOrNull(cookMinutes) ?? undefined }
          : {}),
        estimated_minutes: parseIntOrNull(minutes) ?? MINUTES_MIN,
        ingredients: ingredients
          .map((row) => row.trim())
          .filter((row) => row !== ""),
        // Import-draft extras: ride the structured rows + derived AR lines
        // along so the published recipe keeps the extraction's structure.
        ...(publishMode && structuredItems
          ? (() => {
              const rows = ingredients
                .map((row, index) => {
                  const item = structuredItems[index] ?? {};
                  const ar =
                    typeof item.raw_ar === "string" && item.raw_ar.trim() !== ""
                      ? item.raw_ar.trim()
                      : typeof item.item_ar === "string" &&
                          item.item_ar.trim() !== ""
                        ? item.item_ar.trim()
                        : "";
                  return { en: row.trim(), ar };
                })
                .filter((row) => row.en !== "");
              return rows.length > 0 && rows.every((row) => row.ar !== "")
                ? { ingredients_ar: rows.map((row) => row.ar) }
                : {};
            })()
          : {}),
        ...(publishMode && structuredItems
          ? {
              ingredients_structured: {
                v: 1,
                items: ingredients
                  .map((row, index) => ({
                    ...(structuredItems[index] ?? {}),
                    raw: row.trim(),
                  }))
                  .filter((item) => item.raw !== ""),
              },
            }
          : {}),
        ...(publishMode && category.trim() !== ""
          ? { category: category.trim() }
          : {}),
        steps: stepRows,
      };

      const saved = await save(input);
      exitGuard.current = true;
      onSaved(saved);
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
        setError(
          t("create.halalBlocked", { terms: err.terms.join(", ") }),
        );
      } else if (isRateLimitedError(err)) {
        setError(t("common.rateLimited"));
      } else if (
        ((err as { response?: { status?: number } })?.response?.status ??
          0) === 403
      ) {
        // Editing a row the account doesn't own (the server enforces it).
        setError(t("create.errNotOwner"));
      } else {
        setError(t("create.errGeneric"));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validate,
    pickedFile,
    imageRemoved,
    title,
    titleAr,
    description,
    sourceUrl,
    servings,
    minutes,
    prepMinutes,
    cookMinutes,
    ingredients,
    structuredItems,
    category,
    steps,
    mode,
    save,
    onSaved,
    t,
  ]);

  // ---- Delete (edit mode) ---------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (onDelete == null || deleting) return;
    setDeleting(true);
    // Intentional exit: the parent navigates away inside onDelete, so the
    // unsaved-changes blocker must already be disarmed (re-armed on failure).
    exitGuard.current = true;
    try {
      await onDelete();
    } catch {
      exitGuard.current = false;
      setShowDelete(false);
      toast.error(t("create.errDelete"));
    } finally {
      setDeleting(false);
    }
  }, [onDelete, deleting, toast, t]);

  // ---- Derived render values -------------------------------------------------------------

  const servingsNum = parseIntOrNull(servings);
  const canDecrementServings =
    servingsNum != null && servingsNum > SERVINGS_MIN;
  const canIncrementServings = servingsNum == null || servingsNum < SERVINGS_MAX;

  const primaryTitleValue = isArabicPrimary ? titleAr : title;
  const setPrimaryTitleValue = isArabicPrimary ? setTitleAr : setTitle;
  const secondaryTitleValue = isArabicPrimary ? title : titleAr;
  const setSecondaryTitleValue = isArabicPrimary ? setTitle : setTitleAr;

  const coverSrc = pickedPreview ?? (imageRemoved ? null : initial.imageUrl);
  const saveLabel = saving
    ? t("create.saving")
    : mode === "publish"
      ? t("create.publish")
      : mode === "edit"
        ? t("create.saveChanges")
        : t("create.save");

  const stepTypeChips = (row: ComposerStepDraft, index: number) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEP_TYPES.map((type) => (
        <Chip
          key={type}
          label={t(`create.stepType.${type}`)}
          active={row.step_type === type}
          onClick={() => updateStepType(index, type)}
          className="py-1 text-[12px]"
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {importWarnings.length > 0 ? (
        <div className="rounded-md border-s-4 border-orange-deep bg-orange-soft px-4 py-3">
          <p className="font-body text-[13.5px] font-bold text-ink">
            {t("import.reviewWarnings")}
          </p>
          {importWarnings.map((warning) => (
            <p
              key={warning}
              className="mt-1 font-body text-[13.5px] leading-relaxed text-muted"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {error != null && halalTerms == null ? (
        <div
          role="alert"
          className="rounded-md bg-dark-2 px-4 py-3 font-body text-[14px] font-semibold text-white"
        >
          {error}
        </div>
      ) : null}

      {halalTerms != null ? (
        <div
          role="alert"
          className="rounded-md border-s-4 border-orange-deep bg-dark-2 px-4 py-3"
        >
          <p className="font-body text-[13.5px] font-bold text-white">
            {t("create.halalTitle")}
          </p>
          <p className="mt-1 font-body text-[15px] font-bold text-white">
            {halalTerms.join(", ")}
          </p>
        </div>
      ) : null}

      {/* 1. Cover photo */}
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeader title={t("create.photo")} />
        {coverSrc ? (
          <>
            <div className="overflow-hidden rounded-md border border-hair">
              <img
                src={coverSrc}
                alt=""
                className="h-44 w-full object-cover sm:h-56"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                className="px-5 py-2.5 text-[14px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving || deleting}
              >
                {t("create.changePhoto")}
              </Button>
              <Button
                variant="ghost"
                className="px-5 py-2.5 text-[14px] text-muted"
                onClick={removeImage}
                disabled={saving || deleting}
              >
                {t("create.removeImage")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || deleting}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-faint/60 bg-cream-deep transition-colors hover:border-orange hover:text-orange-deep"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-8 w-8 text-faint"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m5 17 4.5-4.5 3 3L16 12l3 3" />
              </svg>
              <span className="font-body text-[13.5px] font-semibold text-muted">
                {t("create.addPhotoHint")}
              </span>
              <span className="font-body text-[12px] text-faint">
                {t("create.imageHint")}
              </span>
            </button>
          </>
        )}
        {imageError ? (
          <p className="font-body text-[13px] font-semibold text-orange-deep">
            {imageError}
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={COVER_TYPES.join(",")}
          className="hidden"
          onChange={pickImage}
        />
      </Card>

      {/* 2. Title (single-first, translation on demand) */}
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeader
          title={t("create.basics")}
          subtitle={t("create.basicsHint")}
        />
        <Field
          label={
            showTitleTranslation
              ? isArabicPrimary
                ? t("create.titleAr")
                : t("create.titleEn")
              : t("create.titleLabel")
          }
        >
          <input
            type="text"
            dir="auto"
            value={primaryTitleValue}
            onChange={(e) => setPrimaryTitleValue(e.target.value)}
            placeholder={t("create.titlePlaceholder")}
            maxLength={TITLE_MAX}
            disabled={saving || deleting}
            className={INPUT_CLS}
          />
        </Field>
        <button
          type="button"
          onClick={() => setShowTitleTranslation((v) => !v)}
          className="self-start"
        >
          <Chip
            label={
              showTitleTranslation
                ? t("create.hideTranslation")
                : t("create.addTranslation")
            }
            active={showTitleTranslation}
          />
        </button>
        {showTitleTranslation ? (
          <Field
            label={
              isArabicPrimary ? t("create.titleEn") : t("create.titleAr")
            }
            optional
          >
            <input
              type="text"
              dir="auto"
              value={secondaryTitleValue}
              onChange={(e) => setSecondaryTitleValue(e.target.value)}
              placeholder={t("create.titleArPlaceholder")}
              maxLength={TITLE_MAX}
              disabled={saving || deleting}
              className={INPUT_CLS}
            />
          </Field>
        ) : null}
      </Card>

      {/* 3. Servings stepper & total time presets */}
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeader title={t("create.timing")} />
        <Field label={t("create.servings")} optional>
          <div className="flex items-center justify-between rounded-md border border-hair bg-white px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                if (servingsNum != null && servingsNum > SERVINGS_MIN) {
                  setServings(String(servingsNum - 1));
                }
              }}
              disabled={!canDecrementServings || saving || deleting}
              aria-label={t("create.servingsMinusA11y")}
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-hair bg-cream-deep text-ink transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={servings}
              onChange={(e) => setServings(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="—"
              maxLength={2}
              disabled={saving || deleting}
              aria-label={t("create.servings")}
              className="w-16 bg-transparent text-center font-display text-xl font-semibold text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const next = Math.min(
                  SERVINGS_MAX,
                  Math.max(SERVINGS_MIN, (servingsNum ?? 0) + 1),
                );
                setServings(String(next));
              }}
              disabled={!canIncrementServings || saving || deleting}
              aria-label={t("create.servingsPlusA11y")}
              className="flex h-9 w-9 items-center justify-center rounded-pill border border-hair bg-cream-deep text-ink transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </Field>
        <Field label={t("create.minutes")}>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {TOTAL_TIME_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  label={`${preset}${t("common.min")}`}
                  active={parseIntOrNull(minutes) === preset}
                  onClick={() => setMinutes(String(preset))}
                />
              ))}
            </div>
            <div className="flex items-center rounded-md border border-hair bg-white px-4">
              <input
                type="text"
                inputMode="numeric"
                value={minutes}
                onChange={(e) =>
                  setMinutes(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="30"
                maxLength={4}
                disabled={saving || deleting}
                aria-label={t("create.minutes")}
                className="w-full bg-transparent py-2.5 font-body text-[15px] text-ink focus:outline-none"
              />
              <span className="ms-2 font-body text-[13px] font-bold text-muted">
                {t("create.unitMin")}
              </span>
            </div>
          </div>
        </Field>
      </Card>

      {/* 4. Collapsible more details */}
      <Card className="flex flex-col gap-4 p-5">
        <button
          type="button"
          onClick={() => setShowMoreDetails((v) => !v)}
          className="flex items-center justify-between gap-3"
        >
          <span className="font-display text-[19px] font-semibold leading-snug text-ink">
            {t("create.moreDetails")}
            <span className="ms-1.5 font-body text-[12px] font-semibold text-faint">
              · {t("create.optional")}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              "h-5 w-5 shrink-0 text-muted transition-transform",
              showMoreDetails && "rotate-180",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {showMoreDetails ? (
          <div className="flex flex-col gap-4">
            <Field label={t("create.description")} optional>
              <textarea
                dir="auto"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("create.descriptionPlaceholder")}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                disabled={saving || deleting}
                className={cn(INPUT_CLS, "min-h-24 resize-y")}
              />
            </Field>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Field label={t("create.prepMinutes")} optional>
                  <div className="flex items-center rounded-md border border-hair bg-white px-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={prepMinutes}
                      onChange={(e) =>
                        setPrepMinutes(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="10"
                      maxLength={4}
                      disabled={saving || deleting}
                      aria-label={t("create.prepMinutes")}
                      className="w-full bg-transparent py-2.5 font-body text-[15px] text-ink focus:outline-none"
                    />
                    <span className="ms-2 font-body text-[13px] font-bold text-muted">
                      {t("create.unitMin")}
                    </span>
                  </div>
                </Field>
              </div>
              <div className="flex-1">
                <Field label={t("create.cookMinutes")} optional>
                  <div className="flex items-center rounded-md border border-hair bg-white px-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cookMinutes}
                      onChange={(e) =>
                        setCookMinutes(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="20"
                      maxLength={4}
                      disabled={saving || deleting}
                      aria-label={t("create.cookMinutes")}
                      className="w-full bg-transparent py-2.5 font-body text-[15px] text-ink focus:outline-none"
                    />
                    <span className="ms-2 font-body text-[13px] font-bold text-muted">
                      {t("create.unitMin")}
                    </span>
                  </div>
                </Field>
              </div>
            </div>
            <Field label={t("create.sourceUrl")} optional>
              <input
                type="url"
                dir="ltr"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={t("create.sourceUrlPlaceholder")}
                disabled={saving || deleting}
                className={INPUT_CLS}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      {/* 5. Category chips (publish mode — the create/edit endpoints don't
          accept a category, so the picker would be a no-op there). */}
      {mode === "publish" && categories.length > 0 ? (
        <Card className="flex flex-col gap-4 p-5">
          <SectionHeader
            title={t("create.category")}
            hint={t("create.optional")}
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((row) => (
              <Chip
                key={row.category}
                label={row.category}
                active={category === row.category}
                onClick={() =>
                  setCategory((current) =>
                    current === row.category ? "" : row.category,
                  )
                }
              />
            ))}
          </div>
        </Card>
      ) : null}

      {/* 6. Ingredients (numbered rows; Enter adds; paste splits) */}
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeader
          title={t("create.ingredients")}
          subtitle={t("create.ingredientsHint")}
        />
        <ul className="flex flex-col gap-2.5">
          {ingredients.map((row, index) => (
            <li key={`ing-${index}`} className="flex items-center gap-2.5">
              <span className="w-6 shrink-0 text-center font-body text-[13px] font-bold text-faint">
                {index + 1}
              </span>
              <input
                type="text"
                dir="auto"
                ref={(el) => {
                  ingredientInputRefs.current[index] = el;
                }}
                value={row}
                onChange={(e) => handleIngredientChange(index, e.target.value)}
                onKeyDown={(e) => handleIngredientKeyDown(index, e.key)}
                placeholder={t("create.ingredientPlaceholder")}
                maxLength={INGREDIENT_MAX}
                disabled={saving || deleting}
                aria-label={t("create.ingredientA11y", { n: index + 1 })}
                className={INPUT_CLS}
              />
              <button
                type="button"
                onClick={() => removeIngredientAt(index)}
                disabled={ingredients.length === 1 || saving || deleting}
                aria-label={t("create.removeRow")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-hair bg-cream-deep text-muted transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-40"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        {ingredients.length < INGREDIENTS_MAX ? (
          <Button
            variant="ghost"
            className="self-start px-5 py-2.5 text-[14px]"
            onClick={() => {
              setIngredients((rows) => [...rows, ""]);
              setStructuredItems((current) =>
                current ? [...current, { raw: "" }] : current,
              );
              requestAnimationFrame(() => {
                ingredientInputRefs.current[ingredients.length]?.focus();
              });
            }}
            disabled={saving || deleting}
          >
            {t("create.addIngredient")}
          </Button>
        ) : null}
      </Card>

      {/* 7. Steps (type chips, translation toggle, minutes presets) */}
      <Card className="flex flex-col gap-4 p-5">
        <SectionHeader
          title={t("create.steps")}
          subtitle={t("create.stepsHint")}
        />
        <ul className="flex flex-col gap-3">
          {steps.map((row, index) => {
            const primaryStepValue = isArabicPrimary
              ? row.description_ar
              : row.description;
            const secondaryStepValue = isArabicPrimary
              ? row.description
              : row.description_ar;
            const stepDurationValue =
              row.minutes !== "" ? row.minutes : row.literal_minutes;
            const translationOpen = Boolean(expandedSteps[index]);
            return (
              <li
                key={`step-${index}`}
                className="flex flex-col gap-3 rounded-md border border-hair bg-cream/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-[13px] font-extrabold text-orange-deep">
                    #{index + 1}
                  </span>
                  {stepTypeChips(row, index)}
                  <button
                    type="button"
                    onClick={() => removeStepAt(index)}
                    disabled={steps.length === 1 || saving || deleting}
                    aria-label={t("create.removeRow")}
                    className="ms-auto flex h-9 w-9 items-center justify-center rounded-pill border border-hair bg-white text-muted transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-40"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <textarea
                  dir="auto"
                  value={primaryStepValue}
                  onChange={(e) =>
                    updateStepAt(
                      index,
                      isArabicPrimary
                        ? { description_ar: e.target.value }
                        : { description: e.target.value },
                    )
                  }
                  placeholder={t("create.stepDescriptionPlaceholder")}
                  maxLength={STEP_MAX}
                  rows={2}
                  disabled={saving || deleting}
                  aria-label={t("create.stepA11y", { n: index + 1 })}
                  className={cn(INPUT_CLS, "min-h-16 resize-y")}
                />

                <button
                  type="button"
                  onClick={() =>
                    setExpandedSteps((prev) => ({
                      ...prev,
                      [index]: !prev[index],
                    }))
                  }
                  className="self-start"
                >
                  <Chip
                    label={
                      translationOpen
                        ? t("create.hideTranslation")
                        : t("create.addTranslation")
                    }
                    active={translationOpen}
                    className="py-1 text-[12px]"
                  />
                </button>

                {translationOpen ? (
                  <textarea
                    dir="auto"
                    value={secondaryStepValue}
                    onChange={(e) =>
                      updateStepAt(
                        index,
                        isArabicPrimary
                          ? { description: e.target.value }
                          : { description_ar: e.target.value },
                      )
                    }
                    placeholder={t("create.stepArPlaceholder")}
                    maxLength={STEP_MAX}
                    rows={2}
                    disabled={saving || deleting}
                    className={cn(INPUT_CLS, "min-h-16 resize-y")}
                  />
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4 text-muted"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                    {STEP_TIME_PRESETS.map((preset) => (
                      <Chip
                        key={preset}
                        label={`${preset}${t("common.min")}`}
                        active={parseIntOrNull(stepDurationValue) === preset}
                        onClick={() =>
                          updateStepDuration(
                            index,
                            parseIntOrNull(stepDurationValue) === preset
                              ? ""
                              : String(preset),
                          )
                        }
                        className="py-1 text-[12px]"
                      />
                    ))}
                  </div>
                  <div className="flex w-28 items-center rounded-md border border-hair bg-white px-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={stepDurationValue}
                      onChange={(e) => updateStepDuration(index, e.target.value)}
                      placeholder="0"
                      maxLength={4}
                      disabled={saving || deleting}
                      aria-label={t("create.stepMinutesA11y", {
                        n: index + 1,
                      })}
                      className="w-full bg-transparent py-2 font-body text-[14px] text-ink focus:outline-none"
                    />
                    <span className="ms-1 font-body text-[12px] font-bold text-muted">
                      {t("create.unitMin")}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {steps.length < STEPS_MAX ? (
          <Button
            variant="ghost"
            className="self-start px-5 py-2.5 text-[14px]"
            onClick={() =>
              setSteps((rows) => [
                ...rows,
                {
                  description: "",
                  description_ar: "",
                  minutes: "",
                  literal_minutes: "",
                  step_type: "active",
                },
              ])
            }
            disabled={saving || deleting}
          >
            {t("create.addStep")}
          </Button>
        ) : null}
      </Card>

      {/* 8. Footer: notice + save + (edit) delete */}
      <div className="flex flex-col gap-3">
        {actionNotice ? (
          <p className="font-body text-[13.5px] leading-relaxed text-muted">
            {actionNotice}
          </p>
        ) : null}
        <Button
          onClick={() => void handleSave()}
          loading={saving}
          disabled={deleting}
          className="w-full py-4 text-[16px] sm:w-auto sm:self-start sm:px-10"
        >
          {saveLabel}
        </Button>
        {onDelete != null ? (
          <Button
            variant="ghost"
            onClick={() => setShowDelete(true)}
            disabled={saving || deleting}
            className="self-start px-5 py-2.5 text-[14px] text-muted"
          >
            {t("create.deleteRecipe")}
          </Button>
        ) : null}
      </div>

      {/* Discard-changes guard (router navigation while dirty). The dialog's
          open state IS the blocker state — no mirror needed. */}
      <CreateConfirmDialog
        open={blocker.state === "blocked"}
        title={t("create.discardTitle")}
        body={t("create.discardMessage")}
        confirmLabel={t("create.discardBtn")}
        cancelLabel={t("create.keepEditing")}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />

      {/* Delete confirmation (edit mode). */}
      <CreateConfirmDialog
        open={showDelete}
        title={t("create.deleteConfirmTitle")}
        body={t("create.deleteConfirmMessage")}
        confirmLabel={t("create.deleteConfirmBtn")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
