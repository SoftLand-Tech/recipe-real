/**
 * One comment row under a post (slice COMMUNITY) — mobile's CommentRow
 * pattern: avatar + name in a soft bubble, body (direction-isolated),
 * relative time + edited marker, then the author-sensitive affordances:
 * edit/delete your own (inline edit), report someone else's. The screen
 * owns the API calls; onSave resolves true to exit edit mode.
 */
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { useT } from "@/i18n";
import { authorName, relativeDate } from "@/routes/community/CommunityHelpers";
import { CommunityAvatar } from "@/routes/community/CommunityAvatar";
import { CommunityIsolatedText } from "@/routes/community/CommunityIsolatedText";
import type { PostComment } from "@/api/types";

/** Max comment body length (server-validated; mirrored client-side). */
export const COMMENT_BODY_MAX = 1000;

export interface PostCommentRowProps {
  comment: PostComment;
  /** Whether the signed-in user authored this comment (edit/delete). */
  mine: boolean;
  /** Local-only "already reported" marker (no server echo). */
  reported: boolean;
  /** Persist an edit; resolves true on success (row exits edit mode). */
  onSave: (comment: PostComment, body: string) => Promise<boolean>;
  /** Opens the delete confirm flow (owned by the page). */
  onDelete: (comment: PostComment) => void;
  /** Opens the report confirm flow (owned by the page). */
  onReport: (comment: PostComment) => void;
}

export function PostCommentRow({
  comment,
  mine,
  reported,
  onSave,
  onDelete,
  onReport,
}: PostCommentRowProps) {
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setDraft(comment.body);
    setEditing(true);
  };

  const save = async () => {
    const body = draft.trim();
    if (body.length === 0 || busy) return;
    setBusy(true);
    try {
      if (await onSave(comment, body)) setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const author = authorName(comment.user);
  const caption = [
    relativeDate(t, comment.created_at),
    comment.edited ? t("community.edited") : null,
  ].filter((part): part is string => part != null && part !== "");

  if (editing) {
    return (
      <div className="flex gap-3">
        <CommunityAvatar name={author} uri={comment.user.avatar_url} size={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={COMMENT_BODY_MAX}
            rows={2}
            disabled={busy}
            autoFocus
            dir="auto"
            className="w-full resize-y rounded-md border border-hair bg-cream-deep px-3 py-2 font-body text-[14px] leading-relaxed text-ink focus:border-orange"
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void save()}
              loading={busy}
              disabled={busy || draft.trim().length === 0}
              className="px-4 py-2 text-[13.5px]"
            >
              {t("community.saveEdit")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-4 py-2 text-[13.5px]"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Link
        to={`/u/${comment.user.id}`}
        className="shrink-0 rounded-pill transition-opacity hover:opacity-80"
        aria-label={t("community.viewProfile", { name: author })}
      >
        <CommunityAvatar name={author} uri={comment.user.avatar_url} size={32} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="max-w-full self-start rounded-md bg-cream-deep px-3 py-2">
          <Link
            to={`/u/${comment.user.id}`}
            className="font-body text-[13.5px] font-bold text-ink transition-colors hover:text-orange-deep"
          >
            <CommunityIsolatedText text={author} />
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap font-body text-[14px] leading-relaxed text-ink">
            <CommunityIsolatedText text={comment.body} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-1">
          {caption.length > 0 ? (
            <span className="text-[12px] font-medium text-faint">{caption.join(" · ")}</span>
          ) : null}
          {mine ? (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="rounded-pill text-[12.5px] font-bold text-muted transition-colors hover:text-orange-deep"
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="rounded-pill text-[12.5px] font-bold text-muted transition-colors hover:text-orange-deep"
              >
                {t("common.delete")}
              </button>
            </>
          ) : reported ? (
            <span className="text-[12px] font-semibold text-faint">
              {t("community.reported")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onReport(comment)}
              className="rounded-pill text-[12.5px] font-bold text-muted transition-colors hover:text-orange-deep"
            >
              {t("community.reportAction")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
