import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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
  blockUser,
  createPostComment,
  deletePost,
  deletePostComment,
  fetchMyProfile,
  fetchPost,
  fetchPostComments,
  hasToken,
  HalalRejectionError,
  PostUnauthorizedError,
  reportComment,
  reportPost,
  togglePostLike,
  updatePost,
  updatePostComment,
} from "@/api/client";
import { track } from "@/analytics";
import { WEB_BASE_URL } from "@/config";
import { shareLink } from "@/utils/share";
import type { Post, PostComment, PostRecipe } from "@/types";
import { useLang, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  IconPressable,
  ImageViewerModal,
  PostImageGrid,
} from "@/components/ui";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";

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

function postRecipeTitle(lang: Lang, recipe: PostRecipe): string {
  return lang === "ar"
    ? (recipe.title_ar ?? recipe.title ?? "")
    : (recipe.title ?? recipe.title_ar ?? "");
}

const COMMENT_BODY_MAX = 1000;
const POST_BODY_MAX = 2000;

// ---- Comment row -------------------------------------------------------------

interface CommentRowProps {
  comment: PostComment;
  /** Whether the signed-in user authored this comment (edit/delete). */
  mine: boolean;
  /** Local-only "already reported" marker (no server echo). */
  reported: boolean;
  /** Persist an edit; resolves true on success (row exits edit mode). */
  onSave: (comment: PostComment, body: string) => Promise<boolean>;
  /** Destructive-confirm + delete flow (owned by the screen). */
  onDelete: (comment: PostComment) => void;
  /** Confirm + report flow (owned by the screen). */
  onReport: (comment: PostComment) => void;
}

