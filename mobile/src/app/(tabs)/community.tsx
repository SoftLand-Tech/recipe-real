import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  fetchPostComments,
  fetchPosts,
  hasToken,
  PostUnauthorizedError,
  togglePostLike,
} from "@/api/client";
import type { Post, PostComment, PostKind, PostRecipe } from "@/types";
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

type LoadState = "loading" | "ready" | "error";

/** Active feed filter: one of the post kinds, or all posts. */
type FeedFilter = "all" | PostKind;

/**
 * Static style for the hidden measurement Text used by the read-more body.
 * height:0 + overflow:hidden makes it invisible; pointerEvents handled by
 * wrapping View (not applicable here since Text itself cannot block touch).
 */
const measureStyle = { height: 0, opacity: 0 } as const;

const KIND_FILTERS: { value: FeedFilter; labelKey: string }[] = [
  { value: "all", labelKey: "filter.all" },
  { value: "try", labelKey: "community.kindTry" },
  { value: "fail", labelKey: "community.kindFail" },
  { value: "question", labelKey: "community.kindQuestion" },
];


/**
 * Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
 * whatever the network does (force-cleared by a setTimeout guard).
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

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
 * One community post: author row + kind chip, body, optional image grid and
 * attached recipe, like/comment footer, and a lightweight comment preview.
 *
 * The card is tappable (routes to /post/[id]) EXCEPT:
 *   - the like button (keeps its own handler)
 *   - image cells (open the fullscreen viewer)
 *
 * Comment thread has moved to the post detail screen; the card shows a
 * lightweight preview (comment count + latest comment body) instead.
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

  // ---- Image viewer ----------------------------------------------------------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // ---- Read-more (body clamping) --------------------------------------------
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  const openViewer = useCallback((index: number) => {
    setViewerStartIndex(index);
    setViewerOpen(true);
  }, []);

  // ---- Latest comment preview (loaded once on render, best-effort) ----------
  const [latestComment, setLatestComment] = useState<PostComment | null>(null);
  useEffect(() => {
    if (post.comments_count === 0) return;
    let cancelled = false;
    fetchPostComments(post.id, 1)
      .then((page) => {
        if (!cancelled && page.comments.length > 0) {
          setLatestComment(page.comments[page.comments.length - 1] ?? null);
        }
      })
      .catch(() => {
        // Non-fatal: preview just doesn't show.
      });
    return () => {
      cancelled = true;
    };
  }, [post.id, post.comments_count]);

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
        previewRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Space.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          paddingTop: Space.sm,
        },
        previewText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          flex: 1,
        },
        viewThread: {
          ...Type.bodySm,
          color: colors.accent,
        },
        seeMore: {
          ...Type.bodySm,
          color: colors.accent,
          marginTop: 2,
        },
      }),
    [colors],
  );

  const rel = relativeDate(t, post.created_at);
  const recipeRel = post.recipe;
  const title = recipeRel ? postRecipeTitle(lang, recipeRel) : "";

  return (
    <>
      <Card style={styles.card}>
        {/* Author row + kind chip. */}
        <IconPressable onPress={() => router.push(`/post/${post.id}`)}>
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
        </IconPressable>

        {/* Body — clamped to 3 lines; "See more" expands inline.
            We use a hidden unclamped Text for line-count measurement (onTextLayout
            only reports clamped lines when numberOfLines is set, so we measure
            separately). The hidden Text has height:0 and pointerEvents="none"
            so it is invisible and non-interactive. */}
        <IconPressable onPress={() => router.push(`/post/${post.id}`)}>
          {/* Hidden measurement text — no numberOfLines, no height */}
          <Text
            style={[styles.body, measureStyle]}
            numberOfLines={undefined}
            onTextLayout={(e) => {
              setBodyOverflows(e.nativeEvent.lines.length > 3);
            }}
            aria-hidden
          >
            {post.body}
          </Text>
          {/* Visible clamped text */}
          <Text
            style={styles.body}
            numberOfLines={bodyExpanded ? undefined : 3}
          >
            {post.body}
          </Text>
          {bodyOverflows && !bodyExpanded ? (
            <IconPressable
              onPress={() => setBodyExpanded(true)}
              hitSlop={Space.xs}
            >
              <Text style={styles.seeMore}>{t("community.seeMore")}</Text>
            </IconPressable>
          ) : null}
          {bodyExpanded ? (
            <IconPressable
              onPress={() => setBodyExpanded(false)}
              hitSlop={Space.xs}
            >
              <Text style={styles.seeMore}>{t("community.seeLess")}</Text>
            </IconPressable>
          ) : null}
        </IconPressable>

        {/* Optional multi-image grid (cells are NOT wrapped in the card tappable). */}
        {post.images.length > 0 ? (
          <PostImageGrid images={post.images} onImagePress={openViewer} />
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
          {/* Like button — NOT wrapped in the card pressable. */}
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
          {/* Comment tap → post detail. */}
          <IconPressable
            onPress={() => router.push(`/post/${post.id}`)}
            style={styles.action}
            hitSlop={Space.xs}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.inkSecondary}
            />
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          </IconPressable>
        </View>

        {/* Sign-in prompt (401 / signed-out like attempt). */}
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

        {/* Lightweight comment preview: latest comment + count. */}
        {latestComment != null ? (
          <IconPressable
            onPress={() => router.push(`/post/${post.id}`)}
            style={styles.previewRow}
          >
            <Text style={styles.previewText} numberOfLines={2}>
              <Text style={{ fontWeight: "600" }}>
                {authorName(latestComment.user)}{" "}
              </Text>
              {latestComment.body}
            </Text>
            {post.comments_count > 1 ? (
              <Text style={styles.viewThread}>
                {t("community.viewAllComments", { n: post.comments_count })}
              </Text>
            ) : null}
          </IconPressable>
        ) : null}
      </Card>

      {/* Fullscreen image viewer (rendered outside Card to avoid clip). */}
      {viewerOpen && post.images.length > 0 ? (
        <ImageViewerModal
          images={post.images}
          startIndex={viewerStartIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
});

// ---- Screen ----------------------------------------------------------------------

/**
 * The Community tab: the public post feed (tries / fails / questions) with
 * kind filter chips, an inline compose card, per-post likes and a lightweight
 * comment preview. Tapping a post card navigates to the post detail screen
 * (/post/[id]) where the full comment thread lives. Viewing is public;
 * composing and liking require sign-in (a 401 shows an inline sign-in prompt).
 * Signed-in users also get the header avatar button into /profile.
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

  // On every focus: refresh auth state AND silently reload feed page 1.
  // This covers returning from /post-composer (new post visible at top) and
  // from /login (compose affordance unlocks) without extra event coupling.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) setSignedIn(ok);
      })();
      // Silent feed refresh on re-focus (does not show spinner for non-empty feeds).
      void fetchPage(filter, 1);
      return () => {
        cancelled = true;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchPage]),
  );

  const changeFilter = useCallback(
    (next: FeedFilter) => {
      if (next === filter) return;
      setFilter(next);
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
    // Push the dedicated compose screen; on back, useFocusEffect refreshes the feed.
    router.push("/post-composer");
  }, [signedIn]);

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
          icon="create"
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
        ListHeaderComponent={null}
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
