import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";

import {
  createPostComment,
  fetchPost,
  fetchPostComments,
  hasToken,
  HalalRejectionError,
  PostUnauthorizedError,
  togglePostLike,
} from "@/api/client";
import type { Post, PostComment, PostRecipe } from "@/types";
import { useLang, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Avatar,
  Button,
  Card,
  Chip,
  IconPressable,
  ImageViewerModal,
  PostImageGrid,
  ScreenHeader,
} from "@/components/ui";

// ---- Helpers (duplicated from community.tsx for isolation) -------------------

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

function authorName(user: Post["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

function kindTone(kind: Post["kind"]): "success" | "danger" | "amber" {
  if (kind === "fail") return "danger";
  if (kind === "question") return "amber";
  return "success";
}

function kindLabelKey(kind: Post["kind"]): string {
  if (kind === "fail") return "community.kindFail";
  if (kind === "question") return "community.kindQuestion";
  return "community.kindTry";
}

function postRecipeTitle(lang: Lang, recipe: PostRecipe): string {
  return lang === "ar"
    ? (recipe.title_ar ?? recipe.title ?? "")
    : (recipe.title ?? recipe.title_ar ?? "");
}

const COMMENT_BODY_MAX = 1000;

// ---- Comment row (stateless) ------------------------------------------------

const CommentRow = memo(function CommentRow({
  comment,
}: {
  comment: PostComment;
}) {
  const colors = useThemeColors();
  const t = useT();
  const rel = relativeDate(t, comment.created_at);

  const s = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: Space.sm },
        main: { flex: 1, gap: 2 },
        head: { flexDirection: "row", alignItems: "center", gap: Space.sm },
        author: { ...Type.bodySm, fontWeight: "600", color: colors.ink },
        time: { ...Type.caption, color: colors.inkFaint },
        body: { ...Type.bodySm, color: colors.ink },
      }),
    [colors],
  );

  return (
    <View style={s.row}>
      <Avatar
        name={authorName(comment.user)}
        uri={comment.user.avatar_url}
        size={28}
      />
      <View style={s.main}>
        <View style={s.head}>
          <Text style={s.author} numberOfLines={1}>
            {authorName(comment.user)}
          </Text>
          {rel !== "" ? <Text style={s.time}>{rel}</Text> : null}
        </View>
        <Text style={s.body}>{comment.body}</Text>
      </View>
    </View>
  );
});

// ---- Post detail screen ------------------------------------------------------