const CommentRow = memo(function CommentRow({
  comment,
  mine,
  reported,
  onSave,
  onDelete,
  onReport,
}: CommentRowProps) {
  const colors = useThemeColors();
  const t = useT();

  // ---- Inline edit state -----------------------------------------------------
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const startEdit = useCallback(() => {
    setDraft(comment.body);
    setEditing(true);
  }, [comment.body]);

  const cancelEdit = useCallback(() => {
    setDraft(comment.body);
    setEditing(false);
  }, [comment.body]);

  const save = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || busy) return;
    setBusy(true);
    try {
      // The screen handles API errors (halal / 401) and state updates; a
      // `true` result exits edit mode.
      if (await onSave(comment, body)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, comment, onSave]);

  const rel = relativeDate(t, comment.created_at);
  const caption = [
    rel,
    comment.edited ? t("community.edited") : null,
  ].filter((part): part is string => part != null && part !== "");

  const s = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: Space.sm, alignItems: "flex-start" },
        main: { flex: 1, gap: 4 },
        bubble: {
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs + 2,
          alignSelf: "flex-start",
          maxWidth: "100%",
        },
        author: { ...Type.bodySm, fontWeight: "600", color: colors.ink },
        body: { ...Type.bodySm, color: colors.ink, marginTop: 1 },
        metaRow: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginStart: Space.sm },
        time: { ...Type.caption, color: colors.inkFaint },
        actions: { flexDirection: "row", alignItems: "center", gap: Space.xs },
        editWrap: { gap: Space.xs },
        editInput: {
          ...Type.bodySm,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          minHeight: 40,
          textAlignVertical: "top",
        },
        editRow: {
          flexDirection: "row",
          gap: Space.sm,
          alignSelf: "flex-start",
        },
      }),
    [colors],
  );

  return (
    <View style={s.row}>
      <Avatar
        name={authorName(comment.user)}
        uri={comment.user.avatar_url}
        size={32}
      />
      <View style={s.main}>
        {editing ? (
          <View style={s.editWrap}>
            <TextInput
              style={s.editInput}
              value={draft}
              onChangeText={setDraft}
              placeholderTextColor={colors.inkFaint}
              maxLength={COMMENT_BODY_MAX}
              multiline
              editable={!busy}
              autoFocus
            />
            <View style={s.editRow}>
              <Button
                variant="primary"
                title={t("community.saveEdit")}
                loading={busy}
                disabled={busy || draft.trim().length === 0}
                onPress={() => void save()}
              />
              <Button
                variant="ghost"
                title={t("common.cancel")}
                disabled={busy}
                onPress={cancelEdit}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={s.bubble}>
              <Text style={s.author} numberOfLines={1}>
                {authorName(comment.user)}
              </Text>
              <Text style={s.body}>{comment.body}</Text>
            </View>
            <View style={s.metaRow}>
              {caption.length > 0 ? (
                <Text style={s.time}>{caption.join(" · ")}</Text>
              ) : null}
              {mine ? (
                <>
                  <IconPressable onPress={startEdit} hitSlop={Space.xs} accessibilityLabel={t("community.editCommentA11y")}>
                    <Text style={s.time}>Edit</Text>
                  </IconPressable>
                  <IconPressable onPress={() => onDelete(comment)} hitSlop={Space.xs} accessibilityLabel={t("community.deleteCommentA11y")}>
                    <Text style={s.time}>Delete</Text>
                  </IconPressable>
                </>
              ) : reported ? (
                <Ionicons name="flag" size={12} color={colors.inkFaint} />
              ) : (
                <IconPressable onPress={() => onReport(comment)} hitSlop={Space.xs} accessibilityLabel={t("community.reportComment")}>
                  <Text style={s.time}>Report</Text>
                </IconPressable>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
});

// ---- Post detail screen ------------------------------------------------------

type LoadState = "loading" | "ready" | "error";

/**
 * One bottom action sheet at a time — the moderation state machine that
 * replaced the native Alerts:
 *   menu (⋯) → deletePost | reportPost | blockAuthor → confirm sheets;
 *   comment icons → deleteComment | reportComment confirm sheets (the
 *   variant carries the target comment);
 *   blocked — the post-block success sheet (OK → back).
 */
type DetailSheet =
  | { kind: "menu" }
  | { kind: "deletePost" }
  | { kind: "reportPost" }
  | { kind: "blockAuthor" }
  | { kind: "blocked" }
  | { kind: "deleteComment"; comment: PostComment }
  | { kind: "reportComment"; comment: PostComment };

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
  // Own-content affordances (edit/delete) need the signed-in user's id —
  // best-effort: while null, the screen only offers report/block actions.
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);

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

  // ---- Moderation state (own edit / report markers) --------------------------
  const [editingPost, setEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [postHalalTerms, setPostHalalTerms] = useState<string[] | null>(null);
  // Local-only reported markers (no server echo): once set, the flag icon
  // fills and the report affordance disappears.
  const [reportedPost, setReportedPost] = useState(false);
  const [reportedCommentIds, setReportedCommentIds] = useState<number[]>([]);

  // ---- Moderation bottom sheet (see DetailSheet) ------------------------------
  const [sheet, setSheet] = useState<DetailSheet | null>(null);

  const closeSheet = useCallback(() => setSheet(null), []);

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
      if (!ok) return;
      // Best-effort id for the own-content affordances.
      try {
        const profile = await fetchMyProfile();
        if (!cancelled) {
          setMyUserId(profile.id);
          setMyAvatar(profile.avatar_url ?? null);
          setMyName(profile.display_name ?? profile.name ?? null);
        }
      } catch {
        // Non-fatal: edit/delete stay hidden, report/block still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Opens the system share sheet with the post's PUBLIC WEB PAGE
   * (https://recipe-real.softland.tech/p/{id} — a real https link with an
   * OpenGraph preview) plus the first 120 chars of the body as the message.
   * Dismissing the sheet is not an error.
   */
  const handleShare = useCallback(async () => {
    const p = postRef.current ?? post;
    if (!p) return;
    track("post_shared", { post_id: p.id });
    try {
      await shareLink(`${WEB_BASE_URL}/p/${p.id}`, p.body.slice(0, 120));
    } catch {
      // The user dismissed the sheet (or the platform errored) — best-effort.
    }
  }, [post]);

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

  // ---- Moderation: post edit --------------------------------------------------

  const startEditPost = useCallback(() => {
    if (!post) return;
    setPostDraft(post.body);
    setPostHalalTerms(null);
    setEditingPost(true);
  }, [post]);

  const cancelEditPost = useCallback(() => {
    setEditingPost(false);
    setPostHalalTerms(null);
  }, []);

  const savePostEdit = useCallback(async () => {
    if (!post) return;
    const body = postDraft.trim();
    if (body.length === 0 || savingPost) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    setSavingPost(true);
    setPostHalalTerms(null);
    try {
      const updated = await updatePost(post.id, body);
      setPost((p) =>
        p ? { ...p, body: updated.body, edited: updated.edited } : p,
      );
      setEditingPost(false);
    } catch (error) {
      if (error instanceof PostUnauthorizedError) {
        setNeedsAuth(true);
      } else if (error instanceof HalalRejectionError) {
        setPostHalalTerms(error.terms);
      } else {
        Alert.alert(t("community.editFailed"));
      }
    } finally {
      setSavingPost(false);
    }
  }, [post, postDraft, savingPost, signedIn, t]);

  // ---- Moderation: post delete -------------------------------------------------
  // (The confirm sheet's action calls this after the sheet dismissed.)

  const deletePostNow = useCallback(async () => {
    if (!post || deletingPost) return;
    setDeletingPost(true);
    try {
      await deletePost(post.id);
      // Back to the feed — its focus effect silently reloads page 1, so the
      // deleted post is gone by the time the list is visible again.
      router.back();
    } catch (error) {
      setDeletingPost(false);
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
      else Alert.alert(t("community.deleteFailed"));
    }
  }, [post, deletingPost, t]);

  // ---- Moderation: report post ---------------------------------------------------

  const reportPostNow = useCallback(async () => {
    if (!post) return;
    try {
      await reportPost(post.id);
      setReportedPost(true);
    } catch (error) {
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
      else Alert.alert(t("community.reportFailed"));
    }
  }, [post, t]);

  // ---- Moderation: block the post author -----------------------------------------

  const blockAuthorNow = useCallback(async () => {
    if (!post) return;
    try {
      await blockUser(post.user.id);
      // Confirm the block with a sheet; OK leaves the (now hidden) post.
      setSheet({ kind: "blocked" });
    } catch (error) {
      if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
      else Alert.alert(t("community.blockFailed"));
    }
  }, [post, t]);

  // ---- Moderation: post actions menu (⋯) ------------------------------------------

  const isMyPost = post != null && myUserId != null && post.user.id === myUserId;

  const openPostMenu = useCallback(() => {
    setSheet({ kind: "menu" });
  }, []);

  // ---- Moderation: comment flows ----------------------------------------------

  const saveCommentEdit = useCallback(
    async (comment: PostComment, body: string): Promise<boolean> => {
      if (!post) return false;
      try {
        const updated = await updatePostComment(post.id, comment.id, body);
        setComments((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        return true;
      } catch (error) {
        if (error instanceof PostUnauthorizedError) {
          setNeedsAuth(true);
        } else if (error instanceof HalalRejectionError) {
          Alert.alert(
            t("community.halalBlocked", { terms: error.terms.join(", ") }),
          );
        } else {
          Alert.alert(t("community.editFailed"));
        }
        return false;
      }
    },
    [post, t],
  );

  const deleteCommentNow = useCallback(
    async (comment: PostComment) => {
      if (!post) return;
      try {
        await deletePostComment(post.id, comment.id);
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
        setPost((p) =>
          p
            ? { ...p, comments_count: Math.max(0, p.comments_count - 1) }
            : p,
        );
      } catch (error) {
        if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
        else Alert.alert(t("community.deleteFailed"));
      }
    },
    [post, t],
  );

  /**
   * Opens the delete-comment confirm sheet for a specific comment (the
   * sheet variant carries the target).
   */
  const requestDeleteComment = useCallback((comment: PostComment) => {
    setSheet({ kind: "deleteComment", comment });
  }, []);

  const reportCommentNow = useCallback(
    async (comment: PostComment) => {
      if (!post) return;
      try {
        await reportComment(post.id, comment.id);
        setReportedCommentIds((prev) => [...prev, comment.id]);
      } catch (error) {
        if (error instanceof PostUnauthorizedError) setNeedsAuth(true);
        else Alert.alert(t("community.reportFailed"));
      }
    },
    [post, t],
  );

  /** Opens the report-comment confirm sheet for a specific comment. */
  const requestReportComment = useCallback((comment: PostComment) => {
    setSheet({ kind: "reportComment", comment });
  }, []);

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
          paddingHorizontal: 0,
          gap: Space.lg,
          paddingBottom: insets.bottom + Space.xxl,
        },
        card: { gap: Space.sm, padding: Space.md },
        headRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
        headMain: { flex: 1, gap: 2 },
        author: { ...Type.title, color: colors.ink, flexShrink: 1 },
        relRow: { flexDirection: "row", alignItems: "center", gap: 4 },
        relTime: { ...Type.caption, color: colors.inkFaint },
        globeIcon: { marginTop: 1 },
        reportedRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
        },
        reportedText: { ...Type.caption, color: colors.inkFaint },
        body: { ...Type.body, color: colors.ink },
        editWrap: { gap: Space.xs },
        editInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          minHeight: 72,
          textAlignVertical: "top",
        },
        editRow: {
          flexDirection: "row",
          gap: Space.sm,
          alignSelf: "flex-start",
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
        countsRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Space.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        },
        countsLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
        countsText: { ...Type.caption, color: colors.inkSecondary },
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
        actionCount: { ...Type.bodySm, fontWeight: "600", color: colors.inkSecondary },
        actionCountActive: { color: colors.accent },
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
          alignItems: "flex-start",
          gap: Space.sm,
        },
        composePill: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs,
          minHeight: 40,
        },
        composeInput: {
          flex: 1,
          ...Type.bodySm,
          color: colors.ink,
          paddingHorizontal: Space.xs,
          paddingVertical: Space.xs,
          textAlignVertical: "center",
        },
        composeSend: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
        },
        loadMore: { alignSelf: "flex-start" },
      }),
    [colors, insets.bottom],
  );

  // ---- Render states ---------------------------------------------------------

  if (loadState === "loading") {
    return (
      <View style={styles.container}>
        <PinnedHeaderBar title={t("community.postDetail")} leading={<BackChevron />} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      </View>
    );
  }

  if (loadState === "error" || !post) {
    return (
      <View style={styles.container}>
        <PinnedHeaderBar title={t("community.postDetail")} leading={<BackChevron />} />
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
  const caption = [
    rel,
    post.edited ? t("community.edited") : null,
  ].filter((part): part is string => part != null && part !== "");

  // The post body + recipe + images + action row rendered as the header of
  // the comments FlatList so the whole screen scrolls together.
  const ListHeader = (
    <View style={{ gap: Space.lg }}>
      <Card style={styles.card}>
        {/* Header — Facebook layout: avatar 40 + name + time·globe */}
        <View style={styles.headRow}>
          <Avatar
            name={authorName(post.user)}
            uri={post.user.avatar_url}
            size={40}
          />
          <View style={styles.headMain}>
            <Text style={styles.author} numberOfLines={1}>
              {authorName(post.user)}
            </Text>
            <View style={styles.relRow}>
              {caption.length > 0 ? (
                <Text style={styles.relTime}>{caption.join(" · ")}</Text>
              ) : null}
              {caption.length > 0 ? <Text style={styles.relTime}> · </Text> : null}
              <Ionicons name="earth-outline" size={12} color={colors.inkFaint} style={styles.globeIcon} />
            </View>
            {reportedPost ? (
              <View style={styles.reportedRow}>
                <Ionicons name="flag" size={12} color={colors.inkFaint} />
                <Text style={styles.reportedText}>
                  {t("community.reported")}
                </Text>
              </View>
            ) : null}
          </View>
          <IconPressable
            onPress={openPostMenu}
            disabled={deletingPost}
            accessibilityLabel={t("community.postActions")}
            hitSlop={12}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.inkSecondary}
            />
          </IconPressable>
        </View>

        {/* Body (own post: inline edit with save/cancel) */}
        {editingPost ? (
          <View style={styles.editWrap}>
            <TextInput
              style={styles.editInput}
              value={postDraft}
              onChangeText={setPostDraft}
              placeholderTextColor={colors.inkFaint}
              maxLength={POST_BODY_MAX}
              multiline
              editable={!savingPost}
              autoFocus
            />
            <View style={styles.editRow}>
              <Button
                variant="primary"
                title={t("community.saveEdit")}
                loading={savingPost}
                disabled={savingPost || postDraft.trim().length === 0}
                onPress={() => void savePostEdit()}
              />
              <Button
                variant="ghost"
                title={t("common.cancel")}
                disabled={savingPost}
                onPress={cancelEditPost}
              />
            </View>
            {postHalalTerms != null ? (
              <Text style={styles.commentError}>
                {t("community.halalBlocked", {
                  terms: postHalalTerms.join(", "),
                })}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.body}>{post.body}</Text>
        )}

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

        {/* Counts — Facebook above action bar */}
        {(likesCount > 0 || post.comments_count > 0) ? (
          <View style={styles.countsRow}>
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
          </View>
        ) : null}

        {/* Action row — 3 equal Facebook tabs */}
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
            onPress={() => setDraft("")}
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

      {/* Comment composer — Facebook avatar + pill input */}
      <View style={{ gap: Space.sm }}>
        <View style={styles.composeRow}>
          <Avatar name={myName ?? "?"} uri={myAvatar} size={32} />
          <View style={styles.composePill}>
            <TextInput
              style={styles.composeInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("community.commentPlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={COMMENT_BODY_MAX}
              editable={!posting}
              multiline
            />
            <IconPressable
              onPress={() => void sendComment()}
              disabled={posting || draft.trim().length === 0}
              hitSlop={Space.xs}
              style={styles.composeSend}
            >
              {posting ? (
                <Ionicons name="hourglass-outline" size={18} color={colors.inkFaint} />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={draft.trim().length === 0 ? colors.inkFaint : colors.accent}
                />
              )}
            </IconPressable>
          </View>
        </View>
        {halalTerms != null ? (
          <Text style={styles.commentError}>
            {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
          </Text>
        ) : null}
        {commentFailed ? (
          <Text style={styles.commentError}>{t("community.commentFailed")}</Text>
        ) : null}
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

  // ---- Moderation bottom sheets (one step of the state machine at a time).
  // Each variant gets a stable key — moving between steps remounts the sheet
  // so every one plays its own enter animation after the previous dropped.
  let sheetNode: ReactNode = null;
  if (sheet?.kind === "menu") {
    sheetNode = (
      <ActionSheet
        key="menu"
        visible
        onClose={closeSheet}
        title={t("community.postActions")}
        actions={
          isMyPost
            ? [
                {
                  key: "edit",
                  label: t("community.editPost"),
                  icon: "create-outline",
                  onPress: startEditPost,
                },
                {
                  key: "delete",
                  label: t("community.deletePost"),
                  icon: "trash-outline",
                  tone: "destructive",
                  onPress: () => setSheet({ kind: "deletePost" }),
                },
              ]
            : [
                {
                  key: "report",
                  label: t("community.reportPost"),
                  icon: "flag-outline",
                  onPress: () => setSheet({ kind: "reportPost" }),
                },
                {
                  key: "block",
                  label: t("community.blockUser"),
                  icon: "ban-outline",
                  tone: "destructive",
                  onPress: () => setSheet({ kind: "blockAuthor" }),
                },
              ]
        }
      />
    );
  } else if (sheet?.kind === "deletePost") {
    sheetNode = (
      <ActionSheet
        key="deletePost"
        visible
        onClose={closeSheet}
        title={t("community.deletePost")}
        message={t("community.deletePostConfirm")}
        actions={[
          {
            key: "confirm",
            label: t("common.delete"),
            icon: "trash-outline",
            tone: "destructive",
            onPress: () => void deletePostNow(),
          },
        ]}
      />
    );
  } else if (sheet?.kind === "reportPost") {
    sheetNode = (
      <ActionSheet
        key="reportPost"
        visible
        onClose={closeSheet}
        title={t("community.reportPost")}
        message={t("community.reportConfirm")}
        actions={[
          {
            key: "confirm",
            label: t("community.reportPost"),
            icon: "flag-outline",
            onPress: () => void reportPostNow(),
          },
        ]}
      />
    );
  } else if (sheet?.kind === "blockAuthor") {
    sheetNode = (
      <ActionSheet
        key="blockAuthor"
        visible
        onClose={closeSheet}
        title={t("community.blockUser")}
        message={t("community.blockConfirm", {
          name: post != null ? authorName(post.user) : "",
        })}
        actions={[
          {
            key: "confirm",
            label: t("community.blockBtn"),
            icon: "ban-outline",
            tone: "destructive",
            onPress: () => void blockAuthorNow(),
          },
        ]}
      />
    );
  } else if (sheet?.kind === "blocked") {
    // Post-block success: OK (or dismiss) leaves the now-hidden post behind.
    sheetNode = (
      <ActionSheet
        key="blocked"
        visible
        onClose={closeSheet}
        title={t("community.blocked")}
        actions={[
          {
            key: "ok",
            label: t("common.ok"),
            icon: "checkmark-circle-outline",
            onPress: () => router.back(),
          },
        ]}
      />
    );
  } else if (sheet?.kind === "deleteComment") {
    const comment = sheet.comment;
    sheetNode = (
      <ActionSheet
        key={`deleteComment:${comment.id}`}
        visible
        onClose={closeSheet}
        title={t("community.deleteCommentA11y")}
        message={t("community.deleteCommentConfirm")}
        actions={[
          {
            key: "confirm",
            label: t("common.delete"),
            icon: "trash-outline",
            tone: "destructive",
            onPress: () => void deleteCommentNow(comment),
          },
        ]}
      />
    );
  } else if (sheet?.kind === "reportComment") {
    const comment = sheet.comment;
    sheetNode = (
      <ActionSheet
        key={`reportComment:${comment.id}`}
        visible
        onClose={closeSheet}
        title={t("community.reportComment")}
        message={t("community.reportConfirm")}
        actions={[
          {
            key: "confirm",
            label: t("community.reportComment"),
            icon: "flag-outline",
            onPress: () => void reportCommentNow(comment),
          },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PinnedHeaderBar title={t("community.postDetail")} leading={<BackChevron />} />

      <FlatList
        data={comments}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            mine={myUserId != null && item.user.id === myUserId}
            reported={reportedCommentIds.includes(item.id)}
            onSave={saveCommentEdit}
            onDelete={requestDeleteComment}
            onReport={requestReportComment}
          />
        )}
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

      {/* Moderation bottom sheet (menu / confirm steps / blocked). */}
      {sheetNode}
    </View>
  );
}
