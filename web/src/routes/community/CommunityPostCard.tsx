/**
 * Community post card (slice COMMUNITY) — shared by the feed and the post
 * detail screen, mirroring mobile's Facebook-style card: author row (avatar,
 * name → profile, relative time, globe), clamped body with See more (feed),
 * photo grid + lightbox, attached-recipe chip → recipe, counts row, and the
 * Like / Comment / Share action row.
 *
 * Behaviour ported from mobile's PostCard:
 *   - Like is OPTIMISTIC with captured pre-state rollback on failure; the
 *     authoritative server answer is mirrored to the feed via onLikeState.
 *   - Moderation menu (mobile parity is a store-policy requirement):
 *     own post → delete (feed+detail) / edit (detail); other → report +
 *     block. Anon visitors get the inline sign-in prompt instead of a doomed
 *     request. Report/block are idempotent server-side; "Reported" is a
 *     local marker (no server echo).
 *   - Share copies the post's public page link (/p/{id}) to the clipboard.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { isAxiosError } from "axios";

import {
  blockUser,
  deletePost,
  HalalRejectionError,
  reportPost,
  togglePostLike,
  updatePost,
} from "@/api/community";
import { isRateLimitedError } from "@/api/http";
import type { Post } from "@/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useLang, useT } from "@/i18n";
import { CommunityActionMenu, MenuIcon } from "@/routes/community/CommunityActionMenu";
import { CommunityAvatar } from "@/routes/community/CommunityAvatar";
import { CommunityConfirmDialog } from "@/routes/community/CommunityConfirmDialog";
import { CommunityImageGrid } from "@/routes/community/CommunityImageGrid";
import { CommunityIsolatedText } from "@/routes/community/CommunityIsolatedText";
import { CommunityLightbox } from "@/routes/community/CommunityLightbox";
import { authorName, postRecipeTitle, relativeDate } from "@/routes/community/CommunityHelpers";

/** Max post body length (server-validated; mirrored client-side). */
export const POST_BODY_MAX = 2000;

export interface CommunityPostCardProps {
  post: Post;
  /** The signed-in user's id (null while resolving/anon) — drives the ⋯ menu. */
  myUserId: number | null;
  variant: "feed" | "detail";
  /** Mirror like changes into the owner's row state (feed page). */
  onLikeState?: (postId: number, liked: boolean, likesCount: number) => void;
  /** Drop this post (feed page: own delete or author blocked). */
  onRemove?: (postId: number) => void;
  /** An inline edit was saved (detail page refreshes its post state). */
  onEdited?: (postId: number, patch: { body: string; edited: boolean }) => void;
  /** Detail: focus the page's comment composer. */
  onRequestComment?: () => void;
  /** Detail: the post is gone (deleted / author blocked) — page navigates away. */
  onGone?: () => void;
}

type Confirm =
  | { kind: "deletePost" }
  | { kind: "reportPost" }
  | { kind: "blockAuthor" }
  | { kind: "blocked" }
  | null;

