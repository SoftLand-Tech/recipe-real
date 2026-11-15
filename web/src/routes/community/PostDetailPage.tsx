/**
 * Post detail + comments (/post/:id) — slice COMMUNITY.
 *
 * Public read: the post card (detail variant: inline edit for the author,
 * comment action focuses the composer) followed by the comment thread.
 * Comment composer + like + moderation are auth-gated with the inline
 * sign-in prompt for anon visitors. Comments paginate oldest-first with a
 * load-more button; edit/delete your own, report others' — full mobile
 * parity for moderation is a store-policy requirement.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { isAxiosError } from "axios";

import {
  createPostComment,
  deletePostComment,
  fetchMyProfileForCommunity,
  fetchPost,
  fetchPostComments,
  HalalRejectionError,
  reportComment,
  updatePostComment,
  type CommunityMyProfile,
} from "@/api/community";
import { isOfflineError, isRateLimitedError } from "@/api/http";
import type { Post, PostComment } from "@/api/types";
import { Button } from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useT } from "@/i18n";
import { CommunityAvatar } from "@/routes/community/CommunityAvatar";
import { CommunityConfirmDialog } from "@/routes/community/CommunityConfirmDialog";
import { CommunityPostCard } from "@/routes/community/CommunityPostCard";
import { COMMENT_BODY_MAX, PostCommentRow } from "@/routes/community/PostCommentRow";

type LoadState = "loading" | "ready" | "error";

type CommentDialog =
  | { kind: "deleteComment"; comment: PostComment }
  | { kind: "reportComment"; comment: PostComment }
  | null;

/** Friendly 404-ish screen for an unparsable post id (no fetch attempted). */
function InvalidPostScreen({
  t,
  navigate,
}: {
  t: ReturnType<typeof useT>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-hair bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]">
      <h1 className="font-display text-xl font-semibold text-ink">
        {t("common.error")}
      </h1>
      <p className="max-w-sm font-body text-[15px] text-muted">
        {t("community.detailLoadFailed")}
      </p>
      <Button variant="ghost" onClick={() => navigate("/community")}>
        {t("common.back")}
      </Button>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const t = useT();
  const navigate = useNavigate();
  const { status } = useAuth();
  const toast = useToast();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [post, setPost] = useState<Post | null>(null);
  const [me, setMe] = useState<CommunityMyProfile | null>(null);

  // ---- Comments ---------------------------------------------------------------
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [reportedCommentIds, setReportedCommentIds] = useState<number[]>([]);
  const [dialog, setDialog] = useState<CommentDialog>(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  // ---- Comment composer ---------------------------------------------------------
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);
  const [commentFailed, setCommentFailed] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const failToast = useCallback(
    (error: unknown, fallback: string) => {
      if (isRateLimitedError(error)) toast.error(t("common.rateLimited"));
      else if (isOfflineError(error)) toast.error(t("common.offline"));
      else toast.error(fallback);
    },
    [t, toast],
  );

  // ---- Post + comments load ------------------------------------------------------
  // No synchronous setState before the first await: both loaders run from a
  // mount effect (react-hooks/set-state-in-effect); pre-flight loading flips
  // live in the initial state and the retry handlers.
  const loadPost = useCallback(async () => {
    try {
      const p = await fetchPost(postId);
      setPost(p);
      setLoadState("ready");
    } catch (error) {
      // A blocked author's post 404s for the blocker — same friendly screen.
      if (!isAxiosError(error) || error.response?.status !== 404) {
        failToast(error, t("community.loadFailed"));
      }
      setLoadState("error");
    }
  }, [postId, failToast, t]);

  const loadComments = useCallback(
    async (targetPage: number) => {
      try {
        const page = await fetchPostComments(postId, targetPage);
        setCommentsError(null);
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
      } catch (error) {
        failToast(error, t("community.commentsLoadFailed"));
        setCommentsError(t("community.commentsLoadFailed"));
      } finally {
        setCommentsLoading(false);
      }
    },
    [postId, failToast, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Off the synchronous effect path (react-hooks/set-state-in-effect):
      // the fetches (and their setStates) start one microtask later.
      await Promise.resolve();
      if (cancelled) return;
      void loadPost();
      void loadComments(1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Own profile (own-post menu + comment affordances), best-effort.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (status !== "authed") {
        // Off the synchronous effect path (react-hooks/set-state-in-effect).
        await Promise.resolve();
        if (!cancelled) setMe(null);
        return;
      }
      try {
        const profile = await fetchMyProfileForCommunity();
        if (!cancelled) setMe(profile);
      } catch {
        // Non-fatal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // ---- Comment composer ------------------------------------------------------------
  const sendComment = async () => {
    const body = draft.trim();
    if (body.length === 0 || posting || post == null) return;
    if (status === "anon") {
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
      setPost((p) => (p ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (error) {
      if (error instanceof HalalRejectionError) {
        setHalalTerms(error.terms);
      } else if (isAxiosError(error) && error.response?.status === 401) {
        setNeedsAuth(true);
      } else if (isRateLimitedError(error)) {
        toast.error(t("common.rateLimited"));
      } else {
        setCommentFailed(true);
      }
    } finally {
      setPosting(false);
    }
  };

  // ---- Comment moderation ------------------------------------------------------------
  const saveCommentEdit = async (comment: PostComment, body: string): Promise<boolean> => {
    if (post == null) return false;
    try {
      const updated = await updatePostComment(post.id, comment.id, body);
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      return true;
    } catch (error) {
      if (error instanceof HalalRejectionError) {
        toast.error(t("community.halalBlocked", { terms: error.terms.join(", ") }));
      } else if (isAxiosError(error) && error.response?.status === 401) {
        setNeedsAuth(true);
      } else {
        failToast(error, t("community.editFailed"));
      }
      return false;
    }
  };

  const deleteCommentNow = async (comment: PostComment) => {
    if (post == null) return;
    setDialogBusy(true);
    try {
      await deletePostComment(post.id, comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setPost((p) => (p ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
      setDialog(null);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) setNeedsAuth(true);
      else failToast(error, t("community.deleteFailed"));
      setDialog(null);
    } finally {
      setDialogBusy(false);
    }
  };

  const reportCommentNow = async (comment: PostComment) => {
    if (post == null) return;
    setDialogBusy(true);
    try {
      await reportComment(post.id, comment.id);
      setReportedCommentIds((prev) => [...prev, comment.id]);
      setDialog(null);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) setNeedsAuth(true);
      else failToast(error, t("community.reportFailed"));
      setDialog(null);
    } finally {
      setDialogBusy(false);
    }
  };

  const requestCommentDialog = (kind: "deleteComment" | "reportComment", comment: PostComment) => {
    if (status === "anon") {
      setNeedsAuth(true);
      return;
    }
    setDialog({ kind, comment });
  };

  const focusComposer = useCallback(() => {
    composerRef.current?.focus();
  }, []);

  const myName = me ? (me.display_name ?? me.name ?? "").trim() : "";

  // ---- Render states --------------------------------------------------------------
  // An unparsable id can never load — render the friendly error directly.
  if (!Number.isFinite(postId) || postId <= 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <InvalidPostScreen t={t} navigate={navigate} />
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <div className="flex flex-col gap-3 rounded-card border border-hair bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div className="flex items-center gap-3">
              <Skeleton circle className="h-10 w-10" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "error" || post == null) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-card border border-hair bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <h1 className="font-display text-xl font-semibold text-ink">
            {t("common.error")}
          </h1>
          <p className="max-w-sm font-body text-[15px] text-muted">
            {t("community.detailLoadFailed")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/community")}>
              {t("common.back")}
            </Button>
            <Button
              onClick={() => {
                setLoadState("loading");
                void loadPost();
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        to="/community"
        className="mb-4 inline-flex items-center gap-1.5 rounded-pill font-body text-[13.5px] font-bold text-muted transition-colors hover:text-orange-deep"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        {t("post.backToCommunity")}
      </Link>

      {/* The post (detail variant: inline edit, comment → focus composer) */}
      <CommunityPostCard
        post={post}
        myUserId={me?.id ?? null}
        variant="detail"
        onEdited={(postId, patch) =>
          setPost((p) => (p && p.id === postId ? { ...p, ...patch } : p))
        }
        onRequestComment={focusComposer}
        onGone={() => navigate("/community")}
      />

      {/* Comment composer — avatar + pill input (Facebook pattern) */}
      <div className="mt-5 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <CommunityAvatar name={myName || "?"} uri={me?.avatar_url} size={32} />
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-pill bg-cream-deep px-4 py-2">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendComment();
                }
              }}
              placeholder={t("community.commentPlaceholder")}
              maxLength={COMMENT_BODY_MAX}
              disabled={posting}
              rows={1}
              dir="auto"
              className="min-h-6 flex-1 resize-none bg-transparent font-body text-[14px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void sendComment()}
              disabled={posting || draft.trim().length === 0}
              aria-label={t("community.commentSend")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-orange transition-colors hover:bg-orange-soft disabled:text-faint disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l16-7-4.5 7L20 19 4 12Z" />
              </svg>
            </button>
          </div>
        </div>
        {halalTerms != null ? (
          <p className="ps-11 font-body text-[13.5px] font-semibold text-orange-deep">
            {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
          </p>
        ) : null}
        {commentFailed ? (
          <p className="ps-11 font-body text-[13.5px] font-semibold text-orange-deep">
            {t("community.commentFailed")}
          </p>
        ) : null}
        {needsAuth ? (
          <div className="flex flex-wrap items-center justify-between gap-2 ps-11">
            <p className="font-body text-[13.5px] text-muted">{t("community.signInPrompt")}</p>
            <Link
              to="/login"
              className="rounded-pill bg-orange px-4 py-2 font-body text-[13px] font-bold text-white transition-colors hover:bg-orange-deep"
            >
              {t("common.signIn")}
            </Link>
          </div>
        ) : null}
      </div>

      {/* Comments thread (oldest first) */}
      <section className="mt-6" aria-label={t("post.commentsTitle")}>
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          {t("post.commentsTitle")}
        </h2>

        {commentsLoading && comments.length === 0 ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-3">
                <Skeleton circle className="h-8 w-8" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : commentsError && comments.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="font-body text-[14px] text-muted">{commentsError}</p>
            <Button
              variant="ghost"
              onClick={() => {
                setCommentsLoading(true);
                void loadComments(1);
              }}
              className="px-4 py-2 text-[13px]"
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <p className="font-body text-[14.5px] text-muted">{t("community.commentsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map((comment) => (
              <PostCommentRow
                key={comment.id}
                comment={comment}
                mine={me != null && comment.user.id === me.id}
                reported={reportedCommentIds.includes(comment.id)}
                onSave={saveCommentEdit}
                onDelete={(c) => requestCommentDialog("deleteComment", c)}
                onReport={(c) => requestCommentDialog("reportComment", c)}
              />
            ))}
            {commentsHasMore ? (
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  loading={commentsLoading}
                  disabled={commentsLoading}
                  onClick={() => {
                    setCommentsLoading(true);
                    void loadComments(commentsPage + 1);
                  }}
                  className="px-5 py-2.5 text-[13.5px]"
                >
                  {t("post.loadMoreComments")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Comment moderation confirms */}
      {dialog?.kind === "deleteComment" ? (
        <CommunityConfirmDialog
          title={t("post.deleteCommentTitle")}
          message={t("community.deleteCommentConfirm")}
          confirmLabel={t("common.delete")}
          destructive
          busy={dialogBusy}
          onConfirm={() => void deleteCommentNow(dialog.comment)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "reportComment" ? (
        <CommunityConfirmDialog
          title={t("community.reportComment")}
          message={t("community.reportConfirm")}
          confirmLabel={t("community.reportComment")}
          busy={dialogBusy}
          onConfirm={() => void reportCommentNow(dialog.comment)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
