import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";

import {
  createUserRecipe,
  deleteUserRecipe,
  getRecipe,
  getRecipeImport,
  HalalRejectionError,
  hasToken,
  publishRecipeImport,
  updateUserRecipe,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { UserRecipeInput, UserRecipeStepInput } from "@/types";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { useLang, useT } from "@/i18n";
import {
  Button,
  Card,
  Chip,
  IconPressable,
  SectionHeader,
} from "@/components/ui";

// ---- Server-mirrored validation limits ----------------------------------------
// Mirrors the Laravel rules for POST/PATCH /api/recipes so bad input is caught
// client-side before the request ever leaves.
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

/** One dynamic step row (minutes kept as raw text until save). */
interface StepDraft {
  description: string;
  description_ar: string;
  minutes: string;
  literal_minutes: string;
  step_type: (typeof STEP_TYPES)[number];
}

/** Digits-only parse; empty (optional) fields parse to null. */
function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Deduplicate single-language fallback values persisted on the server (where
 * NOT NULL `title`/`description` stores the Arabic text when English was left
 * blank) so edit mode keeps the text in one field without auto-expanding the
 * secondary translation input.
 */
function splitBilingualPair(
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

/** The comparable shape of the whole composer form (for dirty tracking). */
interface FormShape {
  title: string;
  titleAr: string;
  description: string;
  sourceUrl: string;
  servings: string;
  minutes: string;
  prepMinutes: string;
  cookMinutes: string;
  ingredients: string[];
  steps: StepDraft[];
  pickedUri: string | null;
  imageRemoved: boolean;
}

function serializeForm(f: FormShape): string {
  return JSON.stringify(f);
}

/** Pristine create-mode form — the initial baseline snapshot. */
const EMPTY_FORM: FormShape = {
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
  pickedUri: null,
  imageRemoved: false,
};

export default function RecipeComposerScreen() {
  const { id, importId: importIdParam } = useLocalSearchParams<{
    id?: string;
    importId?: string;
  }>();
  const editId = id != null && /^\d+$/.test(id) ? Number(id) : null;
  const importId =
    importIdParam != null && /^\d+$/.test(importIdParam)
      ? Number(importIdParam)
      : null;
  const editMode = editId != null;
  const importMode = !editMode && importId != null;

  const colors = useThemeColors();
  const t = useT();
  const { lang } = useLang();

  // ---- Form state -------------------------------------------------------------
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [servings, setServings] = useState("");
  const [minutes, setMinutes] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [structuredIngredients, setStructuredIngredients] =
    useState<UserRecipeInput["ingredients_structured"]>();
  const [steps, setSteps] = useState<StepDraft[]>([
    {
      description: "",
      description_ar: "",
      minutes: "",
      literal_minutes: "",
      step_type: "active",
    },
  ]);

  // Progressive disclosure toggles (UI-only, excluded from dirty-tracking).
  const [showTitleTranslation, setShowTitleTranslation] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [expandedStepTranslations, setExpandedStepTranslations] = useState<
    Record<number, boolean>
  >({});

  // Image: the previously uploaded URL (edit mode) vs. a freshly picked local
  // uri (uploaded on save). `imageRemoved` lets an edit clear the old photo.
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  // ---- Load state (edit-mode prefill) / submission state ----------------------
  const [loading, setLoading] = useState(editMode || importMode);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string>(() =>
    serializeForm(EMPTY_FORM),
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savePillPressed, setSavePillPressed] = useState(false);
  /** Inline error (validation or submit failure). */
  const [error, setError] = useState<string | null>(null);
  /** Terms from a HalalRejectionError — rendered as a prominent danger card. */
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const scrollRef = useRef<KeyboardAwareScrollViewRef | null>(null);
  const ingredientInputRefs = useRef<Array<TextInput | null>>([]);

  // ---- Auth gate --------------------------------------------------------------
  const [authed, setAuthed] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) setAuthed(ok);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        headerTitle: {
          ...Type.title,
          color: colors.ink,
          flex: 1,
          textAlign: "center",
        },
        headerSavePill: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
          height: 34,
          paddingHorizontal: Space.md,
          marginEnd: Space.sm,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        headerSavePillPressed: {
          opacity: 0.75,
        },
        headerSavePillDisabled: {
          opacity: 0.6,
        },
        headerSaveText: {
          ...Type.bodySm,
          color: "#FFFFFF",
          fontWeight: "700",
        },
        scrollContent: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.md,
          paddingBottom: Space.mega,
          gap: Space.lg,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        },
        section: {
          gap: Space.sm,
        },
        fieldLabel: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        fieldOptional: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "500",
        },
        input: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
          textAlign: "auto",
        },
        inputMultiline: {
          minHeight: 88,
          textAlignVertical: "top",
        },
        twoCol: {
          flexDirection: "row",
          gap: Space.sm,
        },
        twoColCell: {
          flex: 1,
          gap: Space.xs,
        },
        translationToggle: {
          alignSelf: "flex-start",
        },
        // ---- Cover photo card ----
        coverPreviewWrap: {
          height: 190,
          borderRadius: Radius.md,
          overflow: "hidden",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        coverEmptyBox: {
          height: 132,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.hairlineStrong,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
        },
        coverEmptyText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        thumb: {
          width: "100%",
          height: "100%",
        },
        imageActions: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.sm,
        },
        imageActionFlex: {
          flex: 1,
        },
        // ---- Servings stepper & Total time ----
        stepperRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.xs,
          paddingHorizontal: Space.sm,
        },
        stepperBtn: {
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        stepperBtnDisabled: {
          opacity: 0.4,
        },
        stepperInput: {
          ...Type.title,
          color: colors.ink,
          minWidth: 56,
          paddingVertical: Space.xs,
          textAlign: "center",
        },
        presetRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
        },
        unitInputBox: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
        },
        unitTextInput: {
          ...Type.body,
          color: colors.ink,
          flex: 1,
          paddingVertical: Space.md,
        },
        unitSuffix: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontWeight: "600",
          marginStart: Space.xs,
        },
        // ---- Collapsible More details ----
        collapseHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.sm,
        },
        collapseTitle: {
          ...Type.title,
          color: colors.ink,
          flex: 1,
        },
        collapseBody: {
          gap: Space.md,
          paddingTop: Space.xs,
        },
        // ---- Dynamic rows (ingredients / steps) ----
        rowList: {
          gap: Space.sm,
        },
        rowLine: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        rowIndex: {
          width: 24,
          ...Type.bodySm,
          color: colors.inkFaint,
          fontWeight: "700",
          textAlign: "center",
        },
        rowInputWrap: {
          flex: 1,
        },
        removeBtn: {
          width: 34,
          height: 34,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        stepCard: {
          gap: Space.sm,
        },
        stepHeadRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        stepNumber: {
          ...Type.bodySm,
          color: colors.accent,
          fontWeight: "700",
        },
        stepHeadChipsWrap: {
          flex: 1,
        },
        typeChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
        },
        stepDurationRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: Space.sm,
        },
        stepDurationPills: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.xs,
        },
        stepDurationInputBox: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingHorizontal: Space.sm,
          minWidth: 96,
        },
        stepDurationInput: {
          ...Type.bodySm,
          color: colors.ink,
          paddingVertical: Space.xs + 2,
          minWidth: 40,
          textAlign: "center",
        },
        addRow: {
          alignSelf: "flex-start",
        },
        // ---- Errors / footer ----
        errorBanner: {
          backgroundColor: colors.dangerSoft,
          borderRadius: Radius.md,
          padding: Space.md,
          borderStartWidth: 4,
          borderStartColor: colors.danger,
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
          fontWeight: "600",
        },
        halalCard: {
          backgroundColor: colors.dangerSoft,
          borderRadius: Radius.md,
          padding: Space.md,
          gap: Space.xs,
          borderStartWidth: 4,
          borderStartColor: colors.danger,
        },
        halalTitle: {
          ...Type.bodySm,
          color: colors.danger,
          fontWeight: "700",
        },
        halalTerms: {
          ...Type.body,
          color: colors.danger,
          fontWeight: "700",
        },
        importCard: {
          backgroundColor: colors.amberSoft,
          borderRadius: Radius.md,
          padding: Space.md,
          gap: Space.xs,
          borderStartWidth: 4,
          borderStartColor: colors.amber,
        },
        importTitle: {
          ...Type.bodySm,
          color: colors.ink,
          fontWeight: "700",
        },
        importWarning: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        footer: {
          gap: Space.sm,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          padding: Space.xxl,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
      }),
    [colors],
  );

  // ---- Edit-mode prefill (retryable) ------------------------------------------

  const prefill = useCallback(async () => {
    if (editId == null && importId == null) {
      setLoading(false);
      return;
    }

    try {
      if (importId != null) {
        const imported = await getRecipeImport(importId);
        if (imported.status !== "ready" || !imported.draft) {
          throw new Error("The recipe import is not ready.");
        }

        const draft = imported.draft;
        const titlePair = splitBilingualPair(draft.title, draft.title_ar, lang);
        const draftIngredients = Array.isArray(draft.ingredients)
          ? draft.ingredients
          : [];
        const ingRows = draftIngredients
          .map((ingredient) => ingredient?.raw?.trim())
          .filter((row): row is string => Boolean(row));
        const safeIngredients = ingRows.length > 0 ? ingRows : [""];
        const draftSteps = Array.isArray(draft.steps) ? draft.steps : [];
        const expandedSteps: Record<number, boolean> = {};
        const stepRows: StepDraft[] =
          draftSteps.length > 0
            ? draftSteps.map((step, index) => {
                const stepPair = splitBilingualPair(
                  step.description,
                  step.description_ar,
                  lang,
                );
                if (stepPair.bothDistinct) expandedSteps[index] = true;
                return {
                  description: stepPair.en,
                  description_ar: stepPair.ar,
                  minutes:
                    step.minutes_estimated != null
                      ? String(Math.round(step.minutes_estimated))
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
              })
            : [
                {
                  description: "",
                  description_ar: "",
                  minutes: "",
                  literal_minutes: "",
                  step_type: "active",
                },
              ];
        const safeSourceUrl =
          imported.source_url ?? draft.attribution?.source_url ?? "";
        const draftDesc = draft.description ?? "";
        const servingsStr =
          draft.servings != null ? String(Math.round(draft.servings)) : "";
        const minutesStr =
          draft.total_time_minutes != null
            ? String(Math.round(draft.total_time_minutes))
            : "";
        const prepStr =
          draft.prep_time_minutes != null
            ? String(Math.round(draft.prep_time_minutes))
            : "";
        const cookStr =
          draft.cook_time_minutes != null
            ? String(Math.round(draft.cook_time_minutes))
            : "";

        setTitle(titlePair.en);
        setTitleAr(titlePair.ar);
        setShowTitleTranslation(titlePair.bothDistinct);
        setDescription(draftDesc);
        setSourceUrl(safeSourceUrl);
        setServings(servingsStr);
        setMinutes(minutesStr);
        setPrepMinutes(prepStr);
        setCookMinutes(cookStr);
        setShowMoreDetails(
          Boolean(
            draftDesc.trim() ||
              prepStr ||
              cookStr ||
              safeSourceUrl.trim(),
          ),
        );
        setIngredients(safeIngredients);
        setStructuredIngredients({
          v: 1,
          items: draftIngredients.map((ingredient) => ({ ...ingredient })),
        });
        setSteps(stepRows);
        setExpandedStepTranslations(expandedSteps);
        setExistingImage(draft.cover_image_url ?? null);
        setImportWarnings(imported.warnings);
        setBaselineSnapshot(
          serializeForm({
            title: titlePair.en,
            titleAr: titlePair.ar,
            description: draftDesc,
            sourceUrl: safeSourceUrl,
            servings: servingsStr,
            minutes: minutesStr,
            prepMinutes: prepStr,
            cookMinutes: cookStr,
            ingredients: safeIngredients,
            steps: stepRows,
            pickedUri: null,
            imageRemoved: false,
          }),
        );
        return;
      }

      const recipe = await getRecipe(editId as number);
      const titlePair = splitBilingualPair(recipe.title, recipe.title_ar, lang);
      const recipeDesc = recipe.description ?? "";
      const recipeSourceUrl = recipe.source_url ?? "";
      const servingsStr = recipe.servings != null ? String(recipe.servings) : "";
      const prepStr =
        recipe.prep_time_minutes != null
          ? String(recipe.prep_time_minutes)
          : "";
      const cookStr =
        recipe.cook_time_minutes != null
          ? String(recipe.cook_time_minutes)
          : "";

      setTitle(titlePair.en);
      setTitleAr(titlePair.ar);
      setShowTitleTranslation(titlePair.bothDistinct);
      setDescription(recipeDesc);
      setSourceUrl(recipeSourceUrl);
      setExistingImage(recipe.image_url ?? null);
      setServings(servingsStr);
      setPrepMinutes(prepStr);
      setCookMinutes(cookStr);
      setShowMoreDetails(
        Boolean(
          recipeDesc.trim() || prepStr || cookStr || recipeSourceUrl.trim(),
        ),
      );
      setImportWarnings([]);
      if (recipe.ingredients_structured?.items) {
        setStructuredIngredients({
          v: 1,
          items: recipe.ingredients_structured.items,
        });
      } else {
        setStructuredIngredients(undefined);
      }
      const mins =
        recipe.publisher_time_minutes ?? recipe.community_avg_minutes;
      const minutesStr = mins != null ? String(Math.round(mins)) : "";
      setMinutes(minutesStr);
      const ing = (recipe.ingredients ?? []).filter(
        (row): row is string => typeof row === "string",
      );
      const ingRows = ing.length > 0 ? ing : [""];
      setIngredients(ingRows);
      const structured = recipe.recipe_steps ?? [];
      const expandedSteps: Record<number, boolean> = {};
      let stepRows: StepDraft[];
      if (structured.length > 0) {
        stepRows = structured.map((s, index) => {
          const stepPair = splitBilingualPair(
            s.description,
            s.description_ar,
            lang,
          );
          if (stepPair.bothDistinct) expandedSteps[index] = true;
          return {
            description: stepPair.en,
            description_ar: stepPair.ar,
            minutes:
              s.publisher_minutes != null || s.ai_minutes != null
                ? String(Math.round(s.publisher_minutes ?? s.ai_minutes ?? 0))
                : "",
            literal_minutes:
              s.literal_minutes != null
                ? String(Math.round(s.literal_minutes))
                : "",
            step_type:
              s.step_type === "passive" || s.step_type === "cleanup"
                ? s.step_type
                : "active",
          };
        });
      } else {
        const plain = (recipe.steps ?? []).filter(
          (row): row is string => typeof row === "string",
        );
        stepRows =
          plain.length > 0
            ? plain.map((stepText) => ({
                description: stepText,
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
      setSteps(stepRows);
      setExpandedStepTranslations(expandedSteps);
      setBaselineSnapshot(
        serializeForm({
          title: titlePair.en,
          titleAr: titlePair.ar,
          description: recipeDesc,
          sourceUrl: recipeSourceUrl,
          servings: servingsStr,
          minutes: minutesStr,
          prepMinutes: prepStr,
          cookMinutes: cookStr,
          ingredients: ingRows,
          steps: stepRows,
          pickedUri: null,
          imageRemoved: false,
        }),
      );
    } catch (err) {
      console.warn("[RecipeReal] composer prefill failed:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [editId, importId, lang]);

  /** Retry entry point: own the spinner/error reset, then re-fetch. */
  const retryPrefill = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    void prefill();
  }, [prefill]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void prefill();
  }, [prefill]);

  // ---- Dynamic row helpers ----------------------------------------------------

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
      setIngredients((rows) => {
        const next = [
          ...rows.slice(0, index),
          ...lines,
          ...rows.slice(index + 1),
        ].slice(0, INGREDIENTS_MAX);
        return next.length > 0 ? next : [""];
      });
      setStructuredIngredients((current) => {
        if (!current) return current;
        const nextItems = [
          ...current.items.slice(0, index),
          ...lines.map((line, offset) =>
            offset === 0
              ? { ...(current.items[index] ?? {}), raw: line }
              : { raw: line },
          ),
          ...current.items.slice(index + 1),
        ].slice(0, INGREDIENTS_MAX);
        return { ...current, items: nextItems };
      });
      const focusIndex = Math.min(
        index + lines.length - 1,
        INGREDIENTS_MAX - 1,
      );
      requestAnimationFrame(() => {
        ingredientInputRefs.current[focusIndex]?.focus();
      });
      return;
    }

    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? text : row)),
    );
    setStructuredIngredients((current) => {
      if (!current) return current;
      const items = [...current.items];
      items[index] = { ...(items[index] ?? {}), raw: text };
      return { ...current, items };
    });
  }, []);

  const handleIngredientSubmit = useCallback(
    (index: number) => {
      if (index < ingredients.length - 1) {
        ingredientInputRefs.current[index + 1]?.focus();
        return;
      }
      if (
        ingredients[index]?.trim() !== "" &&
        ingredients.length < INGREDIENTS_MAX
      ) {
        const nextIndex = ingredients.length;
        setIngredients((rows) =>
          rows.length < INGREDIENTS_MAX ? [...rows, ""] : rows,
        );
        setStructuredIngredients((current) => {
          if (!current) return current;
          return { ...current, items: [...current.items, { raw: "" }] };
        });
        setTimeout(() => {
          ingredientInputRefs.current[nextIndex]?.focus();
        }, 40);
      } else {
        Keyboard.dismiss();
      }
    },
    [ingredients],
  );

  const removeIngredientAt = useCallback((index: number) => {
    setIngredients((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
    setStructuredIngredients((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, []);

  const updateStepAt = useCallback(
    (index: number, patch: Partial<StepDraft>) => {
      setSteps((rows) =>
        rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

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
    setExpandedStepTranslations((prev) => {
      const next: Record<number, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < index && v) next[idx] = true;
        else if (idx > index && v) next[idx - 1] = true;
      }
      return next;
    });
  }, []);

  const toggleStepTranslation = useCallback((index: number) => {
    setExpandedStepTranslations((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  // ---- Image pickers (Gallery + Camera) ---------------------------------------

  const pickImageFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPickedUri(result.assets[0].uri);
        setImageRemoved(false);
      }
    } catch (err) {
      console.warn("[RecipeReal] image pick failed:", err);
    }
  }, []);

  const pickImageFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("composer.cameraPermissionTitle"),
          t("composer.cameraPermissionBody"),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPickedUri(result.assets[0].uri);
        setImageRemoved(false);
      }
    } catch (err) {
      console.warn("[RecipeReal] camera capture failed:", err);
    }
  }, [t]);

  // ---- Validation (mirrors the server rules) ----------------------------------

  /** Returns a localized error message, or null when the form is valid. */
  const validate = useCallback((): string | null => {
    if (title.trim().length === 0 && titleAr.trim().length === 0) {
      return t("composer.errTitleRequired");
    }
    if (minutes.trim().length === 0) return t("composer.errMinutesRequired");
    const mins = parseIntOrNull(minutes);
    if (mins == null || mins < MINUTES_MIN || mins > MINUTES_MAX) {
      return t("composer.errMinutesRange");
    }
    const plates = parseIntOrNull(servings);
    if (plates != null && (plates < SERVINGS_MIN || plates > SERVINGS_MAX)) {
      return t("composer.errServings");
    }
    for (const timing of [prepMinutes, cookMinutes]) {
      const parsed = parseIntOrNull(timing);
      if (parsed != null && (parsed < 0 || parsed > MINUTES_MAX)) {
        return t("composer.errMinutesRange");
      }
    }
    if (description.length > DESCRIPTION_MAX) {
      return t("composer.errDescriptionLong");
    }
    const ing = ingredients
      .map((row) => row.trim())
      .filter((row) => row !== "");
    if (ing.length < INGREDIENTS_MIN) return t("composer.errIngredients");
    if (ing.length > INGREDIENTS_MAX) return t("composer.errIngredientsMax");
    if (ing.some((row) => row.length > INGREDIENT_MAX)) {
      return t("composer.errIngredientLong");
    }
    const kept = steps.filter(
      (row) =>
        row.description.trim() !== "" || row.description_ar.trim() !== "",
    );
    if (kept.length < STEPS_MIN) return t("composer.errSteps");
    if (kept.length > STEPS_MAX) return t("composer.errStepsMax");
    if (
      kept.some(
        (row) =>
          row.description.trim().length > STEP_MAX ||
          row.description_ar.trim().length > STEP_MAX,
      )
    ) {
      return t("composer.errStepLong");
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
      return t("composer.errStepMinutes");
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
    ingredients,
    steps,
    t,
  ]);

  // ---- Save -------------------------------------------------------------------

  const onSave = useCallback(async () => {
    if (saving) return;
    setHalalTerms(null);
    setNeedsAuth(false);
    const invalid = validate();
    if (invalid != null) {
      setError(invalid);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let imageUrl: string | null | undefined;
      if (pickedUri != null) {
        imageUrl = await uploadImage(pickedUri);
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

      const input: UserRecipeInput = {
        title: cleanTitle !== "" ? cleanTitle : cleanTitleAr,
        ...(cleanTitleAr !== ""
          ? { title_ar: cleanTitleAr }
          : editMode
            ? { title_ar: null as unknown as string }
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
        ...(structuredIngredients && importMode
          ? (() => {
              const rows = ingredients
                .map((row, index) => {
                  const item = (structuredIngredients.items[index] ??
                    {}) as Record<string, unknown>;
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
        ...(structuredIngredients && importMode
          ? {
              ingredients_structured: {
                v: 1,
                items: ingredients
                  .map((row, index) => ({
                    ...(structuredIngredients.items[index] ?? {}),
                    raw: row.trim(),
                  }))
                  .filter((item) => item.raw !== ""),
              },
            }
          : {}),
        steps: stepRows,
      };
      const saved =
        importMode && importId != null
          ? await publishRecipeImport(importId, input)
          : editMode && editId != null
            ? await updateUserRecipe(editId, input)
            : await createUserRecipe(input);
      track(
        editMode
          ? "user_recipe_updated"
          : importMode
            ? "ai_recipe_import_published"
            : "user_recipe_created",
        {
          recipe_id: saved.id,
        },
      );
      router.push(`/recipe/${saved.id}`);
    } catch (err) {
      console.warn("[RecipeReal] composer save failed:", err);
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
        setError(t("composer.halalBlocked", { terms: err.terms.join(", ") }));
      } else {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 401) {
          setNeedsAuth(true);
          setError(t("composer.signInRequired"));
        } else if (
          err instanceof Error &&
          /upload/i.test(err.message) &&
          pickedUri != null
        ) {
          setError(t("composer.errImageUpload"));
        } else {
          setError(t("composer.errGeneric"));
        }
      }
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validate,
    pickedUri,
    imageRemoved,
    steps,
    title,
    titleAr,
    description,
    sourceUrl,
    servings,
    minutes,
    prepMinutes,
    cookMinutes,
    ingredients,
    structuredIngredients,
    importMode,
    importId,
    editMode,
    editId,
    t,
  ]);

  // ---- Delete (edit mode) -----------------------------------------------------

  const onDelete = useCallback(async () => {
    if (editId == null || deleting) return;
    setDeleting(true);
    try {
      await deleteUserRecipe(editId);
      track("user_recipe_deleted", { recipe_id: editId });
      router.back();
    } catch (err) {
      console.warn("[RecipeReal] recipe delete failed:", err);
      setDeleting(false);
      Alert.alert(t("composer.errDelete"));
    }
  }, [editId, deleting, t]);

  /** Destructive confirmation before deleting the recipe. */
  const confirmDelete = useCallback(() => {
    Alert.alert(
      t("composer.deleteConfirmTitle"),
      t("composer.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("composer.deleteConfirmBtn"),
          style: "destructive",
          onPress: () => {
            void onDelete();
          },
        },
      ],
    );
  }, [t, onDelete]);

  // ---- Small render helpers ---------------------------------------------------

  /** Labeled field wrapper: label (+ optional marker) above the input. */
  const field = (
    label: string,
    input: ReactNode,
    opts: { optional?: boolean } = {},
  ) => (
    <View style={styles.section}>
      <Text style={styles.fieldLabel}>
        {label}
        {opts.optional ? (
          <Text style={styles.fieldOptional}>
            {` · ${t("quick.optional")}`}
          </Text>
        ) : null}
      </Text>
      {input}
    </View>
  );

  const thumbUri = pickedUri ?? (imageRemoved ? null : existingImage);

  // ---- Unsaved-changes guard --------------------------------------------------
  const formSnapshot = useMemo(
    () =>
      serializeForm({
        title,
        titleAr,
        description,
        sourceUrl,
        servings,
        minutes,
        prepMinutes,
        cookMinutes,
        ingredients,
        steps,
        pickedUri,
        imageRemoved,
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
      ingredients,
      steps,
      pickedUri,
      imageRemoved,
    ],
  );
  const dirty = formSnapshot !== baselineSnapshot;

  const navigation = useNavigation();
  usePreventRemove(dirty && !saving && !deleting, ({ data }) => {
    Alert.alert(
      t("composer.discardTitle"),
      t("composer.discardRecipeMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("composer.discardBtn"),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  const stepTypeChips = (row: StepDraft, index: number) => (
    <View style={styles.typeChips}>
      {STEP_TYPES.map((type) => (
        <IconPressable
          key={type}
          onPress={() => updateStepType(index, type)}
        >
          <Chip
            label={t(`stepType.${type}`)}
            size="sm"
            tone={row.step_type === type ? "accent" : "neutral"}
          />
        </IconPressable>
      ))}
    </View>
  );

  if (authed === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (authed === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("composer.signInRequired")}</Text>
        <Button
          title={t("common.signIn")}
          variant="secondary"
          onPress={() => router.push("/login")}
          style={styles.addRow}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>{t("common.loadingRecipe")}</Text>
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t("common.somethingWentWrong")}</Text>
        <Text style={styles.muted}>{t("common.couldNotLoadRecipe")}</Text>
        <Button title={t("common.retry")} onPress={retryPrefill} />
        <Button
          title={t("common.back")}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const headerTitle =
    editMode || importMode ? t("stack.editRecipe") : t("stack.newRecipe");
  const topSaveLabel = saving
    ? t("composer.saving")
    : importMode
      ? t("composer.publish")
      : t("composer.saveShort");
  const bottomSaveLabel = saving
    ? t("composer.saving")
    : importMode
      ? t("composer.publish")
      : t("composer.save");

  const servingsNum = parseIntOrNull(servings);
  const canDecrementServings = servingsNum != null && servingsNum > SERVINGS_MIN;
  const canIncrementServings = servingsNum == null || servingsNum < SERVINGS_MAX;

  const isArabicPrimary = lang === "ar";
  const primaryTitleValue = isArabicPrimary ? titleAr : title;
  const setPrimaryTitleValue = isArabicPrimary ? setTitleAr : setTitle;
  const secondaryTitleValue = isArabicPrimary ? title : titleAr;
  const setSecondaryTitleValue = isArabicPrimary ? setTitle : setTitleAr;

  return (
    // KeyboardAwareScrollView alone handles avoidance (single mechanism —
    // a KeyboardAvoidingView wrapper here double-counted the keyboard and
    // left a scrollable empty band at the bottom while typing). The Save
    // pill lives in the header, so nothing pinned needs to ride the
    // keyboard.
    <View style={styles.container}>
      {/* Top bar: BackChevron on start, centered title, prominent Save pill on end */}
      <PinnedHeaderBar
        title={headerTitle}
        titleContent={
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
        }
        leading={<BackChevron />}
        rights={[
          <Pressable
            key="header-save"
            onPress={saving ? undefined : onSave}
            disabled={saving}
            onPressIn={() => setSavePillPressed(true)}
            onPressOut={() => setSavePillPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={topSaveLabel}
            style={[
              styles.headerSavePill,
              saving ? styles.headerSavePillDisabled : null,
              !saving && savePillPressed ? styles.headerSavePillPressed : null,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.headerSaveText} numberOfLines={1}>
              {topSaveLabel}
            </Text>
          </Pressable>,
        ]}
      />
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {importMode && importWarnings.length > 0 ? (
          <View style={styles.importCard}>
            <Text style={styles.importTitle}>{t("import.reviewWarnings")}</Text>
            {importWarnings.map((warning) => (
              <Text key={warning} style={styles.importWarning}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}

        {error != null && halalTerms == null ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 1. Cover Photo card */}
        <Card style={styles.section}>
          <SectionHeader title={t("composer.image")} />
          {thumbUri ? (
            <>
              <View style={styles.coverPreviewWrap}>
                <Image
                  source={{ uri: thumbUri }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={0}
                />
              </View>
              <View style={styles.imageActions}>
                <Button
                  title={t("composer.gallery")}
                  variant="secondary"
                  icon="images-outline"
                  onPress={pickImageFromGallery}
                />
                <Button
                  title={t("composer.camera")}
                  variant="secondary"
                  icon="camera-outline"
                  onPress={pickImageFromCamera}
                />
                <Button
                  title={t("composer.removeImage")}
                  variant="ghost"
                  onPress={() => {
                    setPickedUri(null);
                    setImageRemoved(true);
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.coverEmptyBox}>
                <Ionicons
                  name="image-outline"
                  size={30}
                  color={colors.inkFaint}
                />
                <Text style={styles.coverEmptyText}>
                  {t("composer.addPhotoHint")}
                </Text>
              </View>
              <View style={styles.twoCol}>
                <View style={styles.imageActionFlex}>
                  <Button
                    title={t("composer.gallery")}
                    variant="secondary"
                    icon="images-outline"
                    fullWidth
                    onPress={pickImageFromGallery}
                  />
                </View>
                <View style={styles.imageActionFlex}>
                  <Button
                    title={t("composer.camera")}
                    variant="secondary"
                    icon="camera-outline"
                    fullWidth
                    onPress={pickImageFromCamera}
                  />
                </View>
              </View>
            </>
          )}
        </Card>

        {/* 2. Smart Single-First Title */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.basics")}
            subtitle={t("composer.basicsHint")}
          />
          {field(
            showTitleTranslation
              ? isArabicPrimary
                ? t("composer.titleAr")
                : t("composer.titleEn")
              : t("composer.title"),
            <TextInput
              style={styles.input}
              value={primaryTitleValue}
              onChangeText={setPrimaryTitleValue}
              placeholder={t("composer.titlePlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={TITLE_MAX}
            />,
          )}
          <IconPressable
            style={styles.translationToggle}
            onPress={() => setShowTitleTranslation((v) => !v)}
          >
            <Chip
              label={
                showTitleTranslation
                  ? t("composer.hideTranslation")
                  : t("composer.addTranslation")
              }
              size="sm"
              tone={showTitleTranslation ? "accent" : "neutral"}
              icon={
                <Ionicons
                  name={showTitleTranslation ? "chevron-up" : "add"}
                  size={14}
                  color={
                    showTitleTranslation ? colors.accent : colors.inkSecondary
                  }
                />
              }
            />
          </IconPressable>
          {showTitleTranslation
            ? field(
                isArabicPrimary
                  ? t("composer.titleEn")
                  : t("composer.titleAr"),
                <TextInput
                  style={styles.input}
                  value={secondaryTitleValue}
                  onChangeText={setSecondaryTitleValue}
                  placeholder={t("composer.titleArPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  maxLength={TITLE_MAX}
                />,
                { optional: true },
              )
            : null}
        </Card>

        {/* 3. Servings stepper & Total time quick presets */}
        <Card style={styles.section}>
          <SectionHeader title={t("composer.timing")} />
          {field(
            t("composer.servings"),
            <View style={styles.stepperRow}>
              <IconPressable
                style={[
                  styles.stepperBtn,
                  !canDecrementServings ? styles.stepperBtnDisabled : null,
                ]}
                disabled={!canDecrementServings}
                accessibilityLabel={t("composer.servingsMinusA11y")}
                onPress={() => {
                  if (servingsNum != null && servingsNum > SERVINGS_MIN) {
                    setServings(String(servingsNum - 1));
                  }
                }}
              >
                <Ionicons name="remove" size={20} color={colors.ink} />
              </IconPressable>
              <TextInput
                style={styles.stepperInput}
                value={servings}
                onChangeText={(text) =>
                  setServings(text.replace(/[^0-9]/g, ""))
                }
                placeholder="—"
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={2}
              />
              <IconPressable
                style={[
                  styles.stepperBtn,
                  !canIncrementServings ? styles.stepperBtnDisabled : null,
                ]}
                disabled={!canIncrementServings}
                accessibilityLabel={t("composer.servingsPlusA11y")}
                onPress={() => {
                  const next = Math.min(
                    SERVINGS_MAX,
                    Math.max(SERVINGS_MIN, (servingsNum ?? 0) + 1),
                  );
                  setServings(String(next));
                }}
              >
                <Ionicons name="add" size={20} color={colors.ink} />
              </IconPressable>
            </View>,
            { optional: true },
          )}
          {field(
            t("composer.minutes"),
            <View style={styles.section}>
              <View style={styles.presetRow}>
                {TOTAL_TIME_PRESETS.map((preset) => {
                  const active = parseIntOrNull(minutes) === preset;
                  return (
                    <IconPressable
                      key={preset}
                      onPress={() => setMinutes(String(preset))}
                    >
                      <Chip
                        label={`${preset}${t("common.min")}`}
                        size="sm"
                        tone={active ? "accent" : "neutral"}
                      />
                    </IconPressable>
                  );
                })}
              </View>
              <View style={styles.unitInputBox}>
                <TextInput
                  style={styles.unitTextInput}
                  value={minutes}
                  onChangeText={(text) =>
                    setMinutes(text.replace(/[^0-9]/g, ""))
                  }
                  placeholder="30"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Text style={styles.unitSuffix}>{t("composer.unitMin")}</Text>
              </View>
            </View>,
          )}
        </Card>

        {/* 4. Collapsible More details (optional) */}
        <Card style={styles.section}>
          <IconPressable
            style={styles.collapseHeader}
            onPress={() => setShowMoreDetails((v) => !v)}
          >
            <Text style={styles.collapseTitle}>
              {t("composer.moreDetails")}
              <Text style={styles.fieldOptional}>
                {` · ${t("quick.optional")}`}
              </Text>
            </Text>
            <Ionicons
              name={showMoreDetails ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.inkSecondary}
            />
          </IconPressable>
          {showMoreDetails ? (
            <View style={styles.collapseBody}>
              {field(
                t("composer.description"),
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("composer.descriptionPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  maxLength={DESCRIPTION_MAX}
                />,
                { optional: true },
              )}
              <View style={styles.twoCol}>
                <View style={styles.twoColCell}>
                  <Text style={styles.fieldLabel}>
                    {t("composer.prepMinutes")}
                  </Text>
                  <View style={styles.unitInputBox}>
                    <TextInput
                      style={styles.unitTextInput}
                      value={prepMinutes}
                      onChangeText={(text) =>
                        setPrepMinutes(text.replace(/[^0-9]/g, ""))
                      }
                      placeholder="10"
                      placeholderTextColor={colors.inkFaint}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <Text style={styles.unitSuffix}>
                      {t("composer.unitMin")}
                    </Text>
                  </View>
                </View>
                <View style={styles.twoColCell}>
                  <Text style={styles.fieldLabel}>
                    {t("composer.cookMinutes")}
                  </Text>
                  <View style={styles.unitInputBox}>
                    <TextInput
                      style={styles.unitTextInput}
                      value={cookMinutes}
                      onChangeText={(text) =>
                        setCookMinutes(text.replace(/[^0-9]/g, ""))
                      }
                      placeholder="20"
                      placeholderTextColor={colors.inkFaint}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <Text style={styles.unitSuffix}>
                      {t("composer.unitMin")}
                    </Text>
                  </View>
                </View>
              </View>
              {field(
                t("composer.sourceUrl"),
                <TextInput
                  style={styles.input}
                  value={sourceUrl}
                  onChangeText={setSourceUrl}
                  placeholder={t("composer.sourceUrlPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />,
                { optional: true },
              )}
            </View>
          ) : null}
        </Card>

        {/* 5. Ingredients (numbered, Enter/Next auto-add, multi-line paste split) */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.ingredients")}
            subtitle={t("composer.ingredientsHint")}
          />
          <View style={styles.rowList}>
            {ingredients.map((row, index) => (
              <View key={`ing-${index}`} style={styles.rowLine}>
                <Text style={styles.rowIndex}>{index + 1}</Text>
                <View style={styles.rowInputWrap}>
                  <TextInput
                    ref={(el) => {
                      ingredientInputRefs.current[index] = el;
                    }}
                    style={styles.input}
                    value={row}
                    onChangeText={(text) =>
                      handleIngredientChange(index, text)
                    }
                    onSubmitEditing={() => handleIngredientSubmit(index)}
                    returnKeyType="next"
                    submitBehavior="submit"
                    placeholder={t("composer.ingredientPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    maxLength={INGREDIENT_MAX}
                  />
                </View>
                <IconPressable
                  style={styles.removeBtn}
                  onPress={() => removeIngredientAt(index)}
                  accessibilityLabel={t("composer.removeRow")}
                  disabled={ingredients.length === 1}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.inkSecondary}
                  />
                </IconPressable>
              </View>
            ))}
          </View>
          {ingredients.length < INGREDIENTS_MAX ? (
            <Button
              title={t("composer.addIngredient")}
              variant="ghost"
              style={styles.addRow}
              leftIcon={
                <Ionicons name="add" size={18} color={colors.accent} />
              }
              onPress={() => {
                const nextIndex = ingredients.length;
                setIngredients((rows) => [...rows, ""]);
                setTimeout(() => {
                  ingredientInputRefs.current[nextIndex]?.focus();
                }, 40);
              }}
            />
          ) : null}
        </Card>

        {/* 6. Simplified Steps */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.steps")}
            subtitle={t("composer.stepsHint")}
          />
          <View style={styles.rowList}>
            {steps.map((row, index) => {
              const primaryStepValue = isArabicPrimary
                ? row.description_ar
                : row.description;
              const secondaryStepValue = isArabicPrimary
                ? row.description
                : row.description_ar;
              const stepDurationValue =
                row.minutes !== "" ? row.minutes : row.literal_minutes;
              const stepTranslationOpen = Boolean(
                expandedStepTranslations[index],
              );

              return (
                <Card
                  key={`step-${index}`}
                  style={styles.stepCard}
                  padding={Space.md}
                >
                  <View style={styles.stepHeadRow}>
                    <Text style={styles.stepNumber}>{`#${index + 1}`}</Text>
                    <View style={styles.stepHeadChipsWrap}>
                      {stepTypeChips(row, index)}
                    </View>
                    <IconPressable
                      style={styles.removeBtn}
                      onPress={() => removeStepAt(index)}
                      accessibilityLabel={t("composer.removeRow")}
                      disabled={steps.length === 1}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={colors.inkSecondary}
                      />
                    </IconPressable>
                  </View>

                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={primaryStepValue}
                    onChangeText={(text) =>
                      updateStepAt(
                        index,
                        isArabicPrimary
                          ? { description_ar: text }
                          : { description: text },
                      )
                    }
                    placeholder={t("composer.stepDescriptionPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    maxLength={STEP_MAX}
                  />

                  <IconPressable
                    style={styles.translationToggle}
                    onPress={() => toggleStepTranslation(index)}
                  >
                    <Chip
                      label={
                        stepTranslationOpen
                          ? t("composer.hideTranslation")
                          : t("composer.addTranslation")
                      }
                      size="sm"
                      tone={stepTranslationOpen ? "accent" : "neutral"}
                      icon={
                        <Ionicons
                          name={stepTranslationOpen ? "chevron-up" : "add"}
                          size={14}
                          color={
                            stepTranslationOpen
                              ? colors.accent
                              : colors.inkSecondary
                          }
                        />
                      }
                    />
                  </IconPressable>

                  {stepTranslationOpen ? (
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={secondaryStepValue}
                      onChangeText={(text) =>
                        updateStepAt(
                          index,
                          isArabicPrimary
                            ? { description: text }
                            : { description_ar: text },
                        )
                      }
                      placeholder={t("composer.stepArPlaceholder")}
                      placeholderTextColor={colors.inkFaint}
                      multiline
                      maxLength={STEP_MAX}
                    />
                  ) : null}

                  <View style={styles.stepDurationRow}>
                    <View style={styles.stepDurationPills}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={colors.inkSecondary}
                      />
                      {STEP_TIME_PRESETS.map((preset) => {
                        const active =
                          parseIntOrNull(stepDurationValue) === preset;
                        return (
                          <IconPressable
                            key={preset}
                            onPress={() =>
                              updateStepDuration(
                                index,
                                active ? "" : String(preset),
                              )
                            }
                          >
                            <Chip
                              label={`${preset}${t("common.min")}`}
                              size="sm"
                              tone={active ? "accent" : "neutral"}
                            />
                          </IconPressable>
                        );
                      })}
                    </View>
                    <View style={styles.stepDurationInputBox}>
                      <TextInput
                        style={styles.stepDurationInput}
                        value={stepDurationValue}
                        onChangeText={(text) => updateStepDuration(index, text)}
                        placeholder="0"
                        placeholderTextColor={colors.inkFaint}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                      <Text style={styles.unitSuffix}>
                        {t("composer.unitMin")}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
          {steps.length < STEPS_MAX ? (
            <Button
              title={t("composer.addStep")}
              variant="ghost"
              style={styles.addRow}
              leftIcon={
                <Ionicons name="add" size={18} color={colors.accent} />
              }
              onPress={() =>
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
            />
          ) : null}
        </Card>

        {/* 7. Errors + actions */}
        <View style={styles.footer}>
          {halalTerms != null ? (
            <View style={styles.halalCard}>
              <Text style={styles.halalTitle}>{t("composer.halalTitle")}</Text>
              <Text style={styles.halalTerms}>{halalTerms.join(", ")}</Text>
            </View>
          ) : null}
          {error != null && halalTerms == null ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          {needsAuth ? (
            <Button
              title={t("common.signIn")}
              variant="secondary"
              onPress={() => router.push("/login")}
            />
          ) : null}
          <Button
            title={bottomSaveLabel}
            variant="primary"
            fullWidth
            loading={saving}
            onPress={onSave}
          />
          {editMode ? (
            <Button
              title={t("composer.deleteRecipe")}
              variant="ghost"
              onPress={confirmDelete}
              disabled={deleting || saving}
            />
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
