import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import {
  createPost,
  HalalRejectionError,
  searchRecipes,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { Post, PostKind, Recipe } from "@/types";
import { useLang, useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Button,
  Card,
  Chip,
  ComposeImageGrid,
  IconPressable,
} from "@/components/ui";

// ---- Constants ---------------------------------------------------------------

const POST_BODY_MAX = 2000;
const RECIPE_PICK_RESULTS = 5;
const RECIPE_SEARCH_DEBOUNCE_MS = 350;
const MAX_IMAGES = 6;

// ---- Helpers -----------------------------------------------------------------

function kindTone(kind: PostKind): "success" | "danger" | "amber" {
  if (kind === "fail") return "danger";
  if (kind === "question") return "amber";
  return "success";
}

function kindLabelKey(kind: PostKind): string {
  if (kind === "fail") return "community.kindFail";
  if (kind === "question") return "community.kindQuestion";
  return "community.kindTry";
}

function useLocalizedTitle(): (recipe: Recipe) => string {
  const { lang } = useLang();
  return useCallback(
    (recipe: Recipe) =>
      lang === "ar"
        ? (recipe.title_ar ?? recipe.title ?? "")
        : (recipe.title ?? recipe.title_ar ?? ""),
    [lang],
  );
}

// ---- Screen ------------------------------------------------------------------

/**
 * Dedicated post compose screen (/post-composer).
 *
 * Extracted verbatim from the inline ComposeCard in community.tsx. On
 * successful submission it calls router.back() so the community tab regains
 * focus — useFocusEffect in that tab re-checks auth state and the feed
 * auto-refreshes (this is the existing refresh-on-focus mechanism).
 *
 * Route: pushed via router.push("/post-composer") from the Community tab.
 * Safe-area + keyboard-avoiding handled here; no double-header.
 */
export default function PostComposerScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const lr = useLocalizedTitle();

  const [kind, setKind] = useState<PostKind>("try");
  const [body, setBody] = useState("");
  const [pickedUris, setPickedUris] = useState<string[]>([]);

  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [posting, setPosting] = useState(false);
  const [uploadCaption, setUploadCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  // Debounced recipe search.
  useEffect(() => {
    if (selectedRecipe != null) return;
    const q = recipeQuery.trim();
    if (q.length === 0) {
      setRecipeResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setRecipeSearching(true);
      searchRecipes({ q, perPage: RECIPE_PICK_RESULTS })
        .then((page) => {
          setRecipeResults(page.recipes.slice(0, RECIPE_PICK_RESULTS));
        })
        .catch(() => {
          setRecipeResults([]);
        })
        .finally(() => {
          setRecipeSearching(false);
        });
    }, RECIPE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [recipeQuery, selectedRecipe]);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - pickedUris.length;
    if (remaining <= 0) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (!result.canceled && result.assets.length > 0) {
        const newUris = result.assets
          .map((a) => a.uri)
          .filter(Boolean)
          .slice(0, remaining);
        setPickedUris((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
      }
    } catch (err) {
      console.warn("[RecipeReal] image pick failed:", err);
    }
  }, [pickedUris]);

  const removeImage = useCallback((index: number) => {
    setPickedUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const submit = useCallback(async () => {
    const text = body.trim();
    if (text.length === 0) {
      setError(t("community.errBodyRequired"));
      return;
    }
    if (text.length > POST_BODY_MAX) {
      setError(t("community.errBodyLong"));
      return;
    }
    if (posting) return;
    setPosting(true);
    setError(null);
    setHalalTerms(null);
    setUploadCaption(null);
    try {
      const uploadedUrls: string[] = [];
      if (pickedUris.length > 0) {
        for (let i = 0; i < pickedUris.length; i++) {
          setUploadCaption(
            t("community.uploadingImages", { n: pickedUris.length }) +
              ` (${i + 1}/${pickedUris.length})`,
          );
          try {
            const url = await uploadImage(pickedUris[i]);
            uploadedUrls.push(url);
          } catch {
            setError(t("community.errImageUpload"));
            return;
          }
        }
      }
      setUploadCaption(null);

      const created: Post = await createPost({
        kind,
        body: text,
        ...(selectedRecipe ? { recipe_id: selectedRecipe.id } : {}),
        ...(uploadedUrls.length > 0 ? { images: uploadedUrls } : {}),
      });
      track("post_created", {
        kind,
        has_image: uploadedUrls.length > 0,
        image_count: uploadedUrls.length,
        has_recipe: selectedRecipe != null,
      });
      // Navigate back; community tab regains focus → useFocusEffect refreshes feed.
      router.back();
      // Optionally surface the created post id via params for immediate prepend
      // — the focus-based refresh covers it without extra coupling.
      void created;
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
      } else {
        console.warn("[RecipeReal] post creation failed:", err);
        setError(t("community.postFailed"));
      }
    } finally {
      setPosting(false);
      setUploadCaption(null);
    }
  }, [body, posting, pickedUris, kind, selectedRecipe, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        headerBar: {
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + Space.sm,
          paddingBottom: Space.sm,
          paddingHorizontal: Space.lg,
          gap: Space.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
          backgroundColor: colors.canvas,
        },
        headerTitle: {
          ...Type.h3,
          color: colors.ink,
          flex: 1,
        },
        closeBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          padding: Space.lg,
          gap: Space.md,
          paddingBottom: insets.bottom + Space.xxl,
        },
        card: {
          gap: Space.md,
          borderWidth: 1,
          borderColor: colors.accentSoft,
        },
        kindLabel: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        kindRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
        },
        bodyInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          padding: Space.md,
          minHeight: 120,
          textAlignVertical: "top",
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
        },
        attachLabel: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        selectedRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        photoActions: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
        },
        resultRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingVertical: Space.xs,
        },
        resultTitle: {
          ...Type.bodySm,
          color: colors.ink,
          flex: 1,
        },
        searchRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        searchInput: {
          flex: 1,
          ...Type.bodySm,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
        },
        searching: {
          alignSelf: "flex-start",
        },
        actions: {
          flexDirection: "row",
          gap: Space.sm,
        },
        uploadCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
      }),
    [colors, insets],
  );

  return (
    <View style={styles.container}>
      {/* Header bar with close button */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t("community.composeTitle")}</Text>
        <IconPressable
          onPress={() => router.back()}
          accessibilityLabel={t("common.cancel")}
          hitSlop={Space.xs}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color={colors.inkSecondary} />
        </IconPressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            {/* Kind selector */}
            <Text style={styles.kindLabel}>{t("community.composeKindHint")}</Text>
            <View style={styles.kindRow}>
              {(["try", "fail", "question"] as PostKind[]).map((option) => (
                <IconPressable
                  key={option}
                  onPress={() => setKind(option)}
                  hitSlop={Space.xs}
                >
                  <Chip
                    label={t(kindLabelKey(option))}
                    tone={kind === option ? kindTone(option) : "neutral"}
                    size="sm"
                  />
                </IconPressable>
              ))}
            </View>

            {/* Body */}
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder={t("community.composePlaceholder")}
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={POST_BODY_MAX}
              editable={!posting}
            />

            {/* Multi-image preview grid (with remove buttons) */}
            {pickedUris.length > 0 ? (
              <ComposeImageGrid
                uris={pickedUris}
                onRemove={removeImage}
                disabled={posting}
              />
            ) : null}

            {/* Photo action buttons */}
            <View style={styles.photoActions}>
              {pickedUris.length < MAX_IMAGES ? (
                <Button
                  title={
                    pickedUris.length === 0
                      ? t("community.addImages")
                      : t("community.addMoreImages")
                  }
                  variant="ghost"
                  onPress={() => void pickImages()}
                  disabled={posting}
                />
              ) : null}
            </View>

            {/* Upload progress caption */}
            {uploadCaption != null ? (
              <Text style={styles.uploadCaption}>{uploadCaption}</Text>
            ) : null}

            {/* Recipe attach */}
            {selectedRecipe ? (
              <View style={styles.selectedRow}>
                <Chip
                  label={lr(selectedRecipe)}
                  tone="accent"
                  size="sm"
                  icon={
                    <Ionicons
                      name="restaurant-outline"
                      size={12}
                      color={colors.accent}
                    />
                  }
                />
                <IconPressable
                  onPress={() => {
                    setSelectedRecipe(null);
                    setRecipeQuery("");
                    setRecipeResults([]);
                  }}
                  hitSlop={Space.xs}
                  disabled={posting}
                >
                  <Ionicons name="close" size={18} color={colors.inkSecondary} />
                </IconPressable>
              </View>
            ) : (
              <>
                <Text style={styles.attachLabel}>{t("community.attachRecipe")}</Text>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color={colors.inkFaint} />
                  <TextInput
                    style={styles.searchInput}
                    value={recipeQuery}
                    onChangeText={setRecipeQuery}
                    placeholder={t("browse.searchPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    editable={!posting}
                    returnKeyType="search"
                  />
                </View>
                {recipeSearching ? (
                  <ActivityIndicator
                    color={colors.accent}
                    size="small"
                    style={styles.searching}
                  />
                ) : (
                  <View style={{ gap: Space.xs }}>
                    {recipeResults.map((recipe) => (
                      <IconPressable
                        key={`pick-${recipe.id}`}
                        onPress={() => setSelectedRecipe(recipe)}
                        style={styles.resultRow}
                        disabled={posting}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={18}
                          color={colors.accent}
                        />
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {lr(recipe)}
                        </Text>
                      </IconPressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Halal / generic error */}
            {halalTerms != null ? (
              <Text style={styles.errorText}>
                {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
              </Text>
            ) : null}
            {error != null && halalTerms == null ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title={t("common.cancel")}
                variant="ghost"
                onPress={() => router.back()}
                disabled={posting}
              />
              <Button
                title={posting ? t("community.posting") : t("community.postAction")}
                variant="primary"
                loading={posting}
                disabled={posting || body.trim().length === 0}
                onPress={() => void submit()}
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
