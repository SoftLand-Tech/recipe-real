import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  createPost,
  createPostComment,
  fetchPostComments,
  fetchPosts,
  hasToken,
  HalalRejectionError,
  PostUnauthorizedError,
  searchRecipes,
  togglePostLike,
  uploadImage,
} from "@/api/client";
import { track } from "@/analytics";
import type { Post, PostComment, PostKind, PostRecipe, Recipe } from "@/types";
import { useLang, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Avatar,
  Button,
  Card,
  Chip,
  IconPressable,
  ScreenHeader,
} from "@/components/ui";

type LoadState = "loading" | "ready" | "error";

/** Active feed filter: one of the post kinds, or all posts. */
type FeedFilter = "all" | PostKind;

const KIND_FILTERS: { value: FeedFilter; labelKey: string }[] = [
  { value: "all", labelKey: "filter.all" },
  { value: "try", labelKey: "community.kindTry" },
  { value: "fail", labelKey: "community.kindFail" },
  { value: "question", labelKey: "community.kindQuestion" },
];

/** Server-mirrored limits (POST /api/posts + comments). */
const POST_BODY_MAX = 2000;
const COMMENT_BODY_MAX = 1000;

/** Top results kept in the compose-card recipe mini picker. */
const RECIPE_PICK_RESULTS = 5;
const RECIPE_SEARCH_DEBOUNCE_MS = 350;

/**
 * Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
 * whatever the network does (force-cleared by a setTimeout guard).
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

/** Height of a post's attached photo (maxHeight per the feed spec). */
const POST_IMAGE_HEIGHT = 220;

/**
 * Compact relative timestamp ("just now", "3h ago", …) — shared shape with
 * the community-notes helper in recipe/[id].tsx. Unparsable timestamps
 * render as "" so the caption row simply hides them.
 */
