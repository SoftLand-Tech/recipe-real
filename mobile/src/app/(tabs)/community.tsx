import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
  PinnedHeaderBar,
  useChromeContentBottomPad,
  usePinnedBarPad,
  useScrollChrome,
} from "@/components/chrome";

import {
  blockUser,
  deletePost,
  fetchMyProfile,
  fetchNotifications,
  fetchPosts,
  followUser,
  getAuthEpoch,
  hasToken,
  PostUnauthorizedError,
  reportPost,
  togglePostLike,
  unfollowUser,
} from "@/api/client";
import { shareLink } from "@/utils/share";
import { consumePostCreated } from "@/utils/postCreated";
import {
  consumeFeedMutations,
  type FeedMutation,
} from "@/utils/feedMutation";
import {
  COMMUNITY_FEED_KEY,
  incrementMirroredCommentCount,
  patchMirroredFollow,
  patchMirroredPost,
  removeMirroredPost,
  writeMirroredFeed,
} from "@/utils/communityMirror";
import { setPostPreview } from "@/utils/postPreview";
import { track } from "@/analytics";
import { WEB_BASE_URL } from "@/config";
import type { Post, PostRecipe, PostSort } from "@/types";
import { useLang, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors, type ThemeColors } from "@/theme";
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
 * Envelope stored under COMMUNITY_FEED_KEY (see @/utils/communityMirror):
 * the last successful feed page-1 (Home's `recipereal.homeRails` pattern),
 * painted instantly on a cold mount while the normal network refresh
 * revalidates behind it. The `sort` field keeps one ordering's rows from
 * ever painting under another chip. Cleared on sign-out (account-scoped)
 * by the api client.
 */
interface CachedCommunityFeed {
  sort: FeedSort;
  posts: Post[];
}

/**
 * Focus-refetch throttle window: the silent feed refetch on tab focus is
 * skipped while the last SUCCESSFUL page-1 refresh is younger than this.
 */
const FEED_REFETCH_THROTTLE_MS = 60_000;

/**
 * Module-level stamp of the last successful page-1 feed refresh (survives
 * tab remounts, resets naturally on app restart). Profile + notifications
 * focus refreshes are deliberately NOT throttled.
 */
let lastFeedRefreshAt = 0;

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


const EMPTY_POSTS: Post[] = [];
const FLEX_ONE_STYLE = { flex: 1 } as const;
const SKELETON_INDICES = [0, 1, 2] as const;
const SKELETON_LIST_STYLE = { paddingHorizontal: 0, gap: Space.xs } as const;
const SKELETON_COL_STYLE = { flex: 1, gap: 6 } as const;
const SKELETON_W40_STYLE = { width: "40%" } as const;
const SKELETON_W25_STYLE = { width: "25%", height: 10 } as const;
const SKELETON_W95_STYLE = { width: "95%" } as const;
const SKELETON_W80_STYLE = { width: "80%" } as const;
const BODY_MEASURE_MIN_CHARS = 120;

function postKeyExtractor(item: Post): string {
  return String(item.id);
}

function createPostCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    // Facebook-style follow pill on the author row: accent-filled =
    // "Follow" CTA; quiet soft + hairline = "Following".
    followBtn: {
      height: 30,
      paddingHorizontal: Space.md,
      borderRadius: Radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    followBtnOn: {
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    followBtnTextOn: {
      color: colors.inkSecondary,
    },
    menuBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
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
    seeMore: {
      ...Type.bodySm,
      color: colors.inkSecondary,
      marginTop: 2,
    },
  });
}

const postCardStylesCache = new WeakMap<
  ThemeColors,
  ReturnType<typeof createPostCardStyles>
>();

function getPostCardStyles(colors: ThemeColors) {
  let cached = postCardStylesCache.get(colors);
  if (!cached) {
    cached = createPostCardStyles(colors);
    postCardStylesCache.set(colors, cached);
  }
  return cached;
}

