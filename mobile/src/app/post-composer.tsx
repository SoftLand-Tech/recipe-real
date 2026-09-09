import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createPost,
  hasToken,
  HalalRejectionError,
  OfflineError,
  searchRecipes,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { Post, Recipe } from "@/types";
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

/**
 * AsyncStorage key for the post-composer draft. Community writes are NOT
 * offline-queued (the offline queue is cook-sessions-only), so the draft —
 * body text plus the attached recipe — is persisted on every change and
 * restored on mount. It is removed only after a successful post, meaning an
 * offline failure, an app kill, or navigating away never silently loses
 * composed text (the unsaved-changes guard below covers in-session leaves).
 */
const POST_COMPOSER_DRAFT_KEY = "recipereal.postComposerDraft";

interface PostComposerDraft {
  body: string;
  recipeId: number | null;
  recipeTitle: string;
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
  // Recipe prefill (e.g. the recipe page's "Share your try"): the id is the
  // source of truth for recipe_id; the title is display-only.
  const params = useLocalSearchParams<{
    recipeId?: string;
    recipeTitle?: string;
  }>();

  const [body, setBody] = useState("");
  const [pickedUris, setPickedUris] = useState<string[]>([]);

  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Prefilled recipe (params): seed the selection without a search.
  useEffect(() => {
    const id = Number(params.recipeId);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedRecipe({
      id,
      title: params.recipeTitle ?? "",
      source_url: null,
      ingredients: [],
      steps: [],
      publisher_time_minutes: null,
      community_avg_minutes: null,
      cleanup_avg_minutes: null,
    });
    // Run once per param pair — params are stable for this screen's life.
  }, [params.recipeId, params.recipeTitle]);

