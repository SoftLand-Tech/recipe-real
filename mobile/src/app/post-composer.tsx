import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
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
  fetchMyProfile,
  getRecipe,
  hasToken,
  HalalRejectionError,
  OfflineError,
  searchRecipes,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { Post, PublicProfile, Recipe } from "@/types";
import { markPostCreated } from "@/utils/postCreated";
import { bestMinutes } from "@/utils/recipeTime";
import { useFmtMinutes, useLang, useT, type TranslateFn } from "@/i18n";
import {
  Radius,
  Shadow,
  Space,
  Type,
  useThemeColors,
  type ThemeColors,
} from "@/theme";
import {
  Avatar,
  Button,
  ComposeImageGrid,
  IconPressable,
} from "@/components/ui";

// ---- Constants ---------------------------------------------------------------

const POST_BODY_MAX = 2000;
const CHAR_COUNT_THRESHOLD = 1700;
const CHAR_COUNT_WARN = 1900;
const RECIPE_PICK_RESULTS = 6;
const RECIPE_SEARCH_DEBOUNCE_MS = 350;
const MAX_IMAGES = 6;

/**
 * AsyncStorage key for the post-composer draft. Community writes are NOT
 * offline-queued (the offline queue is cook-sessions-only), so the draft —
 * body text plus the attached recipe — is persisted on every change and
 * restored on mount. It is removed only after a successful post or an explicit
 * discard, meaning an offline failure or app kill never loses composed text.
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

// ---- Presentational helpers --------------------------------------------------

function RecipeThumb({
  uri,
  size,
  colors,
}: {
  uri?: string | null;
  size: number;
  colors: ThemeColors;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const hasUri = typeof uri === "string" && uri.trim().length > 0;
  const failed = hasUri && failedUri === uri;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radius.sm,
        backgroundColor: colors.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {hasUri && !failed ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={uri as string}
          onError={() => setFailedUri(uri as string)}
        />
      ) : (
        <Ionicons
          name="restaurant-outline"
          size={Math.round(size * 0.44)}
          color={colors.inkFaint}
        />
      )}
    </View>
  );
}

/**
 * Top-right Post pill button.
 * Android paint rules: static styles only (no Pressable style callback).
 */