type LoadState = "loading" | "ready" | "error";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang, dir } = useLang();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [post, setPost] = useState<Post | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // ---- Like state -----------------------------------------------------------
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  // ---- Comments state -------------------------------------------------------
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentFailed, setCommentFailed] = useState(false);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  // ---- Image viewer ---------------------------------------------------------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // Sync liked state once post loads.
  const postRef = useRef<Post | null>(null);

  const loadPost = useCallback(async () => {
    setLoadState("loading");
    try {
      const p = await fetchPost(postId);
      setPost(p);
      postRef.current = p;
      setLiked(p.liked_by_me);
      setLikesCount(p.likes_count);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [postId]);

  const loadComments = useCallback(
    async (targetPage: number) => {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const page = await fetchPostComments(postId, targetPage);
        setComments((prev) =>
          targetPage === 1
            ? page.comments
            : [
                ...prev,
                ...page.comments.filter((c) => !prev.some((p) => p.id === c.id)),
              ],
        );
        setCommentsPage(targetPage);
        setCommentsHasMore(page.hasMore);
      } catch {
        setCommentsError(t("community.commentsLoadFailed"));
      } finally {
        setCommentsLoading(false);
      }
    },
    [postId, t],
  );

  useEffect(() => {
    void loadPost();
    void loadComments(1);
  }, [loadPost, loadComments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await hasToken();
      if (!cancelled) setSignedIn(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLike = useCallback(async () => {
    if (!post || likeBusy) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setLikeBusy(true);
    setLiked((v) => !v);
    setLikesCount((c) => c + (liked ? -1 : 1));
    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
    } catch (error) {
      // Roll back optimistic update.
      setLiked(post.liked_by_me);
      setLikesCount(post.likes_count);
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
    } finally {
      setLikeBusy(false);
    }
  }, [post, likeBusy, signedIn, liked]);

  const sendComment = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || posting || !post) return;
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
      // Bump local counter on the post.
      setPost((p) =>
        p ? { ...p, comments_count: p.comments_count + 1 } : p,
      );
    } catch (error) {
      if (error instanceof PostUnauthorizedError) {
        setNeedsAuth(true);
      } else if (error instanceof HalalRejectionError) {
        setHalalTerms(error.terms);
      } else {
        setCommentFailed(true);
      }
    } finally {
      setPosting(false);
    }
  }, [draft, posting, post, signedIn]);

  const openViewer = useCallback((index: number) => {
    setViewerStartIndex(index);
    setViewerOpen(true);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.canvas },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          padding: Space.xxl,
        },
        errorTitle: { ...Type.h3, color: colors.danger },
        errorCaption: { ...Type.body, color: colors.inkSecondary, textAlign: "center" },
        listContent: {
          paddingHorizontal: Space.lg,
          gap: Space.lg,
          paddingBottom: insets.bottom + Space.xxl,
        },
        card: { gap: Space.md },
        headRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
        headMain: { flex: 1, gap: 1 },
        author: { ...Type.title, color: colors.ink },
        relTime: { ...Type.caption, color: colors.inkFaint },
        body: { ...Type.body, color: colors.ink },
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
        action: { flexDirection: "row", alignItems: "center", gap: Space.xs },
        actionCount: { ...Type.bodySm, color: colors.inkSecondary },
        authPrompt: { flexDirection: "row", alignItems: "center", gap: Space.sm },
        authText: { ...Type.bodySm, color: colors.inkSecondary, flex: 1 },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.hairline,
        },
        commentsHeader: {
          ...Type.h3,
          color: colors.ink,
          marginTop: Space.xs,
        },
        commentError: { ...Type.bodySm, color: colors.danger },
        commentMuted: { ...Type.bodySm, color: colors.inkSecondary },
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
        loadMore: { alignSelf: "flex-start" },
      }),
    [colors, insets.bottom],
  );

  // ---- Render states ---------------------------------------------------------

  if (loadState === "loading") {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("community.postDetail")} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      </View>
    );
  }

  if (loadState === "error" || !post) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("community.postDetail")} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.errorCaption}>{t("community.detailLoadFailed")}</Text>
          <Button title={t("common.retry")} onPress={() => void loadPost()} />
        </View>
      </View>
    );
  }

  const rel = relativeDate(t, post.created_at);
  const recipeRel = post.recipe;
  const recipeTitle = recipeRel ? postRecipeTitle(lang, recipeRel) : "";

  // The post body + recipe + images + action row rendered as the header of
  // the comments FlatList so the whole screen scrolls together.
  const ListHeader = (
    <View style={{ gap: Space.lg }}>
      <Card style={styles.card}>
        {/* Author row */}
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
            {rel !== "" ? <Text style={styles.relTime}>{rel}</Text> : null}
          </View>
          <Chip
            size="sm"
            tone={kindTone(post.kind)}
            label={t(kindLabelKey(post.kind))}
          />
        </View>

        {/* Body */}
        <Text style={styles.body}>{post.body}</Text>

        {/* Image grid */}
        {post.images.length > 0 ? (
          <PostImageGrid images={post.images} onImagePress={openViewer} />
        ) : null}

        {/* Attached recipe */}
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
              {recipeTitle}
            </Text>
            <Ionicons
              name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
              size={16}
              color={colors.inkFaint}
            />
          </IconPressable>
        ) : null}

        {/* Like row */}
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
          <View style={styles.action}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.inkSecondary}
            />
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          </View>
        </View>

        {/* Auth prompt */}
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
      </Card>

      {/* Comment compose + header */}
      <View style={{ gap: Space.md }}>
        <Text style={styles.commentsHeader}>{t("community.commentPlaceholder").replace("…", "")}</Text>
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
          <Text style={styles.commentError}>{t("community.commentFailed")}</Text>
        ) : null}
        <View style={styles.divider} />
      </View>
    </View>
  );

  const ListEmpty = commentsLoading ? (
    <View style={{ paddingVertical: Space.lg, alignItems: "center" }}>
      <ActivityIndicator color={colors.accent} size="small" />
    </View>
  ) : commentsError ? (
    <View style={styles.authPrompt}>
      <Text style={styles.commentError}>{commentsError}</Text>
      <Button
        title={t("common.retry")}
        variant="ghost"
        onPress={() => void loadComments(1)}
      />
    </View>
  ) : (
    <Text style={styles.commentMuted}>{t("community.commentsEmpty")}</Text>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("community.postDetail")} />

      <FlatList
        data={comments}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={
          commentsHasMore ? (
            <Button
              title={t("detail.loadMoreNotes")}
              variant="ghost"
              loading={commentsLoading}
              disabled={commentsLoading}
              onPress={() => void loadComments(commentsPage + 1)}
              style={styles.loadMore}
            />
          ) : null
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: Space.md }} />
        )}
        initialNumToRender={10}
        windowSize={5}
      />

      {/* Fullscreen image viewer */}
      {viewerOpen && post.images.length > 0 ? (
        <ImageViewerModal
          images={post.images}
          startIndex={viewerStartIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </View>
  );
}