  // Restore a persisted draft (body + attached recipe) from an earlier
  // session — e.g. an offline failure or an app kill. A recipe prefill via
  // params (recipe page's "Share your try") always wins over the draft's
  // recipe; the drafted body text is restored either way.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(POST_COMPOSER_DRAFT_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const draft = JSON.parse(raw) as PostComposerDraft;
          if (typeof draft.body === "string" && draft.body.length > 0) {
            setBody(draft.body);
          }
          const draftRecipeId = draft.recipeId;
          // A param prefill ("Share your try") wins: its effect runs on the
          // same mount, so only restore the draft's recipe when no prefill
          // was requested.
          const prefilled = (params.recipeId ?? "").trim().length > 0;
          if (
            !prefilled &&
            draftRecipeId != null &&
            Number.isFinite(draftRecipeId) &&
            draftRecipeId > 0
          ) {
            setSelectedRecipe({
              id: draftRecipeId,
              title:
                typeof draft.recipeTitle === "string" ? draft.recipeTitle : "",
              source_url: null,
              ingredients: [],
              steps: [],
              publisher_time_minutes: null,
              community_avg_minutes: null,
              cleanup_avg_minutes: null,
            });
          }
        } catch {
          // Corrupt draft: ignore it (it gets overwritten on next change).
        }
      })
      .catch(() => {
        // Best-effort: the composer works fine without a restored draft.
      });
    return () => {
      cancelled = true;
    };
    // Mount-only: params are stable for this screen's life, and the prefill
    // effect above owns param-driven selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft on every change so composed text survives offline
  // failures and app kills. An empty composer clears the stored draft.
  useEffect(() => {
    if (body.trim().length === 0 && selectedRecipe == null) {
      AsyncStorage.removeItem(POST_COMPOSER_DRAFT_KEY).catch(() => {});
      return;
    }
    const snapshot: PostComposerDraft = {
      body,
      recipeId: selectedRecipe?.id ?? null,
      recipeTitle: selectedRecipe?.title ?? "",
    };
    AsyncStorage.setItem(
      POST_COMPOSER_DRAFT_KEY,
      JSON.stringify(snapshot),
    ).catch(() => {
      // Best-effort persistence.
    });
  }, [body, selectedRecipe]);

  const [posting, setPosting] = useState(false);
  const [uploadCaption, setUploadCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  // ---- Auth gate -----------------------------------------------------------------
  // Signed-out visitors get a sign-in prompt instead of a form that 401s
  // after they've written everything. Re-checked on focus so returning
  // from /login lands back on a usable composer.
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

  // ---- Debounced recipe search (stale-response safe) ------------------------------
  // A monotonic id per query: only the LATEST search may commit results, so
  // a slow earlier response can never overwrite a newer one's rows. All
  // state updates happen inside the timer callback (never synchronously in
  // the effect body).
  const searchRequestIdRef = useRef(0);
  useEffect(() => {
    if (selectedRecipe != null) return;
    const q = recipeQuery.trim();
    const requestId = ++searchRequestIdRef.current;
    const timer = setTimeout(() => {
      if (searchRequestIdRef.current !== requestId) return;
      if (q.length === 0) {
        setRecipeResults([]);
        setRecipeSearching(false);
        return;
      }
      setRecipeSearching(true);
      searchRecipes({ q, perPage: RECIPE_PICK_RESULTS })
        .then((page) => {
          if (searchRequestIdRef.current !== requestId) return;
          setRecipeResults(page.recipes.slice(0, RECIPE_PICK_RESULTS));
        })
        .catch(() => {
          if (searchRequestIdRef.current !== requestId) return;
          setRecipeResults([]);
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setRecipeSearching(false);
          }
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
          } catch (uploadError) {
            // Draft is kept (body/pickedUris/selectedRecipe untouched):
            // surface the offline message verbatim when that's the cause.
            setError(
              uploadError instanceof OfflineError
                ? uploadError.message
                : t("community.errImageUpload"),
            );
            return;
          }
        }
      }
      setUploadCaption(null);

      const created: Post = await createPost({
        body: text,
        ...(selectedRecipe ? { recipe_id: selectedRecipe.id } : {}),
        ...(uploadedUrls.length > 0 ? { images: uploadedUrls } : {}),
      });
      track("post_created", {
        has_image: uploadedUrls.length > 0,
        image_count: uploadedUrls.length,
        has_recipe: selectedRecipe != null,
      });
      // Success: the persisted draft is stale — drop it so the next compose
      // starts clean.
      AsyncStorage.removeItem(POST_COMPOSER_DRAFT_KEY).catch(() => {});
      // Navigate back; community tab regains focus → useFocusEffect refreshes feed.
      // Web: GO_BACK can silently no-op in browsers (nothing to pop after a
      // reload/auth replace), leaving the composer open — a second Post press
      // then creates a duplicate. Routing to the feed explicitly always works;
      // the composer's only other entry (recipe share) lands on the feed too.
      if (Platform.OS === "web") {
        router.replace("/community");
      } else {
        router.back();
      }
      // Optionally surface the created post id via params for immediate prepend
      // — the focus-based refresh covers it without extra coupling.
      void created;
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
      } else if (err instanceof OfflineError) {
        // Offline (createPost is not queued): the draft stays in state AND
        // in AsyncStorage — show the retry message, never clear the text.
        setError(err.message);
      } else {
        console.warn("[RecipeReal] post creation failed:", err);
        setError(t("community.postFailed"));
      }
    } finally {
      setPosting(false);
      setUploadCaption(null);
    }
  }, [body, posting, pickedUris, selectedRecipe, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({        flex: { flex: 1 },
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

  // ---- Unsaved-changes guard -------------------------------------------------------
  // Armed once the user types anything, picks a photo or attaches a recipe;
  // covers the header ✕, Cancel button, Android back gesture and any other
  // removal of this screen.
  const dirty =
    body.trim().length > 0 ||
    pickedUris.length > 0 ||
    selectedRecipe != null;
  const navigation = useNavigation();
  // Web: never arm the guard. react-native-web's Alert.alert is a stub, so a
  // blocked removal shows NO dialog and every exit from the composer (✕, the
  // post-success navigation) is silently swallowed. The draft is already
  // persisted to AsyncStorage on every change, so nothing is lost.
  usePreventRemove(
    Platform.OS !== "web" && dirty && !posting,
    ({ data }) => {
    Alert.alert(
      t("composer.discardTitle"),
      t("composer.discardPostMessage"),
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

  // ---- Auth gate (after all hooks) ---------------------------------------------------
  if (authed === null) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      </View>
    );
  }

  if (authed === false) {
    return (
      <View style={styles.container}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: Space.md,
            padding: Space.xxl,
          }}
        >
          <Text style={[styles.attachLabel, { textAlign: "center" }]}>
            {t("community.signInPrompt")}
          </Text>
          <Button
            title={t("common.signIn")}
            variant="secondary"
            onPress={() => router.push("/login")}
          />
        </View>
      </View>
    );
  }

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
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
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
                ) : null}
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
