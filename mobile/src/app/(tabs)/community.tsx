import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useChromeContentBottomPad, useScrollChrome } from "@/components/chrome";

import {
  blockUser,
  deletePost,
  fetchMyProfile,
  fetchNotifications,
  fetchPosts,
  hasToken,
  PostUnauthorizedError,
  reportPost,
  togglePostLike,
} from "@/api/client";
import { shareLink } from "@/utils/share";
import { track } from "@/analytics";
import { WEB_BASE_URL } from "@/config";
import type { Post, PostRecipe, PostSort } from "@/types";
import { useLang, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  Chip,
  CommentsSheet,
  IconPressable,
  ImageViewerModal,
  PostImageGrid,
  ScreenHeader,
} from "@/components/ui";

type LoadState = "loading" | "ready" | "error";

/** Active feed ordering (see GET /api/posts?sort=). */
type FeedSort = PostSort;

/**
 * AsyncStorage key persisting the chosen sort ("latest" | "trending") so
 * the Community tab reopens the way the user left it.
 */
const SORT_PREF_KEY = "recipereal.communitySort";

/**
 * Static style for the hidden measurement Text used by the read-more body.
 * height:0 + overflow:hidden makes it invisible; pointerEvents handled by
 * wrapping View (not applicable here since Text itself cannot block touch).
 */
const measureStyle = { height: 0, opacity: 0 } as const;

/** The sort options (selected = accent). */
const SORT_OPTIONS: { value: FeedSort; labelKey: string }[] = [
  { value: "suggested", labelKey: "community.sortSuggested" },
  { value: "latest", labelKey: "community.sortLatest" },
  { value: "trending", labelKey: "community.sortTrending" },
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
  onOpenComments: (postId: number) => void;
  /**
   * Reports like changes to the FEED's post state. Without this, the like
   * lived only in the card's local state — any remount (tab switch, list
   * recycling, failed silent refresh) re-initialized from the stale parent
   * row: the heart came back blank while the server still counted you, and
   * the next tap "toggled" your existing like away (red flash → unliked).
   */
  onLiked: (postId: number, liked: boolean, likesCount: number) => void;
  /** The signed-in user's id (null while resolving) — drives the ⋯ menu. */
  myUserId: number | null;
  /** Drops the post from the feed (own delete / author blocked). */
  onRemove: (postId: number) => void;
}

