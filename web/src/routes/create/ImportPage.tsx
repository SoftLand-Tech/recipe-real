/**
 * AI import page — /create/import. OWNED BY SLICE CREATE (auth-gated).
 *
 * Faithful web port of the mobile flow (recipe-import.tsx + profile's import
 * track + the composer's importId publish mode):
 *
 *   • New import form: public URL OR primary image/video file (sent directly
 *     as multipart primary_file — the pipeline stores its own assets) plus
 *     optional extra images. Throttled 10/min server-side.
 *   • Queue list (GET /api/recipe-imports): status chips queued/processing/
 *     ready/failed/published, gentle polling (~4s) while anything is
 *     in-flight — stops on unmount and when all rows settle, backs off with
 *     a toast on 429.
 *   • Draft review (?review=<id>): a ready import's draft rendered in the
 *     shared ComposerForm, prefilled and fully editable; publishing is an
 *     EXPLICIT action (never auto), with copy that makes clear it goes
 *     public. Halal-gate rejections surface verbatim. Failed imports show
 *     the server error verbatim with retry (≤3/24h) + delete.
 *
 * The import→review→publish loop is private-by-default: nothing leaves the
 * owner's account until the Publish button is pressed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import {
  createRecipeImport,
  deleteRecipeImport,
  getRecipeImport,
  listMyRecipeImports,
  publishRecipeImport,
  retryRecipeImport,
} from "@/api/imports";
import { fetchComposerCategories } from "@/api/userRecipes";
import { isRateLimitedError } from "@/api/http";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import {
  ComposerForm,
  splitBilingualPair,
  type ComposerInitialData,
  type ComposerStepDraft,
  type ComposerSubmitInput,
} from "@/components/ComposerForm";
import { CreateConfirmDialog } from "@/components/CreateConfirmDialog";
import { useLang, useT } from "@/i18n";
import { cn } from "@/utils/cn";

import type {
  CategoryCount,
  Recipe,
  RecipeImportRecord,
} from "@/api/types";

/** Poll cadence: gentle — the mobile track uses 8s; extraction takes minutes. */
const POLL_MS = 4_000;
const POLL_MAX_MS = 30_000;

/** Upload limits mirrored from the CreateRecipeImportRequest defaults. */
const MAX_VIDEO_MB = 100;
const MAX_IMAGE_MB = 8;
const MAX_EXTRA_IMAGES = 6;
const PRIMARY_MIME_RE = /^image\/(jpe?g|png|webp|heic)$/i;

/** Statuses that still need server work before review is possible. */
function isPendingStatus(status: string): boolean {
  return status === "queued" || status === "processing";
}

export default function ImportPage() {
  const [params, setParams] = useSearchParams();
  const reviewParam = params.get("review");
  const reviewId =
    reviewParam != null && /^\d+$/.test(reviewParam) ? Number(reviewParam) : null;

  const exitReview = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("review");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  if (reviewId != null) {
    return <ImportReview key={reviewId} id={reviewId} onExit={exitReview} />;
  }
  return <ImportQueue />;
}

// ---- Queue + new-import form -------------------------------------------------------

