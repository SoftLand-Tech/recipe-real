/**
 * Community notes section (slice RECIPE): paginated public notes with an
 * authed compose row, owner delete + everyone-else report (both confirmed),
 * and the halal-gate 422 surfaced inline with the offending terms.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { isOfflineError, isRateLimitedError } from "@/api/http";
import { isUnauthorizedError } from "@/api/cook";
import {
  deleteRecipeNote,
  fetchRecipeNotes,
  HalalRejectionError,
  postRecipeNote,
  reportRecipeNote,
} from "@/api/notes";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";
import { useT } from "@/i18n";
import type { RecipeNote } from "@/api/types";
import { useRelativeDate } from "@/routes/recipe/RecipeLocalizedText";

/** Display name of a note author: display_name, else the account name. */
function noteAuthorName(user: RecipeNote["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Small inline confirm bar (web stand-in for mobile's Alert confirm). */
function ConfirmBar({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={message}
      className="flex flex-wrap items-center gap-3 rounded-md border border-hair bg-cream-deep px-4 py-3"
    >
      <p className="flex-1 text-[13.5px] font-semibold text-ink">{message}</p>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-pill px-3.5 py-1.5 font-body text-[13px] font-bold text-muted hover:text-ink"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-pill bg-orange px-3.5 py-1.5 font-body text-[13px] font-bold text-white hover:bg-orange-deep"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function NoteRow({
  note,
  mine,
  reported,
  onDelete,
  onReport,
}: {
  note: RecipeNote;
  mine: boolean;
  reported: boolean;
  onDelete: (note: RecipeNote) => void;
  onReport: (note: RecipeNote) => void;
}) {
  const t = useT();
  const rel = useRelativeDate();
  const author = noteAuthorName(note.user);
  const initial = author.charAt(0).toUpperCase() || "?";
  // Localized "3 days ago" — empty string when the timestamp can't be read.
  const relText = rel(note.created_at);

  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-soft text-[14px] font-extrabold text-orange-deep">
        {note.user.avatar_url ? (
          <img
            src={note.user.avatar_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14px] font-bold text-ink">{author}</span>
          {relText !== "" ? (
            <span className="text-[12px] text-faint">{relText}</span>
          ) : null}
          {mine ? (
            <button
              type="button"
              onClick={() => onDelete(note)}
              aria-label={t("common.delete")}
              title={t("common.delete")}
              className="ms-auto rounded-md p-1 text-faint hover:text-orange-deep"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReport(note)}
              aria-label={t("recipe.reportAction")}
              title={t("recipe.reportAction")}
              className="ms-auto rounded-md p-1 text-faint hover:text-orange-deep"
            >
              {reported ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 21v-5M5 12a7 7 0 0 1 14 0v4h-4l-3 3v-3H5Z" transform="translate(0 -2)" />
                </svg>
              )}
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
          {note.body}
        </p>
      </div>
    </li>
  );
}

export function RecipeNotesSection({
  recipeId,
  authed,
  myUserId,
}: {
  recipeId: number;
  authed: boolean;
  myUserId: number | null;
}) {
  const t = useT();

  const [notes, setNotes] = useState<RecipeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [reportedIds, setReportedIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  /** Pending confirm: delete or report target note (one at a time). */
  const [confirmDelete, setConfirmDelete] = useState<RecipeNote | null>(null);
  const [confirmReport, setConfirmReport] = useState<RecipeNote | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 3000);
  }, []);
  useEffect(
    () => () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRecipeNotes(recipeId, targetPage);
        setNotes((prev) => {
          if (targetPage === 1) return result.notes;
          const seen = new Set(prev.map((n) => n.id));
          return [...prev, ...result.notes.filter((n) => !seen.has(n.id))];
        });
        setHasMore(result.hasMore);
        setPage(targetPage);
      } catch (err) {
        if (isOfflineError(err)) setError(t("common.offline"));
        else if (isRateLimitedError(err)) setError(t("common.rateLimited"));
        else setError(t("recipe.notesLoadFailed"));
        if (targetPage === 1) {
          setNotes([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [recipeId, t],
  );

  useEffect(() => {
    // Deferred one microtask: the loader setStates synchronously before its
    // first await, which the hooks lint forbids directly in an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load(1);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onSend = useCallback(async () => {
    const body = draft.trim();
    if (body === "" || posting) return;
    setPosting(true);
    setPostError(null);
    setHalalTerms(null);
    setNeedsAuth(false);
    try {
      const created = await postRecipeNote(recipeId, body);
      setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
      setDraft("");
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
        setPostError(t("recipe.noteHalalBlocked", { terms: err.terms.join(", ") }));
      } else if (isUnauthorizedError(err)) {
        setNeedsAuth(true);
        setPostError(t("recipe.notesSignIn"));
      } else if (isOfflineError(err)) {
        setPostError(t("common.offline"));
      } else {
        setPostError(t("recipe.notePostFailed"));
      }
    } finally {
      setPosting(false);
    }
  }, [draft, posting, recipeId, t]);

  const onConfirmDelete = useCallback(async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    if (!target) return;
    try {
      await deleteRecipeNote(recipeId, target.id);
      setNotes((prev) => prev.filter((n) => n.id !== target.id));
      setReportedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      showFlash(t("recipe.noteDeleted"));
    } catch {
      // Leave the note in place; a retry is available via the button again.
      setPostError(t("recipe.notePostFailed"));
    }
  }, [confirmDelete, recipeId, showFlash, t]);

  const onConfirmReport = useCallback(async () => {
    const target = confirmReport;
    setConfirmReport(null);
    if (!target || reportedIds.has(target.id)) return;
    try {
      await reportRecipeNote(recipeId, target.id);
      setReportedIds((prev) => new Set(prev).add(target.id));
      showFlash(t("recipe.noteReported"));
    } catch {
      // Silent: the flag icon stays un-reported and can be tapped again.
    }
  }, [confirmReport, recipeId, reportedIds, showFlash, t]);

  return (
    <Card className="px-6 py-6">
      <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
        {t("recipe.notesTitle")}
      </h2>

      {confirmDelete != null ? (
        <div className="mt-4">
          <ConfirmBar
            message={t("recipe.noteDeleteConfirmTitle")}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            onConfirm={() => void onConfirmDelete()}
            onCancel={() => setConfirmDelete(null)}
          />
        </div>
      ) : null}
      {confirmReport != null ? (
        <div className="mt-4">
          <ConfirmBar
            message={t("recipe.noteReportConfirmTitle")}
            confirmLabel={t("recipe.reportAction")}
            cancelLabel={t("common.cancel")}
            onConfirm={() => void onConfirmReport()}
            onCancel={() => setConfirmReport(null)}
          />
        </div>
      ) : null}

      {error != null ? (
        <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <Button variant="ghost" onClick={() => void load(1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : loading && notes.length === 0 ? (
        <ul className="mt-5 flex flex-col gap-5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-start gap-3">
              <Skeleton circle className="h-9 w-9 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : notes.length === 0 ? (
        <p className="mt-5 text-[14px] leading-relaxed text-muted">
          {t("recipe.notesEmpty")}
        </p>
      ) : (
        <>
          <ul className="mt-5 flex flex-col gap-5">
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                mine={myUserId != null && note.user.id === myUserId}
                reported={reportedIds.has(note.id)}
                onDelete={setConfirmDelete}
                onReport={setConfirmReport}
              />
            ))}
          </ul>
          {flash != null ? (
            <p className="mt-4 text-[13px] font-bold text-muted" role="status">
              {flash}
            </p>
          ) : null}
          {hasMore ? (
            <div className="mt-4 flex justify-center">
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => void load(page + 1)}
                  aria-label={t("recipe.loadMoreNotes")}
                >
                  {t("recipe.loadMoreNotes")}
                </Button>
              )}
            </div>
          ) : null}
        </>
      )}

      {authed ? (
        <form
          className="mt-6 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void onSend();
          }}
        >
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              value={draft}
              maxLength={1000}
              onChange={(e) => {
                setDraft(e.target.value);
                if (postError) setPostError(null);
                if (halalTerms) setHalalTerms(null);
              }}
              placeholder={t("recipe.noteComposePlaceholder")}
              aria-label={t("recipe.noteComposePlaceholder")}
              disabled={posting}
              className="min-w-0 flex-1 rounded-md border border-hair bg-cream-deep px-3.5 py-2.5 font-body text-[14.5px] text-ink placeholder:text-faint focus-visible:bg-white disabled:opacity-60"
            />
            <Button
              type="submit"
              loading={posting}
              disabled={posting || draft.trim().length === 0}
              className="shrink-0 px-5 py-2.5 text-[14px]"
            >
              {t("recipe.noteSend")}
            </Button>
          </div>
          {halalTerms != null ? (
            <p className="text-[13px] font-semibold text-orange-deep">
              {halalTerms.join(", ")}
            </p>
          ) : null}
          {postError != null && halalTerms == null ? (
            <p className="text-[13px] font-semibold text-orange-deep" role="alert">
              {postError}
            </p>
          ) : null}
          {needsAuth ? (
            <Link
              to="/login"
              className="self-start font-body text-[13.5px] font-extrabold text-orange-deep hover:underline"
            >
              {t("common.signIn")}
            </Link>
          ) : null}
        </form>
      ) : (
        <Link
          to="/login"
          className="mt-6 inline-block font-body text-[14px] font-bold text-orange-deep hover:underline"
        >
          {t("recipe.notesSignIn")}
        </Link>
      )}
    </Card>
  );
}