/** Safety cap for the pull-to-refresh spinner: it must never outlive ~10s
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
  /**
   * Mirrors follow toggles into the FEED's post state (every row by the
   * same author), same rationale as onLiked — card-local state alone
   * resets on remount/recycling.
   */
  onFollowed: (userId: number, following: boolean) => void;
  /**
   * In-flight optimistic like registry (owned by the feed screen): while a
   * like request is pending for this post, prop syncs and background
   * refreshes must not overwrite the optimistic heart.
   */
  isLikePending: (postId: number) => boolean;
  markLikePending: (postId: number, liked: boolean, likesCount: number) => void;
  clearLikePending: (postId: number) => void;
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
  onFollowed,
  isLikePending,
  markLikePending,
  clearLikePending,
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
    // While this card's like request is in flight, the optimistic heart
    // wins over prop syncs (background refreshes rebase around it too).
    if (isLikePending(post.id)) return;
    setLiked(post.liked_by_me);
    setLikesCount(post.likes_count);
  }, [post.id, post.liked_by_me, post.likes_count, isLikePending]);

  const handleLike = useCallback(async () => {
    if (likeBusy) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setLikeBusy(true);
    // Optimistic toggle; the server's answer is authoritative. Both are
    // mirrored into the FEED state so a remount can never lose the like.
    // The pre-toggle values are captured for rollback — the render-closure
    // props may have moved on by failure time (background refresh), and
    // rolling back to those would wipe newer server state.
    const prevLiked = liked;
    const prevCount = likesCount;
    const nextLiked = !liked;
    const nextCount = likesCount + (liked ? -1 : 1);
    setLiked(nextLiked);
    setLikesCount(nextCount);
    markLikePending(post.id, nextLiked, nextCount);
    onLiked(post.id, nextLiked, nextCount);
    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
      onLiked(post.id, result.liked, result.likes_count);
    } catch (error) {
      setLiked(prevLiked);
      setLikesCount(prevCount);
      onLiked(post.id, prevLiked, prevCount);
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
    } finally {
      clearLikePending(post.id);
      setLikeBusy(false);
    }
  }, [likeBusy, signedIn, liked, likesCount, post.id, onLiked, markLikePending, clearLikePending]);

  // ---- Follow (Facebook-style pill on the author row) ------------------------
  const [following, setFollowing] = useState(Boolean(post.user.followed_by_me));
  const [followBusy, setFollowBusy] = useState(false);
  useEffect(() => {
    setFollowing(Boolean(post.user.followed_by_me));
  }, [post.user.followed_by_me]);

  const handleFollow = useCallback(() => {
    if (followBusy) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setFollowBusy(true);
    // Optimistic toggle mirrored into the feed (every row of this author),
    // reverted on failure — the onLiked pattern.
    const next = !following;
    setFollowing(next);
    onFollowed(post.user.id, next);
    (next ? followUser(post.user.id) : unfollowUser(post.user.id))
      .then(() => {
        track(next ? "user_followed" : "user_unfollowed", { user_id: post.user.id });
      })
      .catch(() => {
        setFollowing(!next);
        onFollowed(post.user.id, !next);
      })
      .finally(() => setFollowBusy(false));
  }, [followBusy, signedIn, following, post.user.id, onFollowed]);

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
  const canOverflow = post.body.length > BODY_MEASURE_MIN_CHARS;

  const openDetail = useCallback(() => {
    // Pass the feed's full Post to the detail screen for an instant
    // paint; the detail revalidates from the network behind it.
    setPostPreview(post);
    router.push(`/post/${post.id}`);
  }, [post]);

  const handleBodyTextLayout = useCallback(
    (e: { nativeEvent: { lines: unknown[] } }) => {
      setBodyOverflows(e.nativeEvent.lines.length > 3);
    },
    [],
  );

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

  const styles = getPostCardStyles(colors);

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
          {/* Follow pill (hidden on your own posts) — Facebook pattern:
              filled accent = follow CTA, quiet hairline = already following. */}
          {!isMine ? (
            <Pressable
              onPress={handleFollow}
              disabled={followBusy}
              accessibilityRole="button"
              accessibilityLabel={
                following ? t("profile.unfollow") : t("profile.follow")
              }
              hitSlop={Space.xs}
              style={[
                styles.followBtn,
                following ? styles.followBtnOn : null,
              ]}
            >
              <Text
                style={[
                  styles.followBtnText,
                  following ? styles.followBtnTextOn : null,
                ]}
                numberOfLines={1}
              >
                {following ? t("profile.following") : t("profile.follow")}
              </Text>
            </Pressable>
          ) : null}
          <IconPressable
            onPress={openMenu}
            accessibilityLabel={t("community.postActions")}
            accessibilityRole="button"
            hitSlop={12}
            style={styles.menuBtn}
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
        <Pressable onPress={openDetail}>
          {/* Hidden measurement text — mounted only for bodies long enough to wrap >3 lines */}
          {canOverflow ? (
            <Text
              style={[styles.body, measureStyle]}
              numberOfLines={undefined}
              onTextLayout={handleBodyTextLayout}
              aria-hidden
            >
              {post.body}
            </Text>
          ) : null}
          {/* Visible clamped text */}
          <Text
            style={styles.body}
            numberOfLines={bodyExpanded ? undefined : 3}
          >
            {post.body}
          </Text>
          {canOverflow && bodyOverflows && !bodyExpanded ? (
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
        </Pressable>

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
                {post.comments_count === 1
                  ? t("community.commentCountOne")
                  : t("community.commentCount", { n: post.comments_count })}
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
            accessibilityLabel={t("community.likeAction")}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? colors.accent : colors.inkSecondary}
            />
            <Text style={[styles.actionCount, liked ? styles.actionCountActive : null]}>
              {t("community.likeAction")}
            </Text>
          </IconPressable>
          <IconPressable
            onPress={() => onOpenComments(post.id)}
            style={styles.action}
            hitSlop={Space.xs}
            accessibilityLabel={t("community.commentAction")}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.inkSecondary}
            />
            <Text style={styles.actionCount}>{t("community.commentAction")}</Text>
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
            <Text style={styles.actionCount}>{t("community.shareAction")}</Text>
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