export function CommunityPostCard({
  post,
  myUserId,
  variant,
  onLikeState,
  onRemove,
  onEdited,
  onRequestComment,
  onGone,
}: CommunityPostCardProps) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { status } = useAuth();
  const toast = useToast();
  const signedIn = status === "authed" ? true : status === "anon" ? false : null;
  const isMine = myUserId != null && post.user.id === myUserId;
  const isDetail = variant === "detail";

  // ---- Like (optimistic + rollback) ------------------------------------------
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const likeBusyRef = useRef(false);

  useEffect(() => {
    // While this card's like request is in flight, the optimistic heart wins
    // over prop syncs (a background refresh must not flip it back).
    if (likeBusyRef.current) return;
    setLiked(post.liked_by_me);
    setLikesCount(post.likes_count);
  }, [post.id, post.liked_by_me, post.likes_count]);

  const [needsAuth, setNeedsAuth] = useState(false);

  const handleLike = async () => {
    if (likeBusyRef.current) return;
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    // Captured for rollback — the props may have moved on by failure time.
    const prevLiked = liked;
    const prevCount = likesCount;
    const nextLiked = !liked;
    const nextCount = likesCount + (liked ? -1 : 1);
    likeBusyRef.current = true;
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikeState?.(post.id, nextLiked, nextCount);
    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
      onLikeState?.(post.id, result.liked, result.likes_count);
    } catch (error) {
      setLiked(prevLiked);
      setLikesCount(prevCount);
      onLikeState?.(post.id, prevLiked, prevCount);
      failToast(error, t("community.likeFailed"));
    } finally {
      likeBusyRef.current = false;
    }
  };

  // ---- Share (public /p/{id} page link → clipboard) ----------------------------
  const handleShare = () => {
    const link = `${window.location.origin}/p/${post.id}`;
    navigator.clipboard
      ?.writeText(link)
      .then(() => toast.show(t("community.linkCopied")))
      .catch(() => toast.error(t("community.linkCopyFailed")));
  };

  // ---- Read-more (feed clamping) ----------------------------------------------
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (isDetail) return;
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 4);
  }, [isDetail, post.body, lang]);

  // ---- Images / lightbox --------------------------------------------------------
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });

  // ---- Reported marker + moderation dialogs -------------------------------------
  const [reported, setReported] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const requireAuthOr = (run: () => void) => {
    if (signedIn === false) {
      setNeedsAuth(true);
      return;
    }
    run();
  };

  const finishDelete = async () => {
    setActionBusy(true);
    try {
      await deletePost(post.id);
      setConfirm(null);
      if (isDetail) onGone?.();
      else onRemove?.(post.id);
    } catch (error) {
      setConfirm(null);
      failToast(error, t("community.deleteFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  const finishReport = async () => {
    setActionBusy(true);
    try {
      await reportPost(post.id);
      setReported(true);
      setConfirm(null);
    } catch (error) {
      setConfirm(null);
      failToast(error, t("community.reportFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  const finishBlock = async () => {
    setActionBusy(true);
    try {
      await blockUser(post.user.id);
      setConfirm({ kind: "blocked" });
    } catch (error) {
      setConfirm(null);
      failToast(error, t("community.blockFailed"));
    } finally {
      setActionBusy(false);
    }
  };

  // ---- Inline body edit (detail, own post) ---------------------------------------
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [editHalal, setEditHalal] = useState<string[] | null>(null);

  const startEdit = () => {
    setDraft(post.body);
    setEditHalal(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    const body = draft.trim();
    if (body.length === 0 || saving) return;
    setSaving(true);
    setEditHalal(null);
    try {
      const updated = await updatePost(post.id, body);
      setEditing(false);
      onEdited?.(post.id, { body: updated.body, edited: updated.edited });
    } catch (error) {
      if (error instanceof HalalRejectionError) setEditHalal(error.terms);
      else failToast(error, t("community.editFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Toasts: 429 gets the friendly rate-limit copy; other failures stay gentle.
  const failToast = (error: unknown, fallback: string) => {
    if (isRateLimitedError(error)) toast.error(t("common.rateLimited"));
    else if (isAxiosError(error) && error.response?.status === 401) {
      // http.ts already cleared the token + flipped AuthContext to anon.
      setNeedsAuth(true);
    } else toast.error(fallback);
  };

  const rel = relativeDate(t, post.created_at);
  const recipe = post.recipe;
  const recipeLabel = recipe ? postRecipeTitle(lang, recipe) : "";
  const author = authorName(post.user);
  const timeCaption = [rel, isDetail && post.edited ? t("community.edited") : null]
    .filter((part): part is string => part != null && part !== "")
    .join(" · ");

  const menuItems = isMine
    ? [
        ...(isDetail
          ? [
              {
                key: "edit",
                label: t("community.editPost"),
                icon: <MenuIcon name="edit" />,
                onSelect: () => requireAuthOr(startEdit),
              },
            ]
          : []),
        {
          key: "delete",
          label: t("community.deletePost"),
          icon: <MenuIcon name="trash" />,
          destructive: true,
          onSelect: () => requireAuthOr(() => setConfirm({ kind: "deletePost" })),
        },
      ]
    : [
        {
          key: "report",
          label: t("community.reportPost"),
          icon: <MenuIcon name="flag" />,
          onSelect: () => requireAuthOr(() => setConfirm({ kind: "reportPost" })),
        },
        {
          key: "block",
          label: t("community.blockUser"),
          icon: <MenuIcon name="ban" />,
          destructive: true,
          onSelect: () => requireAuthOr(() => setConfirm({ kind: "blockAuthor" })),
        },
      ];

  return (
    <>
      <Card as="article" className="flex flex-col gap-3 p-4 sm:p-5">
        {/* Header: avatar | name + time·globe | ⋯ */}
        <div className="flex items-center gap-3">
          <Link
            to={`/u/${post.user.id}`}
            className="shrink-0 rounded-pill transition-opacity hover:opacity-80"
            aria-label={t("community.viewProfile", { name: author })}
          >
            <CommunityAvatar name={author} uri={post.user.avatar_url} size={40} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              to={`/u/${post.user.id}`}
              className="truncate font-body text-[15.5px] font-bold tracking-tight text-ink transition-colors hover:text-orange-deep"
            >
              <CommunityIsolatedText text={author} />
            </Link>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-faint">
              {timeCaption ? <span>{timeCaption}</span> : null}
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </span>
            {reported ? (
              <span className="flex items-center gap-1 text-[12.5px] font-semibold text-orange-deep">
                <MenuIcon name="flag" />
                {t("community.reported")}
              </span>
            ) : null}
          </div>
          <CommunityActionMenu
            label={t("community.postActions")}
            items={menuItems}
            triggerTone={reported ? "reported" : "default"}
            disabled={actionBusy}
          />
        </div>

        {/* Body — feed clamps to 3 lines with See more; detail shows all.
            User text is direction-isolated per run (mixed EN/AR is common). */}
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={POST_BODY_MAX}
              disabled={saving}
              rows={4}
              autoFocus
              className="w-full resize-y rounded-md border border-hair bg-cream-deep px-4 py-3 font-body text-[15px] leading-relaxed text-ink placeholder:text-faint focus:border-orange"
              dir="auto"
            />
            {editHalal ? (
              <p className="font-body text-[13.5px] font-semibold text-orange-deep">
                {t("community.halalBlocked", { terms: editHalal.join(", ") })}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => void saveEdit()}
                loading={saving}
                disabled={saving || draft.trim().length === 0}
                className="px-5 py-2.5 text-[14px]"
              >
                {t("community.saveEdit")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setEditHalal(null);
                }}
                disabled={saving}
                className="px-5 py-2.5 text-[14px]"
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : isDetail ? (
          <p className="whitespace-pre-wrap font-body text-[15.5px] leading-relaxed text-ink">
            <CommunityIsolatedText text={post.body} />
          </p>
        ) : (
          <div>
            <p
              ref={bodyRef}
              className={`whitespace-pre-wrap font-body text-[15.5px] leading-relaxed text-ink ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              <CommunityIsolatedText text={post.body} />
            </p>
            {overflows || expanded ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 font-body text-[13.5px] font-bold text-muted transition-colors hover:text-orange-deep"
              >
                {expanded ? t("community.seeLess") : t("community.seeMore")}
              </button>
            ) : null}
          </div>
        )}

        {/* Photo grid */}
        {post.images.length > 0 ? (
          <CommunityImageGrid
            images={post.images}
            altStem={author}
            onOpen={(index) => setViewer({ open: true, index })}
          />
        ) : null}

        {/* Attached recipe chip */}
        {recipe ? (
          <Link
            to={`/recipe/${recipe.id}`}
            className="flex items-center gap-3 rounded-md bg-cream-deep p-2.5 transition-colors hover:bg-orange-soft"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white">
              {recipe.image_url ? (
                <img
                  src={recipe.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3v8a2.5 2.5 0 0 0 5 0V3M9.5 11v10M16.5 3c1.4 1.2 2 2.6 2 4.5s-.6 3-2 4v9.5" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-body text-[14px] font-bold text-ink">
              <CommunityIsolatedText text={recipeLabel} />
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-faint rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : null}

        {/* Counts row */}
        {likesCount > 0 || post.comments_count > 0 ? (
          <div className="flex items-center justify-between border-t border-hair pt-2">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              {likesCount > 0 ? (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 text-orange" fill="currentColor">
                    <path d="M12 20.5C6.6 16.6 3.5 13.7 3.5 10.4 3.5 8 5.3 6.3 7.6 6.3c1.7 0 3.2 1 4.4 2.9 1.2-1.9 2.7-2.9 4.4-2.9 2.3 0 4.1 1.7 4.1 4.1 0 3.3-3.1 6.2-8.5 10.1Z" />
                  </svg>
                  <span dir="ltr">{likesCount}</span>
                </>
              ) : null}
            </span>
            {post.comments_count > 0 ? (
              isDetail ? (
                <span className="text-[13px] font-medium text-muted">
                  {post.comments_count === 1
                    ? t("community.commentCountOne")
                    : t("community.commentCount", { n: post.comments_count })}
                </span>
              ) : (
                <Link
                  to={`/post/${post.id}`}
                  className="rounded-pill text-[13px] font-medium text-muted transition-colors hover:text-orange-deep"
                >
                  {post.comments_count === 1
                    ? t("community.commentCountOne")
                    : t("community.commentCount", { n: post.comments_count })}
                </Link>
              )
            ) : null}
          </div>
        ) : null}

        {/* Action row — three equal Facebook-style tabs */}
        <div className="-mx-4 flex border-y border-hair sm:-mx-5">
          <button
            type="button"
            onClick={() => void handleLike()}
            aria-pressed={liked}
            aria-label={t("community.likeAction")}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 font-body text-[14px] font-bold transition-colors hover:bg-cream-deep ${
              liked ? "text-orange-deep" : "text-muted hover:text-ink"
            }`}
          >
            {liked ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-orange" fill="currentColor">
                <path d="M12 20.5C6.6 16.6 3.5 13.7 3.5 10.4 3.5 8 5.3 6.3 7.6 6.3c1.7 0 3.2 1 4.4 2.9 1.2-1.9 2.7-2.9 4.4-2.9 2.3 0 4.1 1.7 4.1 4.1 0 3.3-3.1 6.2-8.5 10.1Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                <path d="M12 20.5C6.6 16.6 3.5 13.7 3.5 10.4 3.5 8 5.3 6.3 7.6 6.3c1.7 0 3.2 1 4.4 2.9 1.2-1.9 2.7-2.9 4.4-2.9 2.3 0 4.1 1.7 4.1 4.1 0 3.3-3.1 6.2-8.5 10.1Z" />
              </svg>
            )}
            {t("community.likeAction")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isDetail) onRequestComment?.();
              else navigate(`/post/${post.id}`);
            }}
            aria-label={t("community.commentAction")}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 font-body text-[14px] font-bold text-muted transition-colors hover:bg-cream-deep hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L4 21l1.5-4.4A8.5 8.5 0 1 1 21 12Z" />
            </svg>
            {t("community.commentAction")}
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label={t("community.shareA11y")}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 font-body text-[14px] font-bold text-muted transition-colors hover:bg-cream-deep hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 5l6 5-6 5V5Z" />
              <path d="M19 10H9.5A5.5 5.5 0 0 0 4 15.5V19" />
            </svg>
            {t("community.shareAction")}
          </button>
        </div>

        {/* Sign-in prompt (anon like/comment/moderation attempt) */}
        {needsAuth ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="font-body text-[13.5px] text-muted">{t("community.signInPrompt")}</p>
            <Link
              to="/login"
              className="rounded-pill bg-orange px-4 py-2 font-body text-[13px] font-bold text-white transition-colors hover:bg-orange-deep"
            >
              {t("common.signIn")}
            </Link>
          </div>
        ) : null}
      </Card>

      {/* Fullscreen photo viewer */}
      {viewer.open && post.images.length > 0 ? (
        <CommunityLightbox
          images={post.images}
          startIndex={viewer.index}
          alt={t("community.photoAlt", { name: author })}
          onClose={() => setViewer((v) => ({ ...v, open: false }))}
        />
      ) : null}

      {/* Moderation confirms (one at a time) */}
      {confirm?.kind === "deletePost" ? (
        <CommunityConfirmDialog
          title={t("community.deletePost")}
          message={t("community.deletePostConfirm")}
          confirmLabel={t("common.delete")}
          destructive
          busy={actionBusy}
          onConfirm={() => void finishDelete()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === "reportPost" ? (
        <CommunityConfirmDialog
          title={t("community.reportPost")}
          message={t("community.reportConfirm")}
          confirmLabel={t("community.reportPost")}
          busy={actionBusy}
          onConfirm={() => void finishReport()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === "blockAuthor" ? (
        <CommunityConfirmDialog
          title={t("community.blockUser")}
          message={t("community.blockConfirm", { name: author })}
          confirmLabel={t("community.blockBtn")}
          destructive
          busy={actionBusy}
          onConfirm={() => void finishBlock()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === "blocked" ? (
        <CommunityConfirmDialog
          title={t("community.blocked")}
          confirmLabel={t("common.ok")}
          hideCancel
          onConfirm={() => {
            if (isDetail) onGone?.();
            else onRemove?.(post.id);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}