/**
 * One community post: author row + kind chip, body, optional image grid and
 * attached recipe, a Facebook-style Like/Comment/Share action row, and a
 * lightweight comment preview.
 *
 * The card is tappable (routes to /post/[id]) EXCEPT:
 *   - the action row (like keeps its own handler, comment routes to the
 *     detail screen, share opens the system sheet)
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
  onOpenComments,
  onLiked,
  myUserId,
  onRemove,
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
    // Optimistic toggle; the server's answer is authoritative. Both are
    // mirrored into the FEED state so a remount can never lose the like.
    const nextLiked = !liked;
    const nextCount = likesCount + (liked ? -1 : 1);
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLiked(post.id, nextLiked, nextCount);
    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
      onLiked(post.id, result.liked, result.likes_count);
    } catch (error) {
      setLiked(post.liked_by_me);
      setLikesCount(post.likes_count);
      onLiked(post.id, post.liked_by_me, post.likes_count);
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, signedIn, liked, likesCount, post.id, post.liked_by_me, post.likes_count, onLiked]);

  // ---- Share (system sheet → public /p/{id} web page) ------------------------
  /**
   * Opens the system share sheet with the post's PUBLIC WEB PAGE
   * (https://recipe-real.softland.tech/p/{id} — a real https link with an
   * OpenGraph preview) plus the first 120 chars of the body as the message.
   * Dismissing the sheet is not an error.
   */
  const handleShare = useCallback(async () => {
    track("post_shared", { post_id: post.id });
    try {
      await shareLink(`${WEB_BASE_URL}/p/${post.id}`, post.body.slice(0, 120));
    } catch {
      // The user dismissed the sheet (or the platform errored) — best-effort.
    }
  }, [post.id, post.body]);

  // ---- Image viewer ----------------------------------------------------------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // ---- Read-more (body clamping) --------------------------------------------
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  // ---- ⋯ menu (own: delete / others: report + block) ------------------------
  const [reported, setReported] = useState(false);
  const isMine = myUserId != null && post.user.id === myUserId;

  /**
   * Bottom action-sheet state machine (replaces the old native Alerts):
   *   menu → delete | report | block (confirm sheets; the action runs after
   *   the sheet has fully dismissed). The ⋯ button opens "menu".
   */
  const [sheet, setSheet] = useState<null | "menu" | "delete" | "report" | "block">(
    null,
  );

  const openMenu = useCallback(() => setSheet("menu"), []);

  const openViewer = useCallback((index: number) => {
    setViewerStartIndex(index);
    setViewerOpen(true);
  }, []);

  // ---- Latest comment preview ------------------------------------------------
  // Embedded in the feed row by the server (PostResource `latest_comment`,
  // eager-loaded per page) — no per-card comments fetch anymore. Null when
  // the post has no comments (the preview row simply hides).
  const latestComment = post.latest_comment;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: Space.sm,
          padding: Space.md,
          borderRadius: 0,
        },
        headRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        headMain: {
          flex: 1,
          gap: 2,
        },
        author: {
          ...Type.title,
          color: colors.ink,
          flexShrink: 1,
        },
        relRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        relTime: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        globeIcon: {
          marginTop: 1,
        },
        reportedCaption: {
          ...Type.caption,
          color: colors.success,
          marginTop: -Space.xs,
          marginStart: Space.xs,
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
        // Facebook counts row — likes left, comments right, hairline top
        countsRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Space.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        },
        countsLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        countsText: {
          ...Type.caption,
          color: colors.inkSecondary,
        },
        actionsRow: {
          flexDirection: "row",
          alignItems: "center",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
          marginHorizontal: -Space.md,
          paddingHorizontal: Space.md,
        },
        action: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: Space.sm + 2,
        },
        actionCount: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.inkSecondary,
        },
        actionCountActive: {
          color: colors.accent,
        },
        authPrompt: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingTop: Space.xs,
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
          paddingTop: Space.sm,
        },
        previewBubble: {
          flex: 1,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs + 2,
        },
        previewText: {
          ...Type.bodySm,
          color: colors.ink,
          flex: 1,
        },
        viewThread: {
          ...Type.caption,
          color: colors.inkSecondary,
          marginTop: 2,
        },
        seeMore: {
          ...Type.bodySm,
          color: colors.inkSecondary,
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
      <Card shadow="none" style={styles.card}>
        {/* Header: avatar 40 | name + time·globe | menu — Facebook layout */}
        <View style={styles.headRow}>
          <IconPressable onPress={() => router.push(`/user/${post.user.id}`)} hitSlop={Space.xs}>
            <Avatar name={authorName(post.user)} uri={post.user.avatar_url} size={40} />
          </IconPressable>
          <View style={styles.headMain}>
            <Text style={styles.author} numberOfLines={1}>
              {authorName(post.user)}
            </Text>
            <View style={styles.relRow}>
              {rel !== "" ? (
                <Text style={styles.relTime}>{rel}</Text>
              ) : null}
              {rel !== "" ? (
                <Text style={styles.relTime}> · </Text>
              ) : null}
              <Ionicons
                name="earth-outline"
                size={12}
                color={colors.inkFaint}
                style={styles.globeIcon}
              />
            </View>
          </View>
          <IconPressable
            onPress={openMenu}
            accessibilityLabel={t("community.postActions")}
            accessibilityRole="button"
            hitSlop={12}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={reported ? colors.success : colors.inkSecondary}
            />
          </IconPressable>
        </View>
        {reported ? (
          <Text style={styles.reportedCaption}>
            {t("community.reported")} ✓
          </Text>
        ) : null}

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

        {/* Counts row — taps open comments sheet */}
        {(likesCount > 0 || post.comments_count > 0) ? (
          <IconPressable
            onPress={() => onOpenComments(post.id)}
            style={styles.countsRow}
            hitSlop={Space.xs}
          >
            <View style={styles.countsLeft}>
              {likesCount > 0 ? (
                <>
                  <Ionicons name="heart" size={14} color={colors.accent} />
                  <Text style={styles.countsText}>{likesCount}</Text>
                </>
              ) : (
                <View />
              )}
            </View>
            {post.comments_count > 0 ? (
              <Text style={styles.countsText}>
                {post.comments_count === 1 ? "1 comment" : `${post.comments_count} comments`}
              </Text>
            ) : null}
          </IconPressable>
        ) : null}

        {/* Action row — Facebook 3 equal tabs with dividers */}
        <View style={styles.actionsRow}>
          <IconPressable
            onPress={handleLike}
            disabled={likeBusy}
            style={styles.action}
            hitSlop={Space.xs}
            accessibilityLabel="Like"
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? colors.accent : colors.inkSecondary}
            />
            <Text style={[styles.actionCount, liked ? styles.actionCountActive : null]}>Like</Text>
          </IconPressable>
          <IconPressable
            onPress={() => onOpenComments(post.id)}
            style={styles.action}
            hitSlop={Space.xs}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.inkSecondary}
            />
            <Text style={styles.actionCount}>Comment</Text>
          </IconPressable>
          <IconPressable
            onPress={() => void handleShare()}
            style={styles.action}
            hitSlop={Space.xs}
            accessibilityLabel={t("community.shareA11y")}
          >
            <Ionicons
              name="arrow-redo-outline"
              size={20}
              color={colors.inkSecondary}
            />
            <Text style={styles.actionCount}>Share</Text>
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

        {/* Comment preview — taps open comments sheet */}
        {latestComment != null ? (
          <View style={{ gap: Space.xs }}>
            <IconPressable
              onPress={() => onOpenComments(post.id)}
              style={styles.previewRow}
            >
              <Avatar name={authorName(latestComment.user)} uri={latestComment.user.avatar_url} size={28} />
              <View style={styles.previewBubble}>
                <Text style={styles.previewText} numberOfLines={2}>
                  <Text style={{ fontWeight: "700" }}>{authorName(latestComment.user)} </Text>
                  {latestComment.body}
                </Text>
              </View>
            </IconPressable>
            {post.comments_count > 1 ? (
              <IconPressable onPress={() => onOpenComments(post.id)} hitSlop={Space.xs}>
                <Text style={styles.viewThread}>{t("community.viewAllComments", { n: post.comments_count })}</Text>
              </IconPressable>
            ) : null}
          </View>
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

      {/* Post actions bottom sheet — one step of the state machine at a
          time. The key remounts the sheet per step, so each one plays its
          own enter animation after the previous one dropped away. */}
      {sheet === "menu" ? (
        <ActionSheet
          key="menu"
          visible
          onClose={() => setSheet(null)}
          title={t("community.postActions")}
          actions={
            isMine
              ? [
                  {
                    key: "delete",
                    label: t("community.deletePost"),
                    icon: "trash-outline",
                    tone: "destructive",
                    onPress: () => setSheet("delete"),
                  },
                ]
              : [
                  {
                    key: "report",
                    label: t("community.reportPost"),
                    icon: "flag-outline",
                    onPress: () => setSheet("report"),
                  },
                  {
                    key: "block",
                    label: t("community.blockUser"),
                    icon: "ban-outline",
                    tone: "destructive",
                    onPress: () => setSheet("block"),
                  },
                ]
          }
        />
      ) : null}
      {sheet === "delete" ? (
        <ActionSheet
          key="delete"
          visible
          onClose={() => setSheet(null)}
          title={t("community.deletePost")}
          message={t("community.deletePostConfirm")}
          actions={[
            {
              key: "confirm",
              label: t("common.delete"),
              icon: "trash-outline",
              tone: "destructive",
              onPress: () => {
                deletePost(post.id)
                  .then(() => onRemove(post.id))
                  .catch(() => {
                    // Non-fatal: the focus refresh will reconcile with the server.
                  });
              },
            },
          ]}
        />
      ) : null}
      {sheet === "report" ? (
        <ActionSheet
          key="report"
          visible
          onClose={() => setSheet(null)}
          title={t("community.reportPost")}
          message={t("community.reportConfirm")}
          actions={[
            {
              key: "confirm",
              label: t("community.reportPost"),
              icon: "flag-outline",
              onPress: () => {
                reportPost(post.id)
                  .then(() => setReported(true))
                  .catch(() => {
                    // Non-fatal.
                  });
              },
            },
          ]}
        />
      ) : null}
      {sheet === "block" ? (
        <ActionSheet
          key="block"
          visible
          onClose={() => setSheet(null)}
          title={t("community.blockUser")}
          message={t("community.blockConfirm", {
            name: authorName(post.user),
          })}
          actions={[
            {
              key: "confirm",
              label: t("community.blockBtn"),
              icon: "ban-outline",
              tone: "destructive",
              onPress: () => {
                blockUser(post.user.id)
                  .then(() => onRemove(post.id))
                  .catch(() => {
                    // Non-fatal.
                  });
              },
            },
          ]}
        />
      ) : null}
    </>
  );
});