// ---- Comments sheet controller --------------------------------------------------

interface CommentsControllerHandle {
  open: (postId: number) => void;
}

interface CommunityCommentsControllerProps {
  myAvatar: string | null;
  myName: string | null;
  onCommented: (postId: number) => void;
}

/**
 * Isolates CommentsSheet visibility/postId state from CommunityScreen so opening
 * or closing comments does not re-render the FlatList or its PostCards.
 */
const CommunityCommentsController = memo(
  forwardRef<CommentsControllerHandle, CommunityCommentsControllerProps>(
    function CommunityCommentsController({ myAvatar, myName, onCommented }, ref) {
      const [postId, setPostId] = useState<number | null>(null);

      useImperativeHandle(
        ref,
        () => ({
          open: (nextPostId: number) => setPostId(nextPostId),
        }),
        [],
      );

      const close = useCallback(() => setPostId(null), []);

      return (
        <CommentsSheet
          postId={postId}
          visible={postId != null}
          onClose={close}
          myAvatar={myAvatar}
          myName={myName}
          onCommented={onCommented}
        />
      );
    },
  ),
);

interface SortCacheEntry {
  posts: Post[];
  hasMore: boolean;
  page: number;
  fetchedAt: number;
}

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
  const barPad = usePinnedBarPad();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Signed-in user's id — resolves own-vs-other for the per-card ⋯ menu.
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const commentsRef = useRef<CommentsControllerHandle>(null);
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
  // Transient post-compose notice above the feed: "loading" while the
  // forced page-1 refresh is in flight (a slow network stays visible),
  // "done" once it lands, then auto-dismissed.
  const [postedNotice, setPostedNotice] = useState<
    "idle" | "loading" | "done"
  >("idle");

  // Auto-dismiss the posted confirmation once the refreshed feed has landed.
  useEffect(() => {
    if (postedNotice !== "done") return;
    const timer = setTimeout(() => setPostedNotice("idle"), 3200);
    return () => clearTimeout(timer);
  }, [postedNotice]);

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

  /** Per-sort in-memory cache so switching sort tabs paints immediately. */
  const sortCacheRef = useRef(new Map<FeedSort, SortCacheEntry>());
  const authEpochRef = useRef(getAuthEpoch());

  /** Tracks initial focus so mount does not duplicate the cold-mount fetch. */
  const didMountFocusRef = useRef(false);

  const updateAllSortCaches = useCallback((transform: (rows: Post[]) => Post[]) => {
    sortCacheRef.current.forEach((entry, key) => {
      sortCacheRef.current.set(key, { ...entry, posts: transform(entry.posts) });
    });
  }, []);

  /**
   * In-flight optimistic like toggles: post id → the toggled-to state.
   * A background page-1 refresh landing mid-request must not clobber the
   * optimistic heart (it would flip back despite the server counting the
   * like), and the card's prop-sync effect must not fight the toggle.
   */
  const pendingLikesRef = useRef(new Map<number, { liked: boolean; count: number }>());

  /** Re-apply in-flight optimistic likes over freshly fetched rows. */
  const rebasePendingLikes = useCallback((rows: Post[]): Post[] => {
    const pending = pendingLikesRef.current;
    if (pending.size === 0) return rows;
    return rows.map((p) => {
      const optimistic = pending.get(p.id);
      return optimistic
        ? { ...p, liked_by_me: optimistic.liked, likes_count: optimistic.count }
        : p;
    });
  }, []);

  /**
   * Apply one feed-mutation marker to a row list (shared by the in-memory
   * feed and the AsyncStorage mirror patch below).
   */
  const applyMutation = useCallback((rows: Post[], m: FeedMutation): Post[] => {
    switch (m.type) {
      case "patch-post":
        return rows.map((p) =>
          p.id === m.postId ? { ...p, ...m.patch } : p,
        );
      case "remove-post":
        return rows.filter((p) => p.id !== m.postId);
      case "follow":
        return rows.map((p) =>
          p.user.id === m.userId
            ? { ...p, user: { ...p.user, followed_by_me: m.following } }
            : p,
        );
    }
  }, []);

  /**
   * Fetch one feed page for the current sort. Page 1 replaces the list;
   * later pages append deduped by id.
   */
  const fetchPage = useCallback(
    async (targetPage: number, sortOverride?: FeedSort) => {
      const activeSort = sortOverride ?? sortRef.current;
      const feedKey = activeSort;
      feedKeyRef.current = feedKey;
      const prevRefreshAt = lastFeedRefreshAt;
      if (targetPage === 1) {
        // Stamp at start so concurrent focus/mount paths don't duplicate page 1.
        lastFeedRefreshAt = Date.now();
        if (postsRef.current.length === 0) setState("loading");
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await fetchPosts(targetPage, activeSort);
        // Stale combo: the user moved on to another filter/sort — drop it.
        if (feedKeyRef.current !== feedKey) return;
        // A refresh landing mid-like must not clobber the optimistic heart.
        const rows = rebasePendingLikes(result.posts);
        const now = Date.now();
        if (targetPage === 1) {
          postsRef.current = rows;
          setPosts(rows);
          lastFeedRefreshAt = now;
          sortCacheRef.current.set(activeSort, {
            posts: rows,
            hasMore: result.hasMore,
            page: 1,
            fetchedAt: now,
          });
          void writeMirroredFeed(activeSort, rows);
        } else {
          setPosts((prev) => {
            const next = [
              ...prev,
              ...rows.filter((p) => !prev.some((q) => q.id === p.id)),
            ];
            postsRef.current = next;
            const prevEntry = sortCacheRef.current.get(activeSort);
            sortCacheRef.current.set(activeSort, {
              posts: next,
              hasMore: result.hasMore,
              page: targetPage,
              fetchedAt: prevEntry?.fetchedAt ?? now,
            });
            return next;
          });
        }
        setPage(targetPage);
        setHasMore(result.hasMore);
        setState("ready");
      } catch (error) {
        if (feedKeyRef.current !== feedKey) return;
        if (targetPage === 1 && prevRefreshAt === 0 && postsRef.current.length === 0) {
          lastFeedRefreshAt = prevRefreshAt;
        }
        console.warn("[RecipeReal] community feed load failed:", error);
        if (postsRef.current.length === 0) setState("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [rebasePendingLikes],
  );

  // Restore the persisted sort preference and cached mirror in parallel, then load page 1
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pairs, ok] = await Promise.all([
        AsyncStorage.multiGet([SORT_PREF_KEY, COMMUNITY_FEED_KEY]).catch(
          () =>
            [
              [SORT_PREF_KEY, null],
              [COMMUNITY_FEED_KEY, null],
            ] as [string, string | null][],
        ),
        hasToken().catch(() => false),
      ]);
      if (cancelled) return;
      const pairMap = new Map(pairs);
      const stored = pairMap.get(SORT_PREF_KEY) ?? null;
      const rawMirror = pairMap.get(COMMUNITY_FEED_KEY) ?? null;
      const initial: FeedSort =
        stored === "trending" || stored === "suggested" || stored === "latest"
          ? stored
          : "suggested";
      sortRef.current = initial;
      setSort(initial);
      // Instant paint from the feed mirror (homeRails pattern): only on a
      // cold mount with nothing on screen, and only when signed in — the
      // normal refresh right after revalidates. The envelope's sort guards
      // against painting one ordering's rows under another chip.
      if (postsRef.current.length === 0 && ok && rawMirror) {
        try {
          const parsed = JSON.parse(rawMirror) as Partial<CachedCommunityFeed>;
          const mirrored = Array.isArray(parsed?.posts) ? parsed.posts : [];
          if (
            mirrored.length > 0 &&
            (parsed.sort == null || parsed.sort === initial)
          ) {
            // Update the ref too so the fetch below stays SILENT — it
            // only flips to "loading" when the visible feed is empty.
            postsRef.current = mirrored;
            setPosts(mirrored);
            setState("ready");
            sortCacheRef.current.set(initial, {
              posts: mirrored,
              hasMore: true,
              page: 1,
              fetchedAt: 0,
            });
          }
        } catch {
          // Corrupt/unreadable mirror — ignore; the fetch is authoritative.
        }
      }
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
      // Silent feed refresh on re-focus — throttled: when the last
      // SUCCESSFUL page-1 refresh is under a minute old, the feed is fresh
      // enough and the refetch is skipped (the profile + notifications
      // refreshes above still run on every focus). Pull-to-refresh and sort
      // switches bypass the throttle by design.
      //
      // Returning from a successful compose: on the `latest` sort the created
      // post is painted at the top IMMEDIATELY — it was persisted before the
      // redirect, so there is nothing to wait for. On ranked sorts
      // (suggested/trending) it is NOT pinned — a zero-engagement post has
      // no earned rank there, and pinning would misrank the feed; the
      // confirmation banner + forced refresh are the acknowledgment. The
      // background page-1 refresh reconciles the rest of the feed either
      // way. (The backend forgets the author's cached page-1 feed on
      // create, so the refresh includes the write.)
      //
      // Writes made on OTHER screens (post-detail likes/comments/edits/
      // deletes, profile follows) arrive as feed-mutation markers: they are
      // applied to the rows immediately for the same reason — the focus
      // refresh below is throttled, and without the instant paint the write
      // would look undone for up to 60s.
      const currentAuthEpoch = getAuthEpoch();
      const authChanged = currentAuthEpoch !== authEpochRef.current;
      if (authChanged) {
        authEpochRef.current = currentAuthEpoch;
        sortCacheRef.current.clear();
      }
      const isInitialFocus = !didMountFocusRef.current;
      didMountFocusRef.current = true;
      const mutations = consumeFeedMutations();
      if (mutations.length > 0) {
        const applyAll = (input: Post[]) => {
          let next = input;
          for (const m of mutations) next = applyMutation(next, m);
          return next;
        };
        const rows = applyAll(postsRef.current);
        postsRef.current = rows;
        setPosts(rows);
        updateAllSortCaches(applyAll);
        if (rows.length > 0) setState("ready");
        // Mirror the applied mutations so a restart paints them too.
        void writeMirroredFeed(sortRef.current, rows);
      }
      const justPosted = consumePostCreated();
      if (justPosted) {
        if (sortRef.current === "latest") {
          const withPost = [
            justPosted,
            ...postsRef.current.filter((p) => p.id !== justPosted.id),
          ];
          postsRef.current = withPost;
          setPosts(withPost);
          setState("ready");
          sortCacheRef.current.set("latest", {
            posts: withPost,
            hasMore: true,
            page: 1,
            fetchedAt: Date.now(),
          });
          void writeMirroredFeed(sortRef.current, withPost);
        } else {
          sortCacheRef.current.delete("latest");
        }
        setPostedNotice("loading");
        void fetchPage(1).finally(() => {
          if (cancelled) return;
          // Re-pin only on latest (see above); the ref/mirror sync is
          // deferred out of the updater (StrictMode-safe).
          if (sortRef.current === "latest") {
            setPosts((prev) => {
              const next =
                prev.some((p) => p.id === justPosted.id)
                  ? prev
                  : [justPosted, ...prev];
              queueMicrotask(() => {
                postsRef.current = next;
                const entry = sortCacheRef.current.get("latest");
                if (entry) {
                  sortCacheRef.current.set("latest", { ...entry, posts: next });
                }
                void writeMirroredFeed(sortRef.current, next);
              });
              return next;
            });
          }
          setPostedNotice("done");
        });
      } else if (
        authChanged ||
        (!isInitialFocus &&
          (mutations.length > 0 ||
            Date.now() - lastFeedRefreshAt >= FEED_REFETCH_THROTTLE_MS))
      ) {
        void fetchPage(1);
      }
      return () => {
        cancelled = true;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchPage]),
  );

  /**
   * Switch the feed ordering: persists the choice, paints immediately from
   * the per-sort cache if available, and refetches page 1 when uncached or stale.
   */
  const changeSort = useCallback(
    (next: FeedSort) => {
      if (next === sortRef.current) return;
      sortRef.current = next;
      setSort(next);
      AsyncStorage.setItem(SORT_PREF_KEY, next).catch(() => {
        // Best-effort persistence.
      });
      const cached = sortCacheRef.current.get(next);
      if (cached) {
        feedKeyRef.current = next;
        postsRef.current = cached.posts;
        setPosts(cached.posts);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setState("ready");
        if (Date.now() - cached.fetchedAt >= FEED_REFETCH_THROTTLE_MS) {
          void fetchPage(1, next);
        }
        return;
      }
      setPosts([]);
      postsRef.current = [];
      setPage(1);
      setHasMore(false);
      setState("loading");
      void fetchPage(1, next);
    },
    [fetchPage],
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

  const bumpCommentCount = useCallback(
    (postId: number) => {
      const transform = (rows: Post[]) =>
        rows.map((p) =>
          p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p,
        );
      setPosts(transform);
      updateAllSortCaches(transform);
      // Mirror the count so a restart paints it (see communityMirror).
      void incrementMirroredCommentCount(postId);
    },
    [updateAllSortCaches],
  );

  /** In-flight optimistic like registry passed down to the cards (see ref). */
  const isLikePending = useCallback(
    (postId: number) => pendingLikesRef.current.has(postId),
    [],
  );
  const markLikePending = useCallback(
    (postId: number, liked: boolean, likesCount: number) => {
      pendingLikesRef.current.set(postId, { liked, count: likesCount });
    },
    [],
  );
  const clearLikePending = useCallback((postId: number) => {
    pendingLikesRef.current.delete(postId);
  }, []);

  /**
   * Mirrors like changes into the feed's post rows (see PostCardProps).
   * Identity-stable so the memoized cards don't re-render needlessly.
   */
  const applyLikeState = useCallback(
    (postId: number, liked: boolean, likesCount: number) => {
      const transform = (rows: Post[]) =>
        rows.map((p) =>
          p.id === postId ? { ...p, liked_by_me: liked, likes_count: likesCount } : p,
        );
      setPosts(transform);
      updateAllSortCaches(transform);
      // Mirror the authoritative state so a restart paints it.
      void patchMirroredPost(postId, {
        liked_by_me: liked,
        likes_count: likesCount,
      });
    },
    [updateAllSortCaches],
  );

  /**
   * Mirrors follow toggles into every feed row by the same author (the
   * onLiked pattern): a remount or recycled card must never show a stale
   * Follow state for an author just followed/unfollowed.
   */
  const applyFollowState = useCallback(
    (userId: number, following: boolean) => {
      const transform = (rows: Post[]) =>
        rows.map((p) =>
          p.user.id === userId
            ? { ...p, user: { ...p.user, followed_by_me: following } }
            : p,
        );
      setPosts(transform);
      updateAllSortCaches(transform);
      // Mirror every affected row so a restart paints the pill correctly.
      void patchMirroredFollow(userId, following);
    },
    [updateAllSortCaches],
  );

  /** Drops a post from the feed after its own deletion or an author block. */
  const removePost = useCallback(
    (postId: number) => {
      const transform = (rows: Post[]) => rows.filter((p) => p.id !== postId);
      setPosts(transform);
      updateAllSortCaches(transform);
      void removeMirroredPost(postId);
    },
    [updateAllSortCaches],
  );

  const startCompose = useCallback(() => {
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    router.push("/post-composer");
  }, [signedIn]);

  const openComments = useCallback((postId: number) => {
    commentsRef.current?.open(postId);
  }, []);

  const retryFirstPage = useCallback(() => {
    void fetchPage(1);
  }, [fetchPage]);

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
          paddingTop: Space.xs,
          paddingBottom: Space.sm,
        },
        postedBanner: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "center",
          gap: Space.xs,
          marginTop: Space.sm,
          marginHorizontal: Space.lg,
          paddingVertical: Space.sm - 2,
          paddingHorizontal: Space.md,
          borderRadius: Radius.pill,
          backgroundColor: colors.successSoft,
        },
        postedBannerText: {
          ...Type.bodySm,
          color: colors.success,
          fontWeight: "600",
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
        pinnedBar: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
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
      }),
    [colors, insets.bottom],
  );

  const filterChips = useMemo(
    () => (
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
    ),
    [styles.filterRow, styles.filterScrollInner, styles.filterScroll, sort, changeSort, t],
  );

  const composerCard = useMemo(
    () => (
      /* Composer entry — Facebook top-of-feed card */
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
    ),
    [
      startCompose,
      styles.composerCard,
      styles.composerGhost,
      styles.composerGhostText,
      styles.composerPhotoBtn,
      myName,
      myAvatar,
      signedIn,
      t,
      colors.accent,
    ],
  );

  const listData = state === "ready" ? posts : EMPTY_POSTS;

  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        signedIn={signedIn}
        lang={lang}
        onCommented={bumpCommentCount}
        onOpenComments={openComments}
        onLiked={applyLikeState}
        onFollowed={applyFollowState}
        myUserId={myUserId}
        onRemove={removePost}
        isLikePending={isLikePending}
        markLikePending={markLikePending}
        clearLikePending={clearLikePending}
      />
    ),
    [
      signedIn,
      lang,
      bumpCommentCount,
      openComments,
      applyLikeState,
      applyFollowState,
      myUserId,
      removePost,
      isLikePending,
      markLikePending,
      clearLikePending,
    ],
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      // Clear the ABSOLUTE tab-bar overlay + pinned bar (measured).
      { paddingTop: barPad, paddingBottom: chromeBottomPad },
    ],
    [styles.listContent, barPad, chromeBottomPad],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
        progressBackgroundColor={colors.surface}
      />
    ),
    [refreshing, handleRefresh, colors.accent, colors.surface],
  );

  const listHeader = useMemo(
    () => (
      <>
        {postedNotice !== "idle" ? (
          <View
            style={styles.postedBanner}
            accessibilityLiveRegion="polite"
          >
            {postedNotice === "loading" ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
            )}
            <Text style={styles.postedBannerText}>
              {t(
                postedNotice === "loading"
                  ? "community.postedLoading"
                  : "community.postedBanner",
              )}
            </Text>
          </View>
        ) : null}
        {filterChips}
        {composerCard}
      </>
    ),
    [
      postedNotice,
      styles.postedBanner,
      styles.postedBannerText,
      colors.success,
      t,
      filterChips,
      composerCard,
    ],
  );

  const listFooter = useMemo(
    () =>
      loadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : null,
    [loadingMore, styles.footer, colors.accent],
  );

  const listEmpty = useMemo(() => {
    if (state === "loading") {
      return (
        <View style={SKELETON_LIST_STYLE}>
          {SKELETON_INDICES.map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonAvatar} />
                <View style={SKELETON_COL_STYLE}>
                  <View style={[styles.skeletonLine, SKELETON_W40_STYLE]} />
                  <View style={[styles.skeletonLine, SKELETON_W25_STYLE]} />
                </View>
              </View>
              <View style={[styles.skeletonLine, SKELETON_W95_STYLE]} />
              <View style={[styles.skeletonLine, SKELETON_W80_STYLE]} />
              <View style={styles.skeletonImage} />
            </View>
          ))}
        </View>
      );
    }
    if (state === "error") {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            {t("common.somethingWentWrong")}
          </Text>
          <Text style={styles.muted}>{t("community.loadFailed")}</Text>
          <Button
            title={t("common.retry")}
            onPress={retryFirstPage}
            style={styles.cta}
          />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.emptyGlyph}>💬</Text>
        <Text style={styles.emptyTitle}>{t("community.emptyTitle")}</Text>
        <Button
          title={t("community.emptyBeFirst")}
          onPress={startCompose}
          style={styles.cta}
        />
      </View>
    );
  }, [
    state,
    styles.skeletonCard,
    styles.skeletonRow,
    styles.skeletonAvatar,
    styles.skeletonLine,
    styles.skeletonImage,
    styles.center,
    styles.errorTitle,
    styles.muted,
    styles.cta,
    styles.emptyGlyph,
    styles.emptyTitle,
    t,
    retryFirstPage,
    startCompose,
  ]);

  // Shared trailing actions: ride the big title's row at the top, and the
  // bar's row once scrolled (two instances of the same nodes).
  const communityRights =
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
        ];

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={postKeyExtractor}
        renderItem={renderPostItem}
        style={FLEX_ONE_STYLE}
        contentContainerStyle={listContentStyle}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        // Heavy photo cells: render small batches (browse pattern).
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        refreshControl={refreshControl}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
      />
      <View style={styles.pinnedBar} pointerEvents="box-none">
        <PinnedHeaderBar
          title={t("community.title")}
          hidden={chrome.hidden}
          rights={communityRights}
        />
      </View>

      <CommunityCommentsController
        ref={commentsRef}
        myAvatar={myAvatar}
        myName={myName}
        onCommented={bumpCommentCount}
      />
    </View>
  );
}
