import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import type { Post, PostKind, PostRecipe, PostSort } from "@/types";
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

const KIND_FILTERS: { value: FeedFilter; labelKey: string }[] = [
  { value: "all", labelKey: "filter.all" },
  { value: "try", labelKey: "community.kindTry" },
  { value: "fail", labelKey: "community.kindFail" },
  { value: "question", labelKey: "community.kindQuestion" },
];

/** The sort pair rendered next to the kind chips (selected = accent). */
const SORT_OPTIONS: { value: FeedSort; labelKey: string }[] = [
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

  // ---- Image viewer ----------------------------------------------------------
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // ---- Read-more (body clamping) --------------------------------------------
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyOverflows, setBodyOverflows] = useState(false);

  // ---- ⋯ menu (own: delete / others: report + block) ------------------------
  const [reported, setReported] = useState(false);
  const isMine = myUserId != null && post.user.id === myUserId;

  const confirmDelete = useCallback(() => {
    Alert.alert(t("community.deletePost"), t("community.deletePostConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deletePost(post.id)
            .then(() => onRemove(post.id))
            .catch(() => {
              // Non-fatal: the focus refresh will reconcile with the server.
            });
        },
      },
    ]);
  }, [post.id, onRemove, t]);

  const confirmBlock = useCallback(() => {
    Alert.alert(
      t("community.blockUser"),
      t("community.blockConfirm", { name: authorName(post.user) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("community.blockBtn"),
          style: "destructive",
          onPress: () => {
            blockUser(post.user.id)
              .then(() => onRemove(post.id))
              .catch(() => {
                // Non-fatal.
              });
          },
        },
      ],
    );
  }, [post.user.id, post.id, onRemove, t]);

  const openMenu = useCallback(() => {
    if (isMine) {
      Alert.alert(t("community.postActions"), undefined, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("community.deletePost"), style: "destructive", onPress: confirmDelete },
      ]);
      return;
    }
    Alert.alert(t("community.postActions"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("community.reportPost"),
        onPress: () => {
          Alert.alert(t("community.reportPost"), t("community.reportConfirm"), [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("community.reportPost"),
              onPress: () => {
                reportPost(post.id)
                  .then(() => setReported(true))
                  .catch(() => {
                    // Non-fatal.
                  });
              },
            },
          ]);
        },
      },
      { text: t("community.blockUser"), style: "destructive", onPress: confirmBlock },
    ]);
  }, [isMine, confirmDelete, confirmBlock, post.id, t]);

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
        // Name + kind badge share one line (badge hugs the name, not the
        // row end); the name shrinks first on narrow screens.
        nameRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
        },
        author: {
          ...Type.title,
          color: colors.ink,
          flexShrink: 1,
        },
        relTime: {
          ...Type.caption,
          color: colors.inkFaint,
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
              <View style={styles.nameRow}>
                <Text style={styles.author} numberOfLines={1}>
                  {authorName(post.user)}
                </Text>
                <Chip
                  size="sm"
                  tone={kindTone(post.kind)}
                  label={t(kindLabelKey(post.kind))}
                />
              </View>
              {rel !== "" ? (
                <Text style={styles.relTime}>{rel}</Text>
              ) : null}
            </View>
            <IconPressable
              onPress={openMenu}
              accessibilityLabel={t("community.postActions")}
              accessibilityRole="button"
              hitSlop={Space.xs}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={reported ? colors.success : colors.inkSecondary}
              />
            </IconPressable>
          </View>
        </IconPressable>
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
  // Signed-in user's id — resolves own-vs-other for the per-card ⋯ menu.
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  // Feed ordering: "latest" (default) or "trending"; persisted in
  // AsyncStorage and restored on mount.
  const [sort, setSort] = useState<FeedSort>("latest");
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

  // Mirrors of `filter`/`sort` readable inside stable closures (the focus
  // effect's callback identity never changes, so it must read these instead
  // of capturing stale state).
  const filterRef = useRef<FeedFilter>("all");
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);
  const sortRef = useRef<FeedSort>("latest");
  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);

  /**
   * The (filter, sort) pair of the NEWEST issued fetch. A response landing
   * after the user switched the filter or the sort is dropped, so a slow
   * request can never repaint the wrong feed.
   */
  const feedKeyRef = useRef("all:latest");

  /**
   * Fetch one feed page for an explicit filter + sort (avoids stale-closure
   * races when switching them quickly). Page 1 replaces the list; later
   * pages append deduped by id.
   */
  const fetchPage = useCallback(
    async (target: FeedFilter, targetPage: number, sortOverride?: FeedSort) => {
      const activeSort = sortOverride ?? sortRef.current;
      const feedKey = `${target}:${activeSort}`;
      feedKeyRef.current = feedKey;
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
          activeSort,
        );
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
  // (pull-to-refresh and the focus effect cover later updates).
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
      const initial: FeedSort = stored === "trending" ? "trending" : "latest";
      sortRef.current = initial;
      setSort(initial);
      void fetchPage("all", 1, initial);
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
              if (!cancelled) setMyUserId(me.id);
            })
            .catch(() => {
              // Non-fatal: cards just won't show the own-post menu.
            });
        } else if (!cancelled) {
          setMyUserId(null);
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
      // Silent feed refresh on re-focus (does not show spinner for non-empty
      // feeds). Refs, not captured state: this callback's identity never
      // changes, so it must read the CURRENT filter + sort.
      void fetchPage(filterRef.current, 1);
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

  /**
   * Switch the feed ordering (Latest / Top this week): persists the choice,
   * clears the list and refetches page 1 with the new sort param.
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
      void fetchPage(filterRef.current, 1, next);
    },
    [sort, fetchPage],
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
        // Hairline separator between the kind chips and the sort pair
        // (stretches to the row height; chips align flex-start).
        filterDivider: {
          width: StyleSheet.hairlineWidth,
          alignSelf: "stretch",
          backgroundColor: colors.hairline,
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
        // Cold-start explainer: the three post kinds as small rows.
        emptyKinds: {
          gap: Space.xs,
          marginTop: Space.sm,
          alignSelf: "stretch",
        },
        emptyKindRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
        },
        emptyKindGlyph: {
          fontSize: 16,
        },
        emptyKindLabel: {
          ...Type.bodySm,
          fontWeight: "600",
          flex: 1,
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
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("community.title")}
        rights={
          signedIn === false
            ? undefined
            : [
                // Notification bell → /notifications. The little red badge
                // shows the unread count (capped at 99+).
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
                // Profile → /profile (kept from before; bell sits before it).
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
          {/* Sort pair (Latest / Top this week) after a hairline divider. */}
          <View style={styles.filterDivider} />
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
            onLiked={applyLikeState}
            myUserId={myUserId}
            onRemove={removePost}
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
              {/* Cold-start explainer: the three kinds of post, tone-matched
                  to their chips, so newcomers know what belongs here. */}
              <View style={styles.emptyKinds}>
                {(
                  [
                    { glyph: "✅", labelKey: "community.kindTry", tone: colors.success },
                    { glyph: "❌", labelKey: "community.kindFail", tone: colors.danger },
                    { glyph: "❓", labelKey: "community.kindQuestion", tone: colors.amber },
                  ] as const
                ).map(({ glyph, labelKey, tone }) => (
                  <View key={labelKey} style={styles.emptyKindRow}>
                    <Text style={styles.emptyKindGlyph}>{glyph}</Text>
                    <Text style={[styles.emptyKindLabel, { color: tone }]}>
                      {t(labelKey)}
                    </Text>
                  </View>
                ))}
              </View>
              <Button
                title={t("community.emptyBeFirst")}
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