// ---- Screen ----------------------------------------------------------------------

/**
 * The Community tab: the public post feed with per-post likes and a
 * lightweight comment preview. Tapping a post card navigates to the post
 * detail screen where the full comment thread lives. Viewing is public;
 * composing and liking require sign-in.
 */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang } = useLang();
  const chrome = useScrollChrome();
  const chromeBottomPad = useChromeContentBottomPad();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [chipHeight, setChipHeight] = useState(0);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Signed-in user's id — resolves own-vs-other for the per-card ⋯ menu.
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<number | null>(null);
  // Feed ordering: "suggested" (default) | "latest" | "trending"; persisted.
  const [sort, setSort] = useState<FeedSort>("suggested");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Header-bell badge: unread likes/comments on the user's own posts.
  const [unreadCount, setUnreadCount] = useState(0);

  // Mirror of `posts` readable inside async closures without re-creating them.
  const postsRef = useRef<Post[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const sortRef = useRef<FeedSort>("suggested");
  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);

  /** Sort of the newest issued fetch (dropping stale responses). */
  const feedKeyRef = useRef("suggested");

  /**
   * Fetch one feed page for the current sort. Page 1 replaces the list;
   * later pages append deduped by id.
   */
  const fetchPage = useCallback(
    async (targetPage: number, sortOverride?: FeedSort) => {
      const activeSort = sortOverride ?? sortRef.current;
      const feedKey = activeSort;
      feedKeyRef.current = feedKey;
      if (targetPage === 1) {
        if (postsRef.current.length === 0) setState("loading");
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await fetchPosts(targetPage, activeSort);
        // Stale combo: the user moved on to another filter/sort — drop it.
        if (feedKeyRef.current !== feedKey) return;
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
        if (feedKeyRef.current !== feedKey) return;
        console.warn("[RecipeReal] community feed load failed:", error);
        if (postsRef.current.length === 0) setState("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [],
  );

  // Restore the persisted sort preference, then load page 1 with it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(SORT_PREF_KEY);
      } catch {
        // Best-effort: fall through with the default sort.
      }
      if (cancelled) return;
      const initial: FeedSort = (stored === "trending" || stored === "suggested") ? (stored as FeedSort) : "suggested";
      sortRef.current = initial;
      setSort(initial);
      void fetchPage(1, initial);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  // On every focus: refresh auth state, the unread bell count AND silently
  // reload feed page 1. This covers returning from /post-composer (new post
  // visible at top), /notifications (badge re-syncs after mark-read) and
  // /login (compose affordance unlocks) without extra event coupling.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await hasToken();
        if (!cancelled) setSignedIn(ok);
        // The signed-in user's id drives the per-card ⋯ menu (own vs other).
        if (ok) {
          fetchMyProfile()
            .then((me) => {
              if (!cancelled) {
                setMyUserId(me.id);
                setMyAvatar(me.avatar_url ?? null);
                setMyName(me.display_name ?? me.name ?? null);
              }
            })
            .catch(() => {
              // Non-fatal: cards just won't show the own-post menu.
            });
        } else if (!cancelled) {
          setMyUserId(null);
          setMyAvatar(null);
          setMyName(null);
        }
        // Cheap inbox page 1 fetch: only the meta.unread_count is used.
        if (ok) {
          fetchNotifications(1)
            .then((inbox) => {
              if (!cancelled) setUnreadCount(inbox.unreadCount);
            })
            .catch(() => {
              // Non-fatal: the badge just stays at its last value.
            });
        } else if (!cancelled) {
          setUnreadCount(0);
        }
      })();
      // Silent feed refresh on re-focus.
      void fetchPage(1);
      return () => {
        cancelled = true;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchPage]),
  );

  /**
   * Switch the feed ordering: persists the choice, clears the list and
   * refetches page 1 with the new sort param.
   */
  const changeSort = useCallback(
    (next: FeedSort) => {
      if (next === sort) return;
      setSort(next);
      AsyncStorage.setItem(SORT_PREF_KEY, next).catch(() => {
        // Best-effort persistence.
      });
      setPosts([]);
      postsRef.current = [];
      setState("loading");
      void fetchPage(1, next);
    },
    [sort, fetchPage],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    try {
      await fetchPage(1);
    } finally {
      clearTimeout(guard);
      setRefreshing(false);
    }
  }, [fetchPage]);

  const handleEndReached = useCallback(() => {
    if (state !== "ready" || loadingMore || !hasMore) return;
    void fetchPage(page + 1);
  }, [state, loadingMore, hasMore, page, fetchPage]);

  const bumpCommentCount = useCallback((postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p,
      ),
    );
  }, []);

  /**
   * Mirrors like changes into the feed's post rows (see PostCardProps).
   * Identity-stable so the memoized cards don't re-render needlessly.
   */
  const applyLikeState = useCallback(
    (postId: number, liked: boolean, likesCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked_by_me: liked, likes_count: likesCount } : p,
        ),
      );
    },
    [],
  );

  /** Drops a post from the feed after its own deletion or an author block. */
  const removePost = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const startCompose = useCallback(() => {
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    router.push("/post-composer");
  }, [signedIn]);

  const openComments = useCallback((postId: number) => {
    setCommentsPostId(postId);
  }, []);

  const closeComments = useCallback(() => {
    setCommentsPostId(null);
  }, []);

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
          paddingHorizontal: 0,
          gap: Space.xs,
          paddingBottom: insets.bottom + Space.xxl,
        },
        chromeHeader: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: colors.canvas,
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

        cta: {
          marginTop: Space.md,
        },
        footer: {
          paddingVertical: Space.lg,
        },
        // ---- Header bell + unread badge ------------------------------------
        bellWrap: {
          // Sized box so the absolutely-positioned badge anchors to the
          // glyph, not the 40dp header circle.
          width: 26,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
        },
        badge: {
          // Logical `end`/`top` keep the badge on the correct corner in RTL.
          position: "absolute",
          top: -3,
          end: -7,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: colors.danger,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 3,
        },
        badgeText: {
          // White on the danger red reads in both light and dark themes.
          fontSize: 10,
          fontWeight: "700",
          color: "#FFFFFF",
          letterSpacing: 0,
        },
        // Composer entry card — Facebook style top of feed
        composerCard: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.surface,
          borderRadius: 0,
          padding: Space.sm + 2,
          marginHorizontal: 0,
          marginBottom: Space.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
        composerGhost: {
          flex: 1,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm + 2,
        },
        composerGhostText: {
          ...Type.body,
          color: colors.inkFaint,
        },
        composerPhotoBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        // Skeleton card
        skeletonCard: {
          backgroundColor: colors.surface,
          borderRadius: 0,
          padding: Space.md,
          gap: Space.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairline,
        },
        skeletonRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        skeletonAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surfaceSoft,
        },
        skeletonLine: {
          height: 12,
          borderRadius: 6,
          backgroundColor: colors.surfaceSoft,
        },
        skeletonImage: {
          height: 180,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
        },
        fab: {
          position: "absolute",
          end: Space.lg,
          bottom: insets.bottom + Space.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
      }),
    [colors, insets.bottom],
  );

  const totalHeader = headerHeight + chipHeight;

  return (
    <View style={styles.container}>
      {/* Sticky filter chips - slides to top when header hides */}
      <Animated.View
        onLayout={(e) => setChipHeight(e.nativeEvent.layout.height)}
        style={{
          position: "absolute",
          top: headerHeight,
          left: 0,
          right: 0,
          zIndex: 9,
          backgroundColor: colors.canvas,
          transform: [
            {
              translateY: chrome.hidden.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -headerHeight],
              }),
            },
          ],
        }}
      >
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollInner}
            contentContainerStyle={styles.filterScroll}
          >
            {SORT_OPTIONS.map(({ value, labelKey }) => (
              <IconPressable
                key={value}
                onPress={() => changeSort(value)}
                hitSlop={Space.xs}
              >
                <Chip
                  label={t(labelKey)}
                  tone={sort === value ? "accent" : "neutral"}
                  size="sm"
                />
              </IconPressable>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
      {/* Static padding + TRANSFORM lift (community pattern): the padding
          sits on a NON-scrolling container (the chip row doesn't scroll),
          so without the lift a header-tall gap stays under the chips when
          the header hides; translateY is native-driver-safe. The NEGATIVE
          bottom margin extends the wrapper under the absolute tab bar by
          the same height, so the lifted wrapper covers the full screen —
          without it, the translate exposed a header-tall empty band at the
          bottom of the list (the wrapper moved but its height didn't
          grow). Bottom-clearing padding lives on the scroller itself. */}
      <Animated.View
        style={{
          flex: 1,
          paddingTop: totalHeader,
          marginBottom: -headerHeight,
          transform: [
            {
              translateY: chrome.hidden.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -headerHeight],
              }),
            },
          ],
        }}
      >

        {/* Composer entry — Facebook top-of-feed card */}
        <IconPressable onPress={startCompose} style={styles.composerCard} hitSlop={Space.xs}>
          <Avatar
            name={myName ?? "?"}
            uri={myAvatar}
            size={36}
          />
          <View style={styles.composerGhost}>
            <Text style={styles.composerGhostText} numberOfLines={1}>
              {signedIn ? t("community.compose") : t("community.signInPrompt")}
            </Text>
          </View>
          <View style={styles.composerPhotoBtn}>
            <Ionicons name="image-outline" size={20} color={colors.accent} />
          </View>
        </IconPressable>

        <FlatList
        data={state === "ready" ? posts : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            signedIn={signedIn}
            lang={lang}
            onCommented={bumpCommentCount}
            onOpenComments={openComments}
            onLiked={applyLikeState}
            myUserId={myUserId}
            onRemove={removePost}
          />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          // Clear the ABSOLUTE tab-bar overlay (measured height + room).
          { paddingBottom: chromeBottomPad },
        ]}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
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
            <View style={{ paddingHorizontal: 0, gap: Space.xs }}>
              {[0, 1, 2].map((k) => (
                <View key={k} style={styles.skeletonCard}>
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonAvatar} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={[styles.skeletonLine, { width: "40%" }]} />
                      <View style={[styles.skeletonLine, { width: "25%", height: 10 }]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonLine, { width: "95%" }]} />
                  <View style={[styles.skeletonLine, { width: "80%" }]} />
                  <View style={styles.skeletonImage} />
                </View>
              ))}
            </View>
          ) : state === "error" ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {t("common.somethingWentWrong")}
              </Text>
              <Text style={styles.muted}>{t("community.loadFailed")}</Text>
              <Button
                title={t("common.retry")}
                onPress={() => void fetchPage(1)}
                style={styles.cta}
              />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>💬</Text>
              <Text style={styles.emptyTitle}>{t("community.emptyTitle")}</Text>
              <Button
                title={t("community.emptyBeFirst")}
                onPress={startCompose}
                style={styles.cta}
              />
            </View>
          )
        }
      />
      </Animated.View>
      <Animated.View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[
          styles.chromeHeader,
          {
            transform: [
              {
                translateY: chrome.hidden.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -headerHeight],
                }),
              },
            ],
          },
        ]}
      >
        <ScreenHeader
          title={t("community.title")}
          rights={
            signedIn === false
              ? undefined
              : [
                  <IconPressable
                    key="bell"
                    onPress={() => router.push("/notifications")}
                    accessibilityLabel={
                      unreadCount > 0
                        ? `${t("notif.bellA11y")} · ${t("notif.unreadA11y", { n: unreadCount })}`
                        : t("notif.bellA11y")
                    }
                    hitSlop={Space.xs}
                  >
                    <View style={styles.bellWrap}>
                      <Ionicons
                        name="notifications-outline"
                        size={24}
                        color={colors.inkSecondary}
                      />
                      {unreadCount > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </IconPressable>,
                  <IconPressable
                    key="profile"
                    onPress={() => router.push("/profile")}
                    accessibilityLabel={t("profile.title")}
                    hitSlop={Space.xs}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={26}
                      color={colors.inkSecondary}
                    />
                  </IconPressable>,
                ]
          }
        />
      </Animated.View>

      {/* FAB — Facebook one-handed compose */}
      <IconPressable
        onPress={startCompose}
        hitSlop={Space.xs}
        accessibilityLabel={t("community.compose")}
        style={styles.fab}
      >
        <Ionicons name="create-outline" size={24} color="#FFFFFF" />
      </IconPressable>

      <CommentsSheet
        postId={commentsPostId}
        visible={commentsPostId != null}
        onClose={closeComments}
        myAvatar={myAvatar}
        myName={myName}
        onCommented={bumpCommentCount}
      />
    </View>
  );
}