function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("rel.now");
  if (mins < 60) return t("rel.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("rel.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("rel.daysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("rel.weeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("rel.monthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Display name of a post/comment author: display_name, else the account name. */
function authorName(user: Post["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Chip tone per post kind (try=success / fail=danger / question=amber). */
function kindTone(kind: PostKind): "success" | "danger" | "amber" {
  if (kind === "fail") return "danger";
  if (kind === "question") return "amber";
  return "success";
}

/** i18n key of the kind chip label. */
function kindLabelKey(kind: PostKind): string {
  if (kind === "fail") return "community.kindFail";
  if (kind === "question") return "community.kindQuestion";
  return "community.kindTry";
}

/**
 * Localized title of a post's attached recipe with the single-language
 * fallback: app language first, the other language when untranslated.
 */
function postRecipeTitle(lang: Lang, recipe: PostRecipe): string {
  return lang === "ar"
    ? (recipe.title_ar ?? recipe.title ?? "")
    : (recipe.title ?? recipe.title_ar ?? "");
}

// ---- Post card -----------------------------------------------------------------

interface PostCardProps {
  post: Post;
  /** null while the auth state is still being resolved. */
  signedIn: boolean | null;
  lang: Lang;
  onCommented: (postId: number) => void;
}

/**
 * One community post: author row + kind chip, body, optional photo and
 * attached recipe, like/comment footer, and an expandable inline comments
 * section (list + compose). Like/comment state lives here so the parent's
 * feed array only changes on data events (refresh / pagination / counts).
 */
const PostCard = memo(function PostCard({
  post,
  signedIn,
  lang,
  onCommented,
}: PostCardProps) {
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();

  // ---- Likes (optimistic, synced back from the feed row) ---------------------
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [likeBusy, setLikeBusy] = useState(false);
  // A 401 (or signed-out tap) on like/comment shows the sign-in prompt line.
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikesCount(post.likes_count);
  }, [post.liked_by_me, post.likes_count]);

  const handleLike = useCallback(async () => {
    if (likeBusy) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setLikeBusy(true);
    // Optimistic toggle; the server's answer is authoritative.
    setLiked((v) => !v);
    setLikesCount((c) => c + (liked ? -1 : 1));
    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
    } catch (error) {
      setLiked(post.liked_by_me);
      setLikesCount(post.likes_count);
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, signedIn, liked, post.id, post.liked_by_me, post.likes_count]);

  // ---- Comments (inline, oldest-first, paginated 20/page) --------------------
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentFailed, setCommentFailed] = useState(false);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  const loadComments = useCallback(
    async (targetPage: number) => {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const page = await fetchPostComments(post.id, targetPage);
        setComments((prev) =>
          targetPage === 1
            ? page.comments
            : [
                ...prev,
                ...page.comments.filter(
                  (c) => !prev.some((p) => p.id === c.id),
                ),
              ],
        );
        setCommentsPage(targetPage);
        setCommentsHasMore(page.hasMore);
      } catch (error) {
        console.warn("[RecipeReal] comments load failed:", error);
        setCommentsError(t("community.commentsLoadFailed"));
      } finally {
        setCommentsLoading(false);
      }
    },
    [post.id, t],
  );

  const toggleComments = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      if (next && commentsPage === 0 && !commentsLoading) {
        void loadComments(1);
      }
      return next;
    });
  }, [commentsPage, commentsLoading, loadComments]);

  const sendComment = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || posting) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setPosting(true);
    setCommentFailed(false);
    setHalalTerms(null);
    try {
      const created = await createPostComment(post.id, body);
      setComments((prev) => [...prev, created]);
      setDraft("");
      onCommented(post.id);
    } catch (error) {
      if (error instanceof PostUnauthorizedError) {
        setNeedsAuth(true);
      } else if (error instanceof HalalRejectionError) {
        setHalalTerms(error.terms);
      } else {
        console.warn("[RecipeReal] comment post failed:", error);
        setCommentFailed(true);
      }
    } finally {
      setPosting(false);
    }
  }, [draft, posting, signedIn, post.id, onCommented]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: Space.md,
        },
        headRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        headMain: {
          flex: 1,
          gap: 1,
        },
        author: {
          ...Type.title,
          color: colors.ink,
        },
        relTime: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        body: {
          ...Type.body,
          color: colors.ink,
        },
        photo: {
          width: "100%",
          height: POST_IMAGE_HEIGHT,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          overflow: "hidden",
        },
        recipeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          padding: Space.sm,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          alignSelf: "stretch",
        },
        recipeThumb: {
          width: 36,
          height: 36,
          borderRadius: Radius.sm,
          backgroundColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        recipeTitle: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
          flex: 1,
        },
        actionsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.lg,
        },
        action: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
        },
        actionCount: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        authPrompt: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        authText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          flex: 1,
        },
        commentsSection: {
          gap: Space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          paddingTop: Space.md,
        },
        commentRow: {
          flexDirection: "row",
          gap: Space.sm,
        },
        commentMain: {
          flex: 1,
          gap: 2,
        },
        commentHead: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        commentAuthor: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
        },
        commentTime: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        commentBody: {
          ...Type.bodySm,
          color: colors.ink,
        },
        commentMuted: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        commentError: {
          ...Type.bodySm,
          color: colors.danger,
        },
        composeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        composeInput: {
          flex: 1,
          ...Type.bodySm,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
        },
        loadMore: {
          alignSelf: "flex-start",
        },
      }),
    [colors],
  );

  const rel = relativeDate(t, post.created_at);
  const recipeRel = post.recipe;
  const title = recipeRel ? postRecipeTitle(lang, recipeRel) : "";

  return (
    <Card style={styles.card}>
      {/* Author row + kind chip. */}
      <View style={styles.headRow}>
        <Avatar
          name={authorName(post.user)}
          uri={post.user.avatar_url}
          size={36}
        />
        <View style={styles.headMain}>
          <Text style={styles.author} numberOfLines={1}>
            {authorName(post.user)}
          </Text>
          {rel !== "" ? (
            <Text style={styles.relTime}>{rel}</Text>
          ) : null}
        </View>
        <Chip
          size="sm"
          tone={kindTone(post.kind)}
          label={t(kindLabelKey(post.kind))}
        />
      </View>

      {/* Body — full text (posts are capped at 2000 chars server-side). */}
      <Text style={styles.body}>{post.body}</Text>

      {/* Optional photo. */}
      {post.image_url ? (
        <Image
          source={{ uri: post.image_url }}
          style={styles.photo}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          recyclingKey={post.image_url}
        />
      ) : null}

      {/* Optional attached recipe. */}
      {recipeRel ? (
        <IconPressable
          onPress={() => router.push(`/recipe/${recipeRel.id}`)}
          style={styles.recipeRow}
        >
          <View style={styles.recipeThumb}>
            {recipeRel.image_url ? (
              <Image
                source={{ uri: recipeRel.image_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={recipeRel.image_url}
              />
            ) : (
              <Ionicons
                name="restaurant-outline"
                size={16}
                color={colors.inkFaint}
              />
            )}
          </View>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {title}
          </Text>
          <Ionicons
            name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
            size={16}
            color={colors.inkFaint}
          />
        </IconPressable>
      ) : null}

      {/* Like / comment footer. */}
      <View style={styles.actionsRow}>
        <IconPressable
          onPress={handleLike}
          disabled={likeBusy}
          style={styles.action}
          hitSlop={Space.xs}
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={22}
            color={liked ? colors.accent : colors.inkSecondary}
          />
          <Text style={styles.actionCount}>{likesCount}</Text>
        </IconPressable>
        <IconPressable
          onPress={toggleComments}
          style={styles.action}
          hitSlop={Space.xs}
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={expanded ? colors.accent : colors.inkSecondary}
          />
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        </IconPressable>
      </View>

      {/* Sign-in prompt (401 / signed-out like or comment attempt). */}
      {needsAuth ? (
        <View style={styles.authPrompt}>
          <Text style={styles.authText}>{t("community.signInPrompt")}</Text>
          <Button
            title={t("common.signIn")}
            variant="ghost"
            onPress={() => router.push("/login")}
          />
        </View>
      ) : null}

      {/* Inline comments (oldest-first). */}
      {expanded ? (
        <View style={styles.commentsSection}>
          {commentsError != null ? (
            <View style={styles.authPrompt}>
              <Text style={styles.commentError}>{commentsError}</Text>
              <Button
                title={t("common.retry")}
                variant="ghost"
                onPress={() => void loadComments(1)}
              />
            </View>
          ) : commentsLoading && comments.length === 0 ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : comments.length === 0 ? (
            <Text style={styles.commentMuted}>
              {t("community.commentsEmpty")}
            </Text>
          ) : (
            <View style={{ gap: Space.md }}>
              {comments.map((comment) => {
                const commentRel = relativeDate(t, comment.created_at);
                return (
                  <View key={`c-${comment.id}`} style={styles.commentRow}>
                    <Avatar
                      name={authorName(comment.user)}
                      uri={comment.user.avatar_url}
                      size={24}
                    />
                    <View style={styles.commentMain}>
                      <View style={styles.commentHead}>
                        <Text style={styles.commentAuthor} numberOfLines={1}>
                          {authorName(comment.user)}
                        </Text>
                        {commentRel !== "" ? (
                          <Text style={styles.commentTime}>{commentRel}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                  </View>
                );
              })}
              {commentsHasMore ? (
                <Button
                  title={t("detail.loadMoreNotes")}
                  variant="ghost"
                  loading={commentsLoading}
                  disabled={commentsLoading}
                  onPress={() => void loadComments(commentsPage + 1)}
                  style={styles.loadMore}
                />
              ) : null}
            </View>
          )}

          {/* Compose row. */}
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("community.commentPlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={COMMENT_BODY_MAX}
              editable={!posting}
            />
            <Button
              variant="primary"
              title={t("community.commentSend")}
              loading={posting}
              disabled={posting || draft.trim().length === 0}
              onPress={() => void sendComment()}
            />
          </View>
          {halalTerms != null ? (
            <Text style={styles.commentError}>
              {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
            </Text>
          ) : null}
          {commentFailed ? (
            <Text style={styles.commentError}>
              {t("community.commentFailed")}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

// ---- Compose card ----------------------------------------------------------------

interface ComposeCardProps {
  onClose: () => void;
  onCreated: (post: Post) => void;
}

/**
 * Inline compose card rendered at the top of the feed: kind chips, body,
 * optional recipe attach (search-as-you-type mini picker) and photo, and the
 * Post action. Uploads the photo during submit (composer pattern).
 */
function ComposeCard({ onClose, onCreated }: ComposeCardProps) {
  const colors = useThemeColors();
  const t = useT();
  const lr = useLocalizedTitle();

  const [kind, setKind] = useState<PostKind>("try");
  const [body, setBody] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  // Recipe attach: query + debounced top-5 results + the selected row.
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  // Debounced recipe search (like the browse search box).
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
          // Offline / server error: show an empty picker, not a crash.
          setRecipeResults([]);
        })
        .finally(() => {
          setRecipeSearching(false);
        });
    }, RECIPE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [recipeQuery, selectedRecipe]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPickedUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn("[RecipeReal] image pick failed:", error);
    }
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
    try {
      let imageUrl: string | undefined;
      if (pickedUri) {
        try {
          imageUrl = await uploadImage(pickedUri);
        } catch {
          setError(t("composer.errImageUpload"));
          return;
        }
      }
      const created = await createPost({
        kind,
        body: text,
        ...(selectedRecipe ? { recipe_id: selectedRecipe.id } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });
      track("post_created", {
        kind,
        has_image: imageUrl != null,
        has_recipe: selectedRecipe != null,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
      } else {
        console.warn("[RecipeReal] post creation failed:", err);
        setError(t("community.postFailed"));
      }
    } finally {
      setPosting(false);
    }
  }, [body, posting, pickedUri, kind, selectedRecipe, t, onCreated]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: Space.md,
          borderWidth: 1,
          borderColor: colors.accentSoft,
        },
        title: {
          ...Type.h3,
          color: colors.ink,
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
          minHeight: 96,
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
        },
        photoPreview: {
          width: "100%",
          height: 140,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
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
      }),
    [colors],
  );

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t("community.composeTitle")}</Text>

      {/* Kind selector. */}
      <Text style={styles.attachLabel}>{t("community.composeKindHint")}</Text>
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

      {/* Body. */}
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

      {/* Optional photo. */}
      {pickedUri ? (
        <Image
          source={{ uri: pickedUri }}
          style={styles.photoPreview}
          contentFit="cover"
          transition={0}
        />
      ) : null}
      <View style={styles.photoActions}>
        <Button
          title={
            pickedUri
              ? t("composer.changeImage")
              : t("composer.addImage")
          }
          variant="ghost"
          onPress={() => void pickImage()}
          disabled={posting}
        />
        {pickedUri ? (
          <Button
            title={t("composer.removeImage")}
            variant="ghost"
            onPress={() => setPickedUri(null)}
            disabled={posting}
          />
        ) : null}
      </View>

      {/* Optional recipe attach: selected chip or search mini picker. */}
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
            <Ionicons
              name="search"
              size={16}
              color={colors.inkFaint}
            />
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

      {halalTerms != null ? (
        <Text style={styles.errorText}>
          {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
        </Text>
      ) : null}
      {error != null && halalTerms == null ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={t("common.cancel")}
          variant="ghost"
          onPress={onClose}
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
  );
}

/** Localized recipe title for the compose picker (single-language fallback). */
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

// ---- Screen ----------------------------------------------------------------------

/**
 * The Community tab: the public post feed (tries / fails / questions) with
 * kind filter chips, an inline compose card, per-post likes and inline
 * comments. Viewing is public; composing, liking and commenting require
 * sign-in (a 401 shows an inline sign-in prompt). Signed-in users also get
 * the header avatar button into /profile.
 */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang } = useLang();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);

  // Mirror of `posts` readable inside async closures without re-creating them.
  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  /**
   * Fetch one feed page for an explicit filter (avoids stale-closure races
   * when switching filters quickly). Page 1 replaces the list; later pages
   * append deduped by id.
   */
  const fetchPage = useCallback(async (target: FeedFilter, targetPage: number) => {
    if (targetPage === 1) {
      // Keep current content while silently revalidating (pull-to-refresh);
      // only a truly empty feed shows the loading state.
      if (postsRef.current.length === 0) setState("loading");
    } else {
      setLoadingMore(true);
    }
    try {
      const result = await fetchPosts(
        target === "all" ? undefined : target,
        targetPage,
      );
      setPosts((prev) =>
        targetPage === 1
          ? result.posts
          : [
              ...prev,
              ...result.posts.filter((p) => !prev.some((q) => q.id === p.id)),
            ],
      );
      setPage(targetPage);
      setHasMore(result.hasMore);
      setState("ready");
    } catch (error) {
      console.warn("[RecipeReal] community feed load failed:", error);
      if (postsRef.current.length === 0) setState("error");
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // Initial load (mount only — pull-to-refresh covers later updates).
  useEffect(() => {
    void fetchPage("all", 1);
  }, [fetchPage]);

  // Refresh the sign-in state on focus so returning from /login updates the
  // compose/avatar affordances.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) setSignedIn(ok);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const changeFilter = useCallback(
    (next: FeedFilter) => {
      if (next === filter) return;
      setFilter(next);
      setComposing(false);
      setPosts([]);
      postsRef.current = [];
      setState("loading");
      void fetchPage(next, 1);
    },
    [filter, fetchPage],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Global safety: the spinner never outlives ~10s.
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    try {
      await fetchPage(filter, 1);
    } finally {
      clearTimeout(guard);
      setRefreshing(false);
    }
  }, [filter, fetchPage]);

  const handleEndReached = useCallback(() => {
    if (state !== "ready" || loadingMore || !hasMore) return;
    void fetchPage(filter, page + 1);
  }, [state, loadingMore, hasMore, filter, page, fetchPage]);

  const bumpCommentCount = useCallback((postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p,
      ),
    );
  }, []);

  const startCompose = useCallback(() => {
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    setComposing(true);
  }, [signedIn]);

  const handleCreated = useCallback(
    (created: Post) => {
      setComposing(false);
      if (filter === "all" || filter === created.kind) {
        // Newest-first feed: the fresh post lands on top.
        setPosts((prev) => [created, ...prev]);
        setState("ready");
      } else {
        // The active filter would hide it — hop to the All feed.
        changeFilter("all");
      }
    },
    [filter, changeFilter],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        filterRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingHorizontal: Space.lg,
          paddingBottom: Space.md,
        },
        filterScroll: {
          gap: Space.sm,
          // Static paddings only (Android paint rules).
          paddingVertical: Space.xs,
        },
        filterScrollInner: {
          flexGrow: 1,
        },
        composeIcon: {
          marginEnd: Space.xs,
        },
        listContent: {
          paddingHorizontal: Space.lg,
          gap: Space.lg,
          paddingBottom: insets.bottom + Space.xxl,
        },
        center: {
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: 64,
          paddingHorizontal: Space.xxl,
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        emptyGlyph: {
          fontSize: 40,
          color: colors.inkFaint,
        },
        emptyTitle: {
          ...Type.h3,
          color: colors.ink,
        },
        emptyCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        cta: {
          marginTop: Space.sm,
        },
        footer: {
          paddingVertical: Space.lg,
        },
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("community.title")}
        right={
          signedIn === false ? null : (
            <IconPressable
              onPress={() => router.push("/profile")}
              accessibilityLabel={t("profile.title")}
              hitSlop={Space.xs}
            >
              <Ionicons
                name="person-circle-outline"
                size={26}
                color={colors.inkSecondary}
              />
            </IconPressable>
          )
        }
      />

      {/* Filter chips + the compose (FAB-like) button. */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollInner}
          contentContainerStyle={styles.filterScroll}
        >
          {KIND_FILTERS.map(({ value, labelKey }) => (
            <IconPressable
              key={value}
              onPress={() => changeFilter(value)}
              hitSlop={Space.xs}
            >
              <Chip
                label={t(labelKey)}
                tone={filter === value ? "accent" : "neutral"}
                size="sm"
              />
            </IconPressable>
          ))}
        </ScrollView>
        <Button
          title={t("community.compose")}
          onPress={startCompose}
          leftIcon={
            <Ionicons
              name="create"
              size={16}
              color={colors.surface}
              style={styles.composeIcon}
            />
          }
        />
      </View>

      <FlatList
        data={state === "ready" ? posts : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            signedIn={signedIn}
            lang={lang}
            onCommented={bumpCommentCount}
          />
        )}
        contentContainerStyle={styles.listContent}
        // Heavy photo cells: render small batches (browse pattern).
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          composing ? (
            <ComposeCard
              onClose={() => setComposing(false)}
              onCreated={handleCreated}
            />
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          state === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : state === "error" ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {t("common.somethingWentWrong")}
              </Text>
              <Text style={styles.muted}>{t("community.loadFailed")}</Text>
              <Button
                title={t("common.retry")}
                onPress={() => void fetchPage(filter, 1)}
                style={styles.cta}
              />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>💬</Text>
              <Text style={styles.emptyTitle}>{t("community.emptyTitle")}</Text>
              <Text style={styles.emptyCaption}>
                {t("community.emptyCaption")}
              </Text>
              <Button
                title={t("community.emptyCta")}
                onPress={startCompose}
                style={styles.cta}
              />
            </View>
          )
        }
      />
    </View>
  );
}