function ImportQueue() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState<RecipeImportRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // New-import form state.
  const [sourceUrl, setSourceUrl] = useState("");
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Stable identity (no deps): the poll loop, the mount effect and the row
  // actions all share this one fetcher.
  const load = useCallback(async () => {
    try {
      const list = await listMyRecipeImports();
      setRows(list);
      setLoadFailed(false);
    } catch (err) {
      if (isRateLimitedError(err)) throw err; // poll loop backs off on 429
      // Rows already on screen stay; only a failed FIRST load shows the
      // retry card (rows === null && loadFailed).
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: load() only setStates from async continuations, but the
    // rule's interprocedural check can't see the await boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // ---- Gentle polling while anything is in-flight -----------------------------
  const hasActive = useMemo(
    () => (rows ?? []).some((row) => isPendingStatus(row.status)),
    [rows],
  );

  useEffect(() => {
    if (!hasActive) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = POLL_MS;
    let warned = false;

    const tick = async () => {
      try {
        await load();
        delay = POLL_MS;
        warned = false;
      } catch (err) {
        if (isRateLimitedError(err)) {
          // Back off exponentially (capped); toast once per episode.
          delay = Math.min(delay * 2, POLL_MAX_MS);
          if (!warned) {
            warned = true;
            toast.error(t("import.pollRateLimited"));
          }
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [hasActive, load, toast, t]);

  // ---- Row actions ---------------------------------------------------------------

  const [busyRowId, setBusyRowId] = useState<number | null>(null);
  const [deleteRow, setDeleteRow] = useState<RecipeImportRecord | null>(null);

  const retry = useCallback(
    async (id: number) => {
      setBusyRowId(id);
      try {
        await retryRecipeImport(id);
        await load();
      } catch (err) {
        toast.error(
          isRateLimitedError(err)
            ? t("import.retryLimit")
            : t("import.retryFailed"),
        );
      } finally {
        setBusyRowId(null);
      }
    },
    [load, toast, t],
  );

  const confirmDelete = useCallback(async () => {
    if (deleteRow == null) return;
    setBusyRowId(deleteRow.id);
    try {
      await deleteRecipeImport(deleteRow.id);
      setRows((prev) =>
        prev ? prev.filter((row) => row.id !== deleteRow.id) : prev,
      );
      setDeleteRow(null);
      toast.show(t("import.deletedToast"));
    } catch {
      toast.error(t("import.deleteFailed"));
    } finally {
      setBusyRowId(null);
    }
  }, [deleteRow, toast, t]);

  // ---- New import ----------------------------------------------------------------

  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraInputRef = useRef<HTMLInputElement | null>(null);

  const pickPrimary = useCallback(
    (files: FileList | null) => {
      const file = files?.[0] ?? null;
      if (file == null) return;
      const isVideo = file.type.startsWith("video/");
      const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (!isVideo && !PRIMARY_MIME_RE.test(file.type)) {
        setFormError(t("import.unsupportedType"));
        return;
      }
      if (file.size > limitMb * 1024 * 1024) {
        setFormError(t("import.fileTooBig", { mb: limitMb }));
        return;
      }
      setFormError(null);
      setPrimaryFile(file);
    },
    [t],
  );

  const pickExtra = useCallback(
    (files: FileList | null) => {
      if (files == null) return;
      const picked = Array.from(files);
      const bad = picked.find((file) => !PRIMARY_MIME_RE.test(file.type));
      if (bad != null) {
        setFormError(t("import.unsupportedType"));
        return;
      }
      const tooBig = picked.find(
        (file) => file.size > MAX_IMAGE_MB * 1024 * 1024,
      );
      if (tooBig != null) {
        setFormError(t("import.fileTooBig", { mb: MAX_IMAGE_MB }));
        return;
      }
      setFormError(null);
      setExtraFiles((current) =>
        [...current, ...picked].slice(0, MAX_EXTRA_IMAGES),
      );
    },
    [t],
  );

  const startImport = useCallback(async () => {
    if (starting) return;
    const url = sourceUrl.trim();
    if (url === "" && primaryFile == null) {
      setFormError(t("import.sourceRequired"));
      return;
    }
    if (url !== "" && !/^https?:\/\/.+/i.test(url)) {
      setFormError(t("import.urlInvalid"));
      return;
    }
    setStarting(true);
    setFormError(null);
    try {
      await createRecipeImport({
        sourceUrl: url !== "" ? url : undefined,
        primary: primaryFile ?? undefined,
        extraImages: extraFiles.length > 0 ? extraFiles : undefined,
      });
      setSourceUrl("");
      setPrimaryFile(null);
      setExtraFiles([]);
      toast.show(t("import.createdToast"));
      await load();
    } catch (err) {
      if (isRateLimitedError(err)) {
        setFormError(t("import.rateLimited"));
      } else {
        // Surface the server's own message verbatim (e.g. the rollout
        // allowlist's "Recipe import is not available yet.").
        const message = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;
        setFormError(message ?? t("import.failed"));
      }
    } finally {
      setStarting(false);
    }
  }, [starting, sourceUrl, primaryFile, extraFiles, load, toast, t]);

  // ---- Render ----------------------------------------------------------------------

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          to="/create"
          className="inline-flex items-center gap-1.5 self-start rounded-pill px-3 py-1.5 font-body text-[14px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 rtl:-scale-x-100"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
          {t("common.back")}
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,3.5vw,2.1rem)] font-semibold leading-tight text-ink">
          {t("import.pageTitle")}
        </h1>
        <p className="font-body text-[14.5px] leading-relaxed text-muted">
          {t("import.subtitle")}
        </p>
      </header>

      {/* New import form */}
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
            {t("import.sourceTitle")}
          </h2>
          <p className="mt-1 font-body text-[13.5px] leading-relaxed text-muted">
            {t("import.sourceUrlHint")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="import-url"
            className="font-body text-[13px] font-bold tracking-wide text-muted"
          >
            {t("import.sourceUrl")}
          </label>
          <input
            id="import-url"
            type="url"
            dir="ltr"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder={t("import.sourceUrlPlaceholder")}
            disabled={starting}
            className="w-full rounded-md border border-hair bg-white px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-faint"
          />
        </div>

        {/* Primary source file (video or image) */}
        <div className="flex flex-col gap-2.5">
          <span className="font-body text-[13px] font-bold tracking-wide text-muted">
            {t("import.primary")}
          </span>
          {primaryFile ? (
            <MediaRow
              name={primaryFile.name}
              kind={primaryFile.type.startsWith("video/") ? "video" : "image"}
              onRemove={() => setPrimaryFile(null)}
              removeLabel={t("import.remove")}
            />
          ) : (
            <button
              type="button"
              onClick={() => primaryInputRef.current?.click()}
              disabled={starting}
              className="flex items-center gap-3 rounded-md border border-dashed border-faint/60 bg-cream-deep px-4 py-3.5 text-start transition-colors hover:border-orange"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-6 w-6 shrink-0 text-orange-deep"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V6m0 0L8.5 9.5M12 6l3.5 3.5" />
                <path d="M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2" />
              </svg>
              <span className="font-body text-[13.5px] font-semibold text-muted">
                {t("import.choosePrimary")}
                <span className="block text-[12px] font-medium text-faint">
                  {t("import.primaryHint")}
                </span>
              </span>
            </button>
          )}
        </div>

        {/* Extra images */}
        <div className="flex flex-col gap-2.5">
          <span className="font-body text-[13px] font-bold tracking-wide text-muted">
            {t("import.attachments")}
          </span>
          {extraFiles.map((file) => (
            <MediaRow
              key={`${file.name}:${file.size}`}
              name={file.name}
              kind="image"
              onRemove={() =>
                setExtraFiles((current) =>
                  current.filter(
                    (row) => !(row.name === file.name && row.size === file.size),
                  ),
                )
              }
              removeLabel={t("import.remove")}
            />
          ))}
          {extraFiles.length < MAX_EXTRA_IMAGES ? (
            <button
              type="button"
              onClick={() => extraInputRef.current?.click()}
              disabled={starting}
              className="self-start rounded-pill border border-[#E8DFD2] bg-white px-5 py-2 font-body text-[13.5px] font-bold text-ink transition-colors hover:border-orange hover:text-orange-deep"
            >
              {t("import.addAttachments")}
            </button>
          ) : null}
        </div>

        <input
          ref={primaryInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-m4v,video/webm,image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            pickPrimary(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={extraInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            pickExtra(e.target.files);
            e.target.value = "";
          }}
        />

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-dark-2 px-4 py-3 font-body text-[14px] font-semibold text-white"
          >
            {formError}
          </p>
        ) : null}

        <Button
          onClick={() => void startImport()}
          loading={starting}
          className="self-start px-8"
        >
          {starting ? t("import.processing") : t("import.start")}
        </Button>
      </Card>

      {/* Queue */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
            {t("import.queueTitle")}
          </h2>
          <p className="mt-1 font-body text-[13.5px] leading-relaxed text-muted">
            {t("import.queueSubtitle")}
          </p>
        </div>

        {rows == null && loadFailed ? (
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="font-body text-[15px] font-semibold text-ink">
              {t("import.loadFailed")}
            </p>
            <Button
              variant="ghost"
              className="px-5 py-2.5 text-[14px]"
              onClick={() => void load()}
            >
              {t("common.retry")}
            </Button>
          </Card>
        ) : rows == null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-card" />
            <Skeleton className="h-20 w-full rounded-card" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={t("import.emptyTitle")}
            body={t("import.emptyBody")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <ImportRow
                key={row.id}
                row={row}
                busy={busyRowId === row.id}
                onReview={() =>
                  navigate({ pathname: "/create/import", search: `?review=${row.id}` })
                }
                onRetry={() => void retry(row.id)}
                onDelete={() => setDeleteRow(row)}
                onViewRecipe={
                  row.status === "published" && row.recipe_id != null
                    ? () => navigate(`/recipe/${row.recipe_id}`)
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

      <CreateConfirmDialog
        open={deleteRow != null}
        title={t("import.deleteConfirmTitle")}
        body={t("import.deleteConfirmMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={busyRowId === deleteRow?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteRow(null)}
      />
    </div>
  );
}

// ---- One queue row -------------------------------------------------------------------

function ImportRow({
  row,
  busy,
  onReview,
  onRetry,
  onDelete,
  onViewRecipe,
}: {
  row: RecipeImportRecord;
  busy: boolean;
  onReview: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onViewRecipe?: () => void;
}) {
  const t = useT();

  const sourceLabel =
    row.source_kind === "video"
      ? t("import.kindVideo")
      : row.source_kind === "image"
        ? t("import.kindImage")
        : row.source_platform ?? row.source_url ?? t("import.kindLink");

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <ImportStatusChip row={row} />
          <span
            dir="auto"
            className="min-w-0 flex-1 truncate font-body text-[14.5px] font-semibold text-ink"
            title={sourceLabel}
          >
            {sourceLabel}
          </span>
        </div>

        {row.status === "failed" && row.error?.message ? (
          <p className="rounded-md bg-dark-2 px-3.5 py-2.5 font-body text-[13px] font-semibold text-white">
            {row.error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          {row.status === "ready" ? (
            <Button
              className="px-6 py-2.5 text-[14px]"
              onClick={onReview}
              disabled={busy}
            >
              {t("import.review")}
            </Button>
          ) : null}
          {row.status === "failed" ? (
            <Button
              variant="ghost"
              className="px-5 py-2.5 text-[14px]"
              onClick={onRetry}
              disabled={busy}
            >
              {t("import.retry")}
            </Button>
          ) : null}
          {onViewRecipe ? (
            <Button
              variant="ghost"
              className="px-5 py-2.5 text-[14px]"
              onClick={onViewRecipe}
            >
              {t("import.viewRecipe")}
            </Button>
          ) : null}
          {row.status !== "published" ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-pill px-3.5 py-2 font-body text-[13.5px] font-bold text-muted transition-colors hover:text-orange-deep disabled:opacity-50"
            >
              {t("import.dismiss")}
            </button>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

/** Status chip (+ progress line while processing). Teal never appears here. */
function ImportStatusChip({ row }: { row: RecipeImportRecord }) {
  const t = useT();
  if (row.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-orange-soft px-3 py-1 font-body text-[12px] font-bold text-orange-deep">
        <Spinner size="sm" />
        {t("import.extracting", { n: Math.round(row.progress) })}
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    queued: {
      label: t("import.statusQueued"),
      cls: "bg-cream-deep text-muted",
    },
    ready: {
      label: t("import.statusReady"),
      cls: "bg-orange-soft text-orange-deep",
    },
    failed: {
      label: t("import.statusFailed"),
      cls: "bg-dark-2 text-white",
    },
    published: {
      label: t("import.statusPublished"),
      cls: "border border-hair bg-white text-muted",
    },
  };
  const entry = map[row.status] ?? {
    label: row.status,
    cls: "bg-cream-deep text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 font-body text-[12px] font-extrabold tracking-wide",
        entry.cls,
      )}
    >
      {entry.label}
    </span>
  );
}

/** Picked-file row (name + kind icon + remove). */
function MediaRow({
  name,
  kind,
  onRemove,
  removeLabel,
}: {
  name: string;
  kind: "video" | "image";
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-hair bg-cream-deep px-3.5 py-2.5">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-orange-deep"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "video" ? (
          <>
            <rect x="3.5" y="6" width="12.5" height="12" rx="2.5" />
            <path d="m16 11 4.5-2.5v7L16 13" />
          </>
        ) : (
          <>
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m5.5 16.5 4-4 3 3 3-2.5 3 2.5" />
          </>
        )}
      </svg>
      <span dir="auto" className="min-w-0 flex-1 truncate font-body text-[13.5px] font-semibold text-ink">
        {name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-hair bg-white text-muted transition-colors hover:border-orange hover:text-orange-deep"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

// ---- Draft review (?review=<id>) --------------------------------------------------------

function ImportReview({ id, onExit }: { id: number; onExit: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const navigate = useNavigate();

  const [record, setRecord] = useState<RecipeImportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const row = await getRecipeImport(id);
      setRecord(row);
    } catch (err) {
      setLoadError(
        isRateLimitedError(err)
          ? 429
          : ((err as { response?: { status?: number } })?.response?.status ??
            0),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Deferred one microtask: load() setStates synchronously before its
    // first await, which the hooks lint forbids directly in an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchComposerCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        // Picker stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const initial: ComposerInitialData | null = useMemo(
    () => (record?.draft ? draftToInitial(record, lang) : null),
    [record, lang],
  );

  const saveDraft = useCallback(
    async (input: ComposerSubmitInput) => publishRecipeImport(id, input),
    [id],
  );

  const onSaved = useCallback(
    (recipe: Recipe) => {
      toast.show(t("import.publishedToast"));
      navigate(`/recipe/${recipe.id}`);
    },
    [navigate, toast, t],
  );

  const onDeleteDraft = useCallback(async () => {
    try {
      await deleteRecipeImport(id);
      onExit();
    } catch {
      toast.error(t("import.deleteFailed"));
    }
  }, [id, onExit, toast, t]);

  // ---- Render --------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label={t("common.loading")} />
      </div>
    );
  }

  if (loadError != null || record == null) {
    return (
      <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <p className="font-body text-[15px] font-semibold text-ink">
          {loadError === 404
            ? t("import.notFound")
            : loadError === 429
              ? t("common.rateLimited")
              : t("import.loadFailed")}
        </p>
        <Button
          variant="ghost"
          className="px-5 py-2.5 text-[14px]"
          onClick={() => void load()}
        >
          {t("common.retry")}
        </Button>
      </Card>
    );
  }

  // Not reviewable: still extracting → back to the queue (it polls); already
  // published → straight to the recipe.
  if (record.status !== "ready" || record.draft == null) {
    return (
      <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <ImportStatusChip row={record} />
        <p className="font-body text-[15px] leading-relaxed text-muted">
          {record.status === "published"
            ? t("import.alreadyPublished")
            : isPendingStatus(record.status)
              ? t("import.notReady")
              : t("import.importFailed")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {record.status === "published" && record.recipe_id != null ? (
            <Button
              className="px-6 py-2.5 text-[14px]"
              onClick={() => navigate(`/recipe/${record.recipe_id}`)}
            >
              {t("import.viewRecipe")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="px-5 py-2.5 text-[14px]"
            onClick={onExit}
          >
            {t("import.backToQueue")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 self-start rounded-pill px-3 py-1.5 font-body text-[14px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 rtl:-scale-x-100"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
          {t("import.backToQueue")}
        </button>
        <h1 className="font-display text-[clamp(1.6rem,3.5vw,2.1rem)] font-semibold leading-tight text-ink">
          {t("import.reviewTitle")}
        </h1>
        <p className="font-body text-[14.5px] leading-relaxed text-muted">
          {t("import.reviewSubtitle")}
        </p>
      </header>

      {initial != null ? (
        <ComposerForm
          mode="publish"
          initial={initial}
          categories={categories}
          importWarnings={record.warnings}
          actionNotice={t("import.publishNotice")}
          save={saveDraft}
          onSaved={onSaved}
          onDelete={onDeleteDraft}
        />
      ) : null}
    </div>
  );
}

/** Port of mobile's import-draft prefill (draft → composer rows). */
function draftToInitial(
  record: RecipeImportRecord,
  lang: "en" | "ar",
): ComposerInitialData {
  const draft = record.draft!;
  const titlePair = splitBilingualPair(draft.title, draft.title_ar, lang);

  const draftIngredients = Array.isArray(draft.ingredients)
    ? draft.ingredients
    : [];
  const ingRows = draftIngredients
    .map((ingredient) => ingredient?.raw?.trim())
    .filter((row): row is string => Boolean(row));
  const safeIngredients = ingRows.length > 0 ? ingRows : [""];

  const draftSteps = Array.isArray(draft.steps) ? draft.steps : [];
  const stepRows: ComposerStepDraft[] =
    draftSteps.length > 0
      ? draftSteps.map((step) => {
          const pair = splitBilingualPair(
            step.description,
            step.description_ar,
            lang,
          );
          return {
            description: pair.en,
            description_ar: pair.ar,
            minutes:
              step.minutes_estimated != null
                ? String(Math.round(step.minutes_estimated))
                : "",
            literal_minutes:
              step.literal_minutes != null
                ? String(Math.round(step.literal_minutes))
                : "",
            step_type:
              step.step_type === "passive" || step.step_type === "cleanup"
                ? step.step_type
                : "active",
          };
        })
      : [
          {
            description: "",
            description_ar: "",
            minutes: "",
            literal_minutes: "",
            step_type: "active",
          },
        ];

  const safeSourceUrl =
    record.source_url ?? draft.attribution?.source_url ?? "";

  return {
    title: titlePair.en,
    titleAr: titlePair.ar,
    description: draft.description ?? "",
    sourceUrl: safeSourceUrl,
    servings:
      draft.servings != null ? String(Math.round(draft.servings)) : "",
    minutes:
      draft.total_time_minutes != null
        ? String(Math.round(draft.total_time_minutes))
        : "",
    prepMinutes:
      draft.prep_time_minutes != null
        ? String(Math.round(draft.prep_time_minutes))
        : "",
    cookMinutes:
      draft.cook_time_minutes != null
        ? String(Math.round(draft.cook_time_minutes))
        : "",
    ingredients: safeIngredients,
    steps: stepRows,
    imageUrl: draft.cover_image_url ?? null,
    structuredItems: draftIngredients.map((ingredient) => ({
      ...ingredient,
    })),
    category: draft.category ?? "",
  };
}
