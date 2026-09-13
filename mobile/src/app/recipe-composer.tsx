import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  getRecipeImport,
  getRecipe,
  hasToken,
  HalalRejectionError,
  updateUserRecipe,
  publishRecipeImport,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { UserRecipeInput, UserRecipeStepInput } from "@/types";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { useT } from "@/i18n";
import { Button, Card, Chip, IconPressable, SectionHeader } from "@/components/ui";

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

const STEP_TYPES = ["active", "passive", "cleanup"] as const;

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

  // Image: the previously uploaded URL (edit mode) vs. a freshly picked local
  // uri (uploaded on save). `imageRemoved` lets an edit clear the old photo.
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  // ---- Load state (edit-mode prefill) / submission state ------------------------
  const [loading, setLoading] = useState(editMode || importMode);
  // Baseline snapshot of the pristine form (create mode: empty; edit mode:
  // set by prefill once loaded). State — not a ref — so the dirty check in
  // render never reads a ref.
  const [baselineSnapshot, setBaselineSnapshot] = useState<string>(() =>
    serializeForm(EMPTY_FORM),
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Inline error (validation or submit failure), shown above the Save button. */
  const [error, setError] = useState<string | null>(null);
  /** Terms from a HalalRejectionError — rendered as a prominent danger card. */
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // ---- Auth gate -----------------------------------------------------------------
  // Checked on every focus: a signed-out visitor sees a sign-in prompt
  // INSTEAD of the form, not a 401 after filling everything in.
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
        },
        inputMultiline: {
          minHeight: 80,
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
        // ---- Image picker row ----
        imageRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        thumbWrap: {
          width: 76,
          height: 76,
          borderRadius: Radius.md,
          overflow: "hidden",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          justifyContent: "center",
          alignItems: "center",
        },
        thumb: {
          width: "100%",
          height: "100%",
        },
        imageActions: {
          flex: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
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
          color: colors.inkFaint,
          fontWeight: "700",
        },
        stepHeadSpacer: {
          flex: 1,
        },
        stepArRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        minutesInput: {
          width: 84,
          textAlign: "center",
        },
        typeChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
        },
        addRow: {
          alignSelf: "flex-start",
        },
        // ---- Errors / footer ----
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
        },
        halalCard: {
          backgroundColor: colors.dangerSoft,
          borderRadius: Radius.md,
          padding: Space.md,
          gap: Space.xs,
          borderLeftWidth: 4,
          borderLeftColor: colors.danger,
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
          borderLeftWidth: 4,
          borderLeftColor: colors.amber,
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

  // ---- Edit-mode prefill (retryable) ---------------------------------------------
  // All setState calls happen AFTER the await (never synchronously in the
  // mount effect). The retry handler owns the loading/error resets.

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
        const draftIngredients = Array.isArray(draft.ingredients)
          ? draft.ingredients
          : [];
        const ingRows = draftIngredients
          .map((ingredient) => ingredient?.raw?.trim())
          .filter((row): row is string => Boolean(row));
        const safeIngredients = ingRows.length > 0 ? ingRows : [""];
        const draftSteps = Array.isArray(draft.steps) ? draft.steps : [];
        const stepRows: StepDraft[] =
          draftSteps.length > 0
            ? draftSteps.map((step) => ({
                description: step.description ?? "",
                description_ar: step.description_ar ?? "",
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
              }))
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

        setTitle(draft.title ?? "");
        setTitleAr(draft.title_ar ?? "");
        setDescription(draft.description ?? "");
        setSourceUrl(safeSourceUrl);
        setServings(servingsStr);
        setMinutes(minutesStr);
        setPrepMinutes(prepStr);
        setCookMinutes(cookStr);
        setIngredients(safeIngredients);
        setStructuredIngredients({
          v: 1,
          items: draftIngredients.map((ingredient) => ({ ...ingredient })),
        });
        setSteps(stepRows);
        setExistingImage(draft.cover_image_url ?? null);
        setImportWarnings(imported.warnings);
        setBaselineSnapshot(
          serializeForm({
            title: draft.title ?? "",
            titleAr: draft.title_ar ?? "",
            description: draft.description ?? "",
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
      setTitle(recipe.title ?? "");
      setTitleAr(recipe.title_ar ?? "");
      setDescription(recipe.description ?? "");
      setSourceUrl(recipe.source_url ?? "");
      setExistingImage(recipe.image_url ?? null);
      setServings(recipe.servings != null ? String(recipe.servings) : "");
      setPrepMinutes(
        recipe.prep_time_minutes != null ? String(recipe.prep_time_minutes) : "",
      );
      setCookMinutes(
        recipe.cook_time_minutes != null ? String(recipe.cook_time_minutes) : "",
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
      let stepRows: StepDraft[];
      if (structured.length > 0) {
        stepRows = structured.map((s) => ({
          description: s.description ?? "",
          description_ar: s.description_ar ?? "",
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
        }));
      } else {
        const plain = (recipe.steps ?? []).filter(
          (row): row is string => typeof row === "string",
        );
        stepRows =
          plain.length > 0
            ? plain.map((description) => ({
                description,
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
      setBaselineSnapshot(
        serializeForm({
          title: recipe.title ?? "",
          titleAr: recipe.title_ar ?? "",
          description: recipe.description ?? "",
          sourceUrl: recipe.source_url ?? "",
          servings: recipe.servings != null ? String(recipe.servings) : "",
          minutes: minutesStr,
          prepMinutes:
            recipe.prep_time_minutes != null
              ? String(recipe.prep_time_minutes)
              : "",
          cookMinutes:
            recipe.cook_time_minutes != null
              ? String(recipe.cook_time_minutes)
              : "",
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
  }, [editId, importId]);

  /** Retry entry point: own the spinner/error reset, then re-fetch. */
  const retryPrefill = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    void prefill();
  }, [prefill]);

  useEffect(() => {
    // The rule can't see that every setState inside `prefill` happens after
    // the initial await — the sync body only fetches. Same fetch-on-mount
    // shape as the other screens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void prefill();
  }, [prefill]);

  // ---- Dynamic row helpers ------------------------------------------------------

  const setIngredientAt = useCallback((index: number, text: string) => {
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
  }, []);

  // ---- Image picker --------------------------------------------------------------

  const pickImage = useCallback(async () => {
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
    } catch (error) {
      console.warn("[RecipeReal] image pick failed:", error);
    }
  }, []);

  // ---- Validation (mirrors the server rules) -------------------------------------

  /** Returns a localized error message, or null when the form is valid. */
  const validate = useCallback((): string | null => {
    if (title.trim().length === 0) return t("composer.errTitleRequired");
    if (minutes.trim().length === 0) return t("composer.errMinutesRequired");
    const mins = parseIntOrNull(minutes);
    if (mins == null || mins < MINUTES_MIN || mins > MINUTES_MAX) {
      return t("composer.errMinutesRange");
    }
    const plates = parseIntOrNull(servings);
    if (plates != null && (plates < 1 || plates > 50)) {
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
    const ing = ingredients.map((row) => row.trim()).filter((row) => row !== "");
    if (ing.length < INGREDIENTS_MIN) return t("composer.errIngredients");
    if (ing.length > INGREDIENTS_MAX) return t("composer.errIngredientsMax");
    if (ing.some((row) => row.length > INGREDIENT_MAX)) {
      return t("composer.errIngredientLong");
    }
    const kept = steps.filter((row) => row.description.trim() !== "");
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
    minutes,
    servings,
    prepMinutes,
    cookMinutes,
    description,
    ingredients,
    steps,
    t,
  ]);

  // ---- Save ------------------------------------------------------------------------

  const onSave = useCallback(async () => {
    if (saving) return;
    setHalalTerms(null);
    setNeedsAuth(false);
    const invalid = validate();
    if (invalid != null) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Upload a freshly picked photo first; the returned URL goes into the
      // payload. Removing the old photo (edit mode) sends image_url: null.
      let imageUrl: string | null | undefined;
      if (pickedUri != null) {
        imageUrl = await uploadImage(pickedUri);
      } else if (imageRemoved) {
        imageUrl = null;
      }
      const stepRows: UserRecipeStepInput[] = steps
        .filter((row) => row.description.trim() !== "")
        .map((row) => ({
          description: row.description.trim(),
          ...(row.description_ar.trim() !== ""
            ? { description_ar: row.description_ar.trim() }
            : {}),
          ...(parseIntOrNull(row.minutes) != null
            ? { minutes_estimated: parseIntOrNull(row.minutes) ?? undefined }
            : {}),
          ...(parseIntOrNull(row.literal_minutes) != null
            ? { literal_minutes: parseIntOrNull(row.literal_minutes) ?? undefined }
            : {}),
          step_type: row.step_type,
        }));
      const input: UserRecipeInput = {
        title: title.trim(),
        ...(titleAr.trim() !== "" ? { title_ar: titleAr.trim() } : {}),
        ...(description.trim() !== "" ? { description: description.trim() } : {}),
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
        ingredients: ingredients.map((row) => row.trim()).filter((row) => row !== ""),
        // AI imports carry per-item Arabic (raw_ar/item_ar) inside the
        // structured payload: forward it as ingredients_ar when every line
        // has one so Arabic UI shows real translations, not fallbacks.
        ...(structuredIngredients && importMode
          ? (() => {
              const rows = ingredients
                .map((row, index) => {
                  const item = (structuredIngredients.items[index] ?? {}) as Record<string, unknown>;
                  const ar =
                    typeof item.raw_ar === "string" && item.raw_ar.trim() !== ""
                      ? item.raw_ar.trim()
                      : typeof item.item_ar === "string" && item.item_ar.trim() !== ""
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
    } catch (error) {
      console.warn("[RecipeReal] composer save failed:", error);
      if (error instanceof HalalRejectionError) {
        setHalalTerms(error.terms);
        setError(t("composer.halalBlocked", { terms: error.terms.join(", ") }));
      } else {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 401) {
          setNeedsAuth(true);
          setError(t("composer.signInRequired"));
        } else if (
          error instanceof Error &&
          /upload/i.test(error.message) &&
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

  // ---- Delete (edit mode) ------------------------------------------------------------

  const onDelete = useCallback(async () => {
    if (editId == null || deleting) return;
    setDeleting(true);
    try {
      await deleteUserRecipe(editId);
      track("user_recipe_deleted", { recipe_id: editId });
      router.back();
    } catch (error) {
      console.warn("[RecipeReal] recipe delete failed:", error);
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

  // ---- Small render helpers -----------------------------------------------------------

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

  // ---- Unsaved-changes guard ------------------------------------------------------
  // The baseline snapshot is STATE (create mode: pristine empty form; edit
  // mode: set by prefill once loaded). Any drift from it arms a
  // confirm-before-remove guard covering the native header back, the
  // Android gesture/hardware back AND programmatic router.back() calls.
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
          onPress={() => updateStepAt(index, { step_type: type })}
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
        {/* Real retry: re-runs the prefill fetch (back would just leave). */}
        <Button title={t("common.retry")} onPress={retryPrefill} />
        <Button
          title={t("common.back")}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Own pinned header — the title depends on the mode. BackChevron
          routes through usePreventRemove's discard-confirm below. */}
      <PinnedHeaderBar
        title={
          editMode || importMode
            ? t("stack.editRecipe")
            : t("stack.newRecipe")
        }
        leading={<BackChevron />}
      />
      <ScrollView
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
        {/* 1. Basics: titles + description */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.basics")}
            subtitle={t("composer.basicsHint")}
          />
          {field(
            t("composer.titleEn"),
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t("composer.titlePlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={TITLE_MAX}
            />,
          )}
          {field(
            t("composer.titleAr"),
            <TextInput
              style={styles.input}
              value={titleAr}
              onChangeText={setTitleAr}
              placeholder={t("composer.titleArPlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={TITLE_MAX}
            />,
            { optional: true },
          )}
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
          {importMode || sourceUrl ? (
            field(
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
            )
          ) : null}
        </Card>

        {/* 2. Photo picker */}
        <Card style={styles.section}>
          <SectionHeader title={t("composer.image")} />
          <View style={styles.imageRow}>
            <View style={styles.thumbWrap}>
              {thumbUri ? (
                <Image
                  source={{ uri: thumbUri }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={0}
                />
              ) : (
                <Ionicons name="image-outline" size={26} color={colors.inkFaint} />
              )}
            </View>
            <View style={styles.imageActions}>
              <Button
                title={
                  thumbUri
                    ? t("composer.changeImage")
                    : t("composer.addImage")
                }
                variant="secondary"
                onPress={pickImage}
              />
              {thumbUri ? (
                <Button
                  title={t("composer.removeImage")}
                  variant="ghost"
                  onPress={() => {
                    setPickedUri(null);
                    setImageRemoved(true);
                  }}
                />
              ) : null}
            </View>
          </View>
        </Card>

        {/* 3. Servings + total minutes */}
        <Card style={styles.section}>
          <SectionHeader title={t("composer.timing")} />
          <View style={styles.twoCol}>
            <View style={styles.twoColCell}>
              <Text style={styles.fieldLabel}>
                {t("composer.servings")}
                <Text style={styles.fieldOptional}>
                  {` · ${t("quick.optional")}`}
                </Text>
              </Text>
              <TextInput
                style={styles.input}
                value={servings}
                onChangeText={(text) => setServings(text.replace(/[^0-9]/g, ""))}
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.twoColCell}>
              <Text style={styles.fieldLabel}>{t("composer.minutes")}</Text>
              <TextInput
                style={styles.input}
                value={minutes}
                onChangeText={(text) => setMinutes(text.replace(/[^0-9]/g, ""))}
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.twoColCell}>
              <Text style={styles.fieldLabel}>
                {t("composer.prepMinutes")}
                <Text style={styles.fieldOptional}>
                  {" · "}{t("quick.optional")}
                </Text>
              </Text>
              <TextInput
                style={styles.input}
                value={prepMinutes}
                onChangeText={(text) =>
                  setPrepMinutes(text.replace(/[^0-9]/g, ""))
                }
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={styles.twoColCell}>
              <Text style={styles.fieldLabel}>
                {t("composer.cookMinutes")}
                <Text style={styles.fieldOptional}>
                  {" · "}{t("quick.optional")}
                </Text>
              </Text>
              <TextInput
                style={styles.input}
                value={cookMinutes}
                onChangeText={(text) =>
                  setCookMinutes(text.replace(/[^0-9]/g, ""))
                }
                placeholderTextColor={colors.inkFaint}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
        </Card>

        {/* 4. Ingredients */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.ingredients")}
            subtitle={t("composer.ingredientsHint")}
          />
          <View style={styles.rowList}>
            {ingredients.map((row, index) => (
              <View key={`ing-${index}`} style={styles.rowLine}>
                <View style={styles.rowInputWrap}>
                  <TextInput
                    style={styles.input}
                    value={row}
                    onChangeText={(text) => setIngredientAt(index, text)}
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
                  <Ionicons name="close" size={18} color={colors.inkSecondary} />
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
              onPress={() => setIngredients((rows) => [...rows, ""])}
            />
          ) : null}
        </Card>

        {/* 5. Steps */}
        <Card style={styles.section}>
          <SectionHeader
            title={t("composer.steps")}
            subtitle={t("composer.stepsHint")}
          />
          <View style={styles.rowList}>
            {steps.map((row, index) => (
              <Card key={`step-${index}`} style={styles.stepCard} padding={Space.md}>
                <View style={styles.stepHeadRow}>
                  <Text style={styles.stepNumber}>{`#${index + 1}`}</Text>
                  <View style={styles.stepHeadSpacer} />
                  <IconPressable
                    style={styles.removeBtn}
                    onPress={() => removeStepAt(index)}
                    accessibilityLabel={t("composer.removeRow")}
                    disabled={steps.length === 1}
                  >
                    <Ionicons name="close" size={18} color={colors.inkSecondary} />
                  </IconPressable>
                </View>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={row.description}
                  onChangeText={(text) =>
                    updateStepAt(index, { description: text })
                  }
                  placeholder={t("composer.stepDescriptionPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  maxLength={STEP_MAX}
                />
                <View style={styles.stepArRow}>
                  <View style={styles.rowInputWrap}>
                    <TextInput
                      style={styles.input}
                      value={row.description_ar}
                      onChangeText={(text) =>
                        updateStepAt(index, { description_ar: text })
                      }
                      placeholder={t("composer.stepArPlaceholder")}
                      placeholderTextColor={colors.inkFaint}
                      maxLength={STEP_MAX}
                    />
                  </View>
                  <TextInput
                    style={[styles.input, styles.minutesInput]}
                    value={row.minutes}
                    onChangeText={(text) =>
                      updateStepAt(index, {
                        minutes: text.replace(/[^0-9]/g, ""),
                      })
                    }
                    placeholder={t("common.min")}
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <TextInput
                    style={[styles.input, styles.minutesInput]}
                    value={row.literal_minutes}
                    onChangeText={(text) =>
                      updateStepAt(index, {
                        literal_minutes: text.replace(/[^0-9]/g, ""),
                      })
                    }
                    placeholder={t("composer.literalMinutes")}
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
                {stepTypeChips(row, index)}
              </Card>
            ))}
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

        {/* 6. Errors + actions */}
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
            title={saving ? t("composer.saving") : t("composer.save")}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