function HeaderPostPill({
  label,
  ready,
  loading,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  ready: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const [pressed, setPressed] = useState(false);
  const active = ready || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={Space.xs}
      style={[
        pillStyles.headerPill,
        active
          ? { backgroundColor: colors.accent }
          : { backgroundColor: colors.surfaceSoft },
        !disabled && pressed ? pillStyles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : null}
      <Text
        style={[
          pillStyles.headerPillText,
          { color: active ? "#FFFFFF" : colors.inkFaint },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Quick attachment bar pill button.
 * Android paint rules: static styles only (no Pressable style callback).
 */
function ToolbarPill({
  icon,
  label,
  active = false,
  disabled = false,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      style={[
        pillStyles.toolbarPill,
        {
          backgroundColor: active ? colors.accentSoft : colors.surfaceSoft,
          borderColor: active ? colors.accent : colors.hairline,
        },
        disabled ? pillStyles.disabled : null,
        !disabled && pressed ? pillStyles.pressed : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? colors.accent : colors.inkSecondary}
      />
      <Text
        style={[
          pillStyles.toolbarPillText,
          { color: active ? colors.accent : colors.ink },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Compact "+ Add more" pill shown below the photo grid when < MAX_IMAGES.
 * Android paint rules: static styles only (no Pressable style callback).
 */
function AddMorePhotosPill({
  label,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        pillStyles.addMorePill,
        {
          backgroundColor: colors.surfaceSoft,
          borderColor: colors.hairline,
        },
        disabled ? pillStyles.disabled : null,
        !disabled && pressed ? pillStyles.pressed : null,
      ]}
    >
      <Ionicons name="add" size={16} color={colors.accent} />
      <Text style={[pillStyles.addMoreText, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Themed discard confirmation dialog replacing native Alert.alert.
 * Android paint rules: static styles only (no Pressable style callback).
 */
function DiscardConfirmModal({
  visible,
  onKeepEditing,
  onDiscard,
  colors,
  t,
}: {
  visible: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  colors: ThemeColors;
  t: TranslateFn;
}) {
  const [keepPressed, setKeepPressed] = useState(false);
  const [discardPressed, setDiscardPressed] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onKeepEditing}
    >
      <View style={modalStyles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onKeepEditing}
          accessible={false}
        />
        <View
          style={[
            modalStyles.card,
            Shadow.floating,
            {
              backgroundColor: colors.surface,
              borderColor: colors.hairline,
            },
          ]}
        >
          <View
            style={[
              modalStyles.iconBadge,
              { backgroundColor: colors.dangerSoft },
            ]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </View>
          <Text style={[modalStyles.title, { color: colors.ink }]}>
            {t("composer.discardPostTitle")}
          </Text>
          <Text style={[modalStyles.message, { color: colors.inkSecondary }]}>
            {t("composer.discardPostMessage")}
          </Text>
          <View style={modalStyles.actions}>
            <Pressable
              onPress={onKeepEditing}
              onPressIn={() => setKeepPressed(true)}
              onPressOut={() => setKeepPressed(false)}
              accessibilityRole="button"
              style={[
                modalStyles.btn,
                { backgroundColor: colors.surfaceSoft },
                keepPressed ? pillStyles.pressed : null,
              ]}
            >
              <Text
                style={[modalStyles.btnText, { color: colors.ink }]}
                numberOfLines={1}
              >
                {t("composer.keepEditing")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDiscard}
              onPressIn={() => setDiscardPressed(true)}
              onPressOut={() => setDiscardPressed(false)}
              accessibilityRole="button"
              style={[
                modalStyles.btn,
                { backgroundColor: colors.danger },
                discardPressed ? pillStyles.pressed : null,
              ]}
            >
              <Text
                style={[modalStyles.btnText, { color: "#FFFFFF" }]}
                numberOfLines={1}
              >
                {t("composer.discardBtn")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pillStyles = StyleSheet.create({
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
    minHeight: 36,
  },
  headerPillText: {
    ...Type.bodySm,
    fontWeight: "700",
  },
  toolbarPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  toolbarPillText: {
    ...Type.bodySm,
    fontWeight: "600",
  },
  addMorePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs + 2,
  },
  addMoreText: {
    ...Type.caption,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.45,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Space.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.xl,
    alignItems: "center",
    gap: Space.sm,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.xs,
  },
  title: {
    ...Type.h3,
    textAlign: "center",
  },
  message: {
    ...Type.bodySm,
    textAlign: "center",
    marginBottom: Space.sm,
  },
  actions: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: Space.sm,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.md,
  },
  btnText: {
    ...Type.bodySm,
    fontWeight: "700",
  },
});

// ---- Screen ------------------------------------------------------------------

/**
 * Dedicated post compose screen (/post-composer).
 *
 * Modern social post composer (Instagram/Threads/Facebook inspired) matching
 * RecipeReal's warm tokens. On successful submission it calls router.back()
 * so the community tab regains focus and paints/refreshes the new post.
 */
export default function PostComposerScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();
  const lr = useLocalizedTitle();
  const fmtMinutes = useFmtMinutes();

  // Recipe prefill (e.g. the recipe page's "Share your try"): the id is the
  // source of truth for recipe_id; the title is display-only until hydrated.
  const params = useLocalSearchParams<{
    recipeId?: string;
    recipeTitle?: string;
  }>();

  const [body, setBody] = useState("");
  const [pickedUris, setPickedUris] = useState<string[]>([]);
  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);

  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [recipeSearching, setRecipeSearching] = useState(false);
  // Prefilled recipe (params): seed the selection immediately.
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(() => {
    const id = Number(params.recipeId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      id,
      title: params.recipeTitle ?? "",
      source_url: null,
      ingredients: [],
      steps: [],
      publisher_time_minutes: null,
      community_avg_minutes: null,
      cleanup_avg_minutes: null,
    };
  });

  // Restore a persisted draft (body + attached recipe) from an earlier session.
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
          // Corrupt draft: ignore it.
        }
      })
      .catch(() => {
        // Best-effort.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate stubbed prefill/draft recipe so the attached card displays its
  // thumbnail, localized title, and cook time pill.
  const selectedRecipeId = selectedRecipe?.id ?? null;
  const selectedNeedsHydration =
    selectedRecipe != null && selectedRecipe.image_url === undefined;
  useEffect(() => {
    if (!selectedNeedsHydration || selectedRecipeId == null) return;
    let cancelled = false;
    getRecipe(selectedRecipeId)
      .then((full) => {
        if (cancelled) return;
        setSelectedRecipe((prev) =>
          prev && prev.id === full.id ? full : prev,
        );
      })
      .catch(() => {
        // Non-fatal: the prefilled title still displays cleanly.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedNeedsHydration, selectedRecipeId]);

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
      recipeTitle: selectedRecipe ? lr(selectedRecipe) : "",
    };
    AsyncStorage.setItem(
      POST_COMPOSER_DRAFT_KEY,
      JSON.stringify(snapshot),
    ).catch(() => {});
  }, [body, selectedRecipe, lr]);

  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const submitLockRef = useRef(false);
  const [uploadCaption, setUploadCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  // ---- Auth gate & profile load ---------------------------------------------
  const [authed, setAuthed] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (cancelled) return;
        setAuthed(ok);
        if (ok) {
          fetchMyProfile()
            .then((me) => {
              if (!cancelled) setMyProfile(me);
            })
            .catch(() => {
              // Non-fatal: Avatar renders fallback initial.
            });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // ---- Suggested recipes + debounced recipe search ---------------------------
  // A monotonic id per query guarantees stale responses never overwrite newer ones.
  // All setState calls run inside timer/async callbacks, never synchronously in the effect body.
  const searchRequestIdRef = useRef(0);
  useEffect(() => {
    if (!recipePickerOpen) return;
    const q = recipeQuery.trim();
    if (q.length === 0 && suggestionsLoaded) return;

    const requestId = ++searchRequestIdRef.current;
    const delay = q.length === 0 ? 0 : RECIPE_SEARCH_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      if (searchRequestIdRef.current !== requestId) return;
      setRecipeSearching(true);
      searchRecipes({
        ...(q.length > 0 ? { q } : {}),
        perPage: RECIPE_PICK_RESULTS,
      })
        .then((page) => {
          if (searchRequestIdRef.current !== requestId) return;
          const rows = page.recipes.slice(0, RECIPE_PICK_RESULTS);
          if (q.length === 0) {
            setSuggestedRecipes(rows);
            setSuggestionsLoaded(true);
          } else {
            setRecipeResults(rows);
          }
        })
        .catch(() => {
          if (searchRequestIdRef.current !== requestId) return;
          if (q.length === 0) {
            setSuggestionsLoaded(true);
          } else {
            setRecipeResults([]);
          }
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setRecipeSearching(false);
          }
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [recipePickerOpen, recipeQuery, suggestionsLoaded]);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - pickedUris.length;
    if (remaining <= 0 || posting) return;
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
        setError(null);
      }
    } catch (err) {
      console.warn("[RecipeReal] image pick failed:", err);
    }
  }, [pickedUris.length, posting]);

  const capturePhoto = useCallback(async () => {
    const remaining = MAX_IMAGES - pickedUris.length;
    if (remaining <= 0 || posting) return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError(t("composer.cameraPermDenied"));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0]?.uri;
        if (uri) {
          setPickedUris((prev) => [...prev, uri].slice(0, MAX_IMAGES));
          setError(null);
        }
      }
    } catch (err) {
      console.warn("[RecipeReal] camera capture failed:", err);
      setError(t("composer.cameraUnavailable"));
    }
  }, [pickedUris.length, posting, t]);

  const removeImage = useCallback((index: number) => {
    setPickedUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleRecipePicker = useCallback(() => {
    setRecipePickerOpen((prev) => !prev);
  }, []);

  const selectRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRecipePickerOpen(false);
    setRecipeQuery("");
  }, []);

  const clearRecipe = useCallback(() => {
    setSelectedRecipe(null);
    setRecipeQuery("");
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
    if (submitLockRef.current || posting) return;
    submitLockRef.current = true;
    setPosting(true);
    setError(null);
    setHalalTerms(null);
    setUploadCaption(null);
    let succeeded = false;
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
            setError(
              uploadError instanceof OfflineError
                ? uploadError.message
                : t("community.errImageUpload"),
            );
            return;
          }
        }
      }
      setUploadCaption(t("community.publishingPost"));

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
      succeeded = true;

      setPosted(true);
      setBody("");
      setPickedUris([]);
      setSelectedRecipe(null);
      setUploadCaption(null);
      markPostCreated(created);
      AsyncStorage.removeItem(POST_COMPOSER_DRAFT_KEY).catch(() => {});

      if (Platform.OS === "web") {
        router.replace("/community");
      } else {
        router.back();
      }
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
      } else if (err instanceof OfflineError) {
        setError(err.message);
      } else {
        console.warn("[RecipeReal] post creation failed:", err);
        setError(t("community.postFailed"));
      }
    } finally {
      if (!succeeded) {
        submitLockRef.current = false;
        setPosting(false);
        setUploadCaption(null);
      }
    }
  }, [body, posting, pickedUris, selectedRecipe, t]);

  // ---- Unsaved-changes guard + themed discard dialog ------------------------
  const dirty =
    body.trim().length > 0 ||
    pickedUris.length > 0 ||
    selectedRecipe != null;
  const navigation = useNavigation();
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const pendingNavActionRef = useRef<Parameters<typeof navigation.dispatch>[0] | null>(
    null,
  );

  const publishing = posting && !posted;
  const guardActive =
    Platform.OS !== "web" &&
    (publishing || (dirty && !posting && !posted));

  usePreventRemove(guardActive, ({ data }) => {
    if (publishing) return;
    pendingNavActionRef.current = data.action;
    setDiscardModalOpen(true);
  });

  const handleKeepEditing = useCallback(() => {
    setDiscardModalOpen(false);
    pendingNavActionRef.current = null;
  }, []);

  const handleConfirmDiscard = useCallback(() => {
    const action = pendingNavActionRef.current;
    pendingNavActionRef.current = null;
    setDiscardModalOpen(false);
    AsyncStorage.removeItem(POST_COMPOSER_DRAFT_KEY).catch(() => {});
    if (action) {
      navigation.dispatch(action);
    } else {
      router.back();
    }
  }, [navigation]);

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
        headerSideStart: {
          minWidth: 76,
          alignItems: "flex-start",
        },
        headerSideEnd: {
          minWidth: 76,
          alignItems: "flex-end",
        },
        headerTitle: {
          ...Type.title,
          color: colors.ink,
          flex: 1,
          textAlign: "center",
        },
        closeBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        closeDisabled: {
          opacity: 0.45,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.lg,
          paddingBottom: Space.xxl,
          gap: Space.md,
        },
        authorRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        authorMeta: {
          flex: 1,
          gap: 3,
          alignItems: "flex-start",
        },
        authorName: {
          ...Type.title,
          fontSize: 16,
          color: colors.ink,
        },
        audiencePill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: 2,
        },
        audienceText: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        bodyInput: {
          fontSize: 17,
          lineHeight: 24,
          color: colors.ink,
          minHeight: 130,
          paddingTop: Space.xs,
          paddingBottom: Space.sm,
          paddingHorizontal: 0,
          textAlignVertical: "top",
          textAlign: dir === "rtl" ? "right" : "left",
        },
        charCount: {
          ...Type.caption,
          alignSelf: "flex-end",
          fontVariant: ["tabular-nums"],
        },
        uploadBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.accentSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
        },
        uploadCaption: {
          ...Type.bodySm,
          color: colors.accent,
          fontWeight: "600",
          flex: 1,
        },
        errorBox: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.dangerSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
          flex: 1,
        },
        mediaSection: {
          gap: Space.sm,
        },
        attachedRecipeCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.lg,
          padding: Space.sm + 2,
        },
        attachedRecipeBody: {
          flex: 1,
          gap: 4,
          alignItems: "flex-start",
        },
        attachedRecipeTitle: {
          ...Type.bodySm,
          fontWeight: "700",
          color: colors.ink,
        },
        cookTimePill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: 2,
        },
        cookTimeText: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        removeRecipeBtn: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        pickerPanel: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.lg,
          padding: Space.md,
          gap: Space.sm,
        },
        pickerHeaderRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        pickerTitle: {
          ...Type.caption,
          fontWeight: "700",
          color: colors.inkSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        searchBox: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.md,
          paddingVertical: Space.xs + 2,
        },
        searchInput: {
          flex: 1,
          ...Type.bodySm,
          color: colors.ink,
          paddingVertical: Space.xs,
          textAlign: dir === "rtl" ? "right" : "left",
        },
        pickerLoading: {
          paddingVertical: Space.md,
          alignItems: "center",
        },
        pickerList: {
          gap: Space.xs,
        },
        candidateRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingVertical: Space.xs + 2,
          paddingHorizontal: Space.xs,
          borderRadius: Radius.md,
        },
        candidateInfo: {
          flex: 1,
          gap: 2,
          alignItems: "flex-start",
        },
        candidateTitle: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
        },
        candidateMeta: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        candidateTime: {
          ...Type.caption,
          color: colors.inkSecondary,
        },
        pickerEmpty: {
          ...Type.bodySm,
          color: colors.inkFaint,
          textAlign: "center",
          paddingVertical: Space.md,
        },
        toolbar: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          backgroundColor: colors.canvas,
          paddingHorizontal: Space.lg,
          paddingTop: Space.sm,
          paddingBottom: Math.max(insets.bottom, Space.sm),
        },
        toolbarRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        authCenter: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.md,
          padding: Space.xxl,
        },
        authPromptText: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
      }),
    [colors, insets.top, insets.bottom, dir],
  );

  // ---- Auth gate (after all hooks) ------------------------------------------
  if (authed === null) {
    return (
      <View style={styles.container}>
        <View style={styles.authCenter}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      </View>
    );
  }

  if (authed === false) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <View style={styles.headerSideStart}>
            <IconPressable
              onPress={() => router.back()}
              accessibilityLabel={t("common.cancel")}
              hitSlop={Space.xs}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.inkSecondary} />
            </IconPressable>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("composer.createPostTitle")}
          </Text>
          <View style={styles.headerSideEnd} />
        </View>
        <View style={styles.authCenter}>
          <Text style={styles.authPromptText}>
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

  const authorDisplayName = (
    myProfile?.display_name ??
    myProfile?.name ??
    ""
  ).trim();
  const canPost = !posting && !posted && body.trim().length > 0;
  const charCountColor =
    body.length >= POST_BODY_MAX
      ? colors.danger
      : body.length >= CHAR_COUNT_WARN
        ? colors.amber
        : colors.inkFaint;
  const attachedRecipeMinutes = selectedRecipe
    ? bestMinutes(selectedRecipe)
    : null;
  const atMaxImages = pickedUris.length >= MAX_IMAGES;
  const displayedRecipes =
    recipeQuery.trim().length === 0 ? suggestedRecipes : recipeResults;

  return (
    <View style={styles.container}>
      {/* Top bar: X close | centered title | prominent Post pill */}
      <View style={styles.headerBar}>
        <View style={styles.headerSideStart}>
          <IconPressable
            onPress={() => router.back()}
            disabled={posting && !posted}
            accessibilityLabel={t("common.cancel")}
            hitSlop={Space.xs}
            style={[
              styles.closeBtn,
              posting && !posted ? styles.closeDisabled : null,
            ]}
          >
            <Ionicons name="close" size={20} color={colors.inkSecondary} />
          </IconPressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("composer.createPostTitle")}
        </Text>
        <View style={styles.headerSideEnd}>
          <HeaderPostPill
            label={
              posting ? t("community.posting") : t("community.postAction")
            }
            ready={canPost}
            loading={posting}
            disabled={!canPost}
            onPress={() => void submit()}
            colors={colors}
          />
        </View>
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
          {/* Author row */}
          <View style={styles.authorRow}>
            <Avatar
              name={authorDisplayName || "?"}
              uri={myProfile?.avatar_url}
              size={42}
            />
            <View style={styles.authorMeta}>
              {authorDisplayName.length > 0 ? (
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorDisplayName}
                </Text>
              ) : null}
              <View style={styles.audiencePill}>
                <Ionicons
                  name="earth-outline"
                  size={12}
                  color={colors.inkSecondary}
                />
                <Text style={styles.audienceText} numberOfLines={1}>
                  {t("composer.audiencePublic")}
                </Text>
              </View>
            </View>
          </View>

          {/* Spacious, borderless auto-growing writing canvas */}
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder={t("community.composePlaceholder")}
            placeholderTextColor={colors.inkFaint}
            multiline
            scrollEnabled={false}
            maxLength={POST_BODY_MAX}
            editable={!posting}
            autoFocus={params.recipeId == null}
          />

          {body.length >= CHAR_COUNT_THRESHOLD ? (
            <Text style={[styles.charCount, { color: charCountColor }]}>
              {body.length} / {POST_BODY_MAX}
            </Text>
          ) : null}

          {/* Upload / publish status banner */}
          {uploadCaption != null ? (
            <View style={styles.uploadBanner}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.uploadCaption}>{uploadCaption}</Text>
            </View>
          ) : null}

          {/* Halal / validation / upload error */}
          {halalTerms != null ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>
                {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
              </Text>
            </View>
          ) : null}
          {error != null && halalTerms == null ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Attached photos preview grid + quick Add more */}
          {pickedUris.length > 0 ? (
            <View style={styles.mediaSection}>
              <ComposeImageGrid
                uris={pickedUris}
                onRemove={removeImage}
                disabled={posting}
              />
              {pickedUris.length < 4 ? (
                <AddMorePhotosPill
                  label={t("community.addMoreImages")}
                  disabled={posting}
                  onPress={() => void pickImages()}
                  colors={colors}
                />
              ) : null}
            </View>
          ) : null}

          {/* Rich attached recipe preview card */}
          {selectedRecipe ? (
            <View style={styles.attachedRecipeCard}>
              <RecipeThumb
                uri={selectedRecipe.image_url}
                size={56}
                colors={colors}
              />
              <View style={styles.attachedRecipeBody}>
                <Text style={styles.attachedRecipeTitle} numberOfLines={2}>
                  {lr(selectedRecipe)}
                </Text>
                {attachedRecipeMinutes != null ? (
                  <View style={styles.cookTimePill}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={colors.inkSecondary}
                    />
                    <Text style={styles.cookTimeText}>
                      {fmtMinutes(attachedRecipeMinutes)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <IconPressable
                onPress={clearRecipe}
                hitSlop={Space.xs}
                disabled={posting}
                accessibilityRole="button"
                accessibilityLabel={t("composer.removeRecipeA11y")}
                style={styles.removeRecipeBtn}
              >
                <Ionicons name="close" size={16} color={colors.inkSecondary} />
              </IconPressable>
            </View>
          ) : null}

          {/* Inline visual Recipe Picker panel */}
          {recipePickerOpen ? (
            <View style={styles.pickerPanel}>
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.pickerTitle}>
                  {recipeQuery.trim().length === 0
                    ? t("composer.suggestedRecipes")
                    : t("community.attachRecipe")}
                </Text>
                <IconPressable
                  onPress={() => setRecipePickerOpen(false)}
                  hitSlop={Space.xs}
                  accessibilityLabel={t("common.cancel")}
                >
                  <Ionicons
                    name="chevron-up"
                    size={18}
                    color={colors.inkSecondary}
                  />
                </IconPressable>
              </View>

              <View style={styles.searchBox}>
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
                {recipeQuery.length > 0 ? (
                  <IconPressable
                    onPress={() => setRecipeQuery("")}
                    hitSlop={Space.xs}
                    accessibilityLabel={t("common.cancel")}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.inkFaint}
                    />
                  </IconPressable>
                ) : null}
              </View>

              {recipeSearching ||
              (recipeQuery.trim().length === 0 && !suggestionsLoaded) ? (
                <View style={styles.pickerLoading}>
                  <ActivityIndicator color={colors.accent} size="small" />
                </View>
              ) : displayedRecipes.length === 0 ? (
                <Text style={styles.pickerEmpty}>
                  {t("composer.noRecipesFound")}
                </Text>
              ) : (
                <View style={styles.pickerList}>
                  {displayedRecipes.map((recipe) => {
                    const mins = bestMinutes(recipe);
                    return (
                      <IconPressable
                        key={`pick-${recipe.id}`}
                        onPress={() => selectRecipe(recipe)}
                        style={styles.candidateRow}
                        disabled={posting}
                      >
                        <RecipeThumb
                          uri={recipe.image_url}
                          size={44}
                          colors={colors}
                        />
                        <View style={styles.candidateInfo}>
                          <Text style={styles.candidateTitle} numberOfLines={1}>
                            {lr(recipe)}
                          </Text>
                          {mins != null ? (
                            <View style={styles.candidateMeta}>
                              <Ionicons
                                name="time-outline"
                                size={12}
                                color={colors.inkSecondary}
                              />
                              <Text style={styles.candidateTime}>
                                {fmtMinutes(mins)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color={colors.accent}
                        />
                      </IconPressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky quick attachment action bar */}
        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.toolbarRow}
          >
            <ToolbarPill
              icon="images-outline"
              label={t("composer.toolbarPhotos")}
              disabled={posting || atMaxImages}
              onPress={() => void pickImages()}
              colors={colors}
            />
            <ToolbarPill
              icon="camera-outline"
              label={t("composer.toolbarCamera")}
              disabled={posting || atMaxImages}
              onPress={() => void capturePhoto()}
              colors={colors}
            />
            <ToolbarPill
              icon="restaurant-outline"
              label={t("composer.toolbarTagRecipe")}
              active={recipePickerOpen || selectedRecipe != null}
              disabled={posting}
              onPress={toggleRecipePicker}
              colors={colors}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <DiscardConfirmModal
        visible={discardModalOpen}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleConfirmDiscard}
        colors={colors}
        t={t}
      />
    </View>
  );
}
