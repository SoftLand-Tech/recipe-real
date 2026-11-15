/**
 * Post composer (/community/compose) — slice COMMUNITY (RequireAuth'd by the
 * foundation route).
 *
 * Mobile parity, web idioms: body (≤2000 chars with a live counter near the
 * limit), up to 6 photos with a ~2MB client-side guard + preview grid +
 * remove, recipe attach via a debounced search picker (self-contained helper
 * in api/community.ts — api/recipes.ts is another slice's file), sequential
 * uploads via the foundation api/upload.ts, then POST /api/posts → navigate
 * to the new post's detail page. The draft (body + attached recipe)
 * persists to localStorage and survives failures; halal-gate rejections
 * surface with the server's terms, exactly as returned.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import {
  createPost,
  fetchMyProfileForCommunity,
  fetchRecipeForAttach,
  HalalRejectionError,
  searchRecipesForAttach,
  type CommunityMyProfile,
  type CommunityRecipePick,
} from "@/api/community";
import { uploadImage } from "@/api/upload";
import { isOfflineError, isRateLimitedError } from "@/api/http";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useFmtMinutes, useLang, useT } from "@/i18n";
import { CommunityAvatar } from "@/routes/community/CommunityAvatar";
import { CommunityConfirmDialog } from "@/routes/community/CommunityConfirmDialog";
import { CommunityIsolatedText } from "@/routes/community/CommunityIsolatedText";
import { POST_BODY_MAX } from "@/routes/community/CommunityPostCard";

const CHAR_COUNT_THRESHOLD = 1700;
const CHAR_COUNT_WARN = 1900;
const RECIPE_PICK_RESULTS = 6;
const RECIPE_SEARCH_DEBOUNCE_MS = 300;
const MAX_IMAGES = 6;
/** Client-side size guard per photo (mobile compresses at quality 0.8; the web simply rejects oversized files). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** localStorage draft key: body + attached recipe, kept until published or discarded. */
const DRAFT_KEY = "rr_post_composer_draft_v1";

interface ComposerDraft {
  body: string;
  recipeId: number | null;
  recipeTitle: string;
}

interface PickedImage {
  file: File;
  previewUrl: string;
}

function readDraft(): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    if (typeof parsed.body !== "string") return null;
    return {
      body: parsed.body,
      recipeId:
        parsed.recipeId != null && Number.isFinite(parsed.recipeId) && parsed.recipeId > 0
          ? parsed.recipeId
          : null,
      recipeTitle: typeof parsed.recipeTitle === "string" ? parsed.recipeTitle : "",
    };
  } catch {
    return null;
  }
}

/** Best-known display minutes for a picked recipe (community avg → publisher claim). */
function pickMinutes(recipe: CommunityRecipePick): number | null {
  return recipe.community_avg_minutes ?? recipe.publisher_time_minutes ?? null;
}

export default function ComposePage() {
  const t = useT();
  const { lang } = useLang();
  const fmtMinutes = useFmtMinutes();
  const navigate = useNavigate();
  const { status } = useAuth();
  const toast = useToast();

  // Recipe prefill (?recipeId=&recipeTitle= — e.g. a recipe page's
  // "share your try"): the id is the source of truth; the title is
  // display-only until hydrated.
  const [searchParams] = useSearchParams();
  const prefillRecipeId = useMemo(() => {
    const n = Number(searchParams.get("recipeId"));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
  const prefillRecipeTitle = searchParams.get("recipeTitle") ?? "";

  const [body, setBody] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [me, setMe] = useState<CommunityMyProfile | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<CommunityRecipePick | null>(
    null,
  );

  // ---- Draft restore + prefill (param prefill wins over the stored draft) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Off the synchronous effect path (react-hooks/set-state-in-effect):
      // restoring a draft is a one-tick-deferred paint, not a cascading render.
      await Promise.resolve();
      if (cancelled) return;
      const draft = readDraft();
      if (draft && draft.body.length > 0) setBody(draft.body);
      if (prefillRecipeId != null) {
        setSelectedRecipe({
          id: prefillRecipeId,
          title: prefillRecipeTitle,
          title_ar: null,
          image_url: null,
          community_avg_minutes: null,
          publisher_time_minutes: null,
        });
      } else if (draft?.recipeId != null) {
        setSelectedRecipe({
          id: draft.recipeId,
          title: draft.recipeTitle,
          title_ar: null,
          image_url: null,
          community_avg_minutes: null,
          publisher_time_minutes: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillRecipeId, prefillRecipeTitle]);

  // Hydrate a stubbed prefill/draft recipe so the card shows thumb + minutes.
  // The deps make this fire at most once per recipe id: when the fetched row
  // still has neither an image nor an Arabic title, both `needsHydration`
  // (still true) and `selectedId` (same) are unchanged → no re-run.
  const selectedId = selectedRecipe?.id ?? null;
  const needsHydration =
    selectedRecipe != null &&
    selectedRecipe.image_url === null &&
    selectedRecipe.title_ar === null;
  useEffect(() => {
    if (!needsHydration || selectedId == null) return;
    let cancelled = false;
    fetchRecipeForAttach(selectedId)
      .then((full) => {
        if (!cancelled) {
          setSelectedRecipe((prev) => (prev && prev.id === full.id ? full : prev));
        }
      })
      .catch(() => {
        // Non-fatal: the bare title still displays cleanly.
      });
    return () => {
      cancelled = true;
    };
  }, [needsHydration, selectedId]);

  // Persist the draft on every change; an empty composer clears it.
  useEffect(() => {
    try {
      if (body.trim().length === 0 && selectedRecipe == null) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        const snapshot: ComposerDraft = {
          body,
          recipeId: selectedRecipe?.id ?? null,
          recipeTitle: selectedRecipe
            ? lang === "ar"
              ? (selectedRecipe.title_ar ?? selectedRecipe.title)
              : (selectedRecipe.title ?? selectedRecipe.title_ar)
            : "",
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
      }
    } catch {
      // Best-effort persistence.
    }
  }, [body, selectedRecipe, lang]);

  // ---- Profile (author row) ------------------------------------------------------
  useEffect(() => {
    if (status !== "authed") return;
    let cancelled = false;
    fetchMyProfileForCommunity()
      .then((profile) => {
        if (!cancelled) setMe(profile);
      })
      .catch(() => {
        // Non-fatal: the avatar falls back to initials.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  // ---- Recipe picker (debounced, stale-response safe) ------------------------------
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeResults, setRecipeResults] = useState<CommunityRecipePick[]>([]);
  const [suggested, setSuggested] = useState<CommunityRecipePick[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const searchReqRef = useRef(0);

  useEffect(() => {
    if (!recipePickerOpen) return;
    const q = recipeQuery.trim();
    if (q.length === 0 && suggestionsLoaded) return;

    const requestId = ++searchReqRef.current;
    const timer = window.setTimeout(() => {
      if (searchReqRef.current !== requestId) return;
      setRecipeSearching(true);
      searchRecipesForAttach(q, RECIPE_PICK_RESULTS)
        .then((rows) => {
          if (searchReqRef.current !== requestId) return;
          if (q.length === 0) {
            setSuggested(rows);
            setSuggestionsLoaded(true);
          } else {
            setRecipeResults(rows);
          }
        })
        .catch(() => {
          if (searchReqRef.current !== requestId) return;
          if (q.length === 0) setSuggestionsLoaded(true);
          else setRecipeResults([]);
        })
        .finally(() => {
          if (searchReqRef.current === requestId) setRecipeSearching(false);
        });
    }, q.length === 0 ? 0 : RECIPE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [recipePickerOpen, recipeQuery, suggestionsLoaded]);

  // ---- Photos -------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file after remove
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const accepted: PickedImage[] = [];
    let rejectedCount = 0;
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith("image/")) {
        rejectedCount += 1;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejectedCount += 1;
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (rejectedCount > 0) {
      setImageError(t("composer.errImageTooLarge", { size: "2MB" }));
    } else {
      setImageError(null);
    }
    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const [removed] = prev.filter((_, i) => i === index);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Revoke preview object URLs on unmount (a ref keeps the latest set — an
  // empty-deps effect would otherwise capture the first render's empty list).
  const imagesRef = useRef<PickedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    },
    [],
  );

  // ---- Submit ---------------------------------------------------------------------------
  const [posting, setPosting] = useState(false);
  const [uploadCaption, setUploadCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  const dirty = body.trim().length > 0 || images.length > 0 || selectedRecipe != null;
  const canPost = !posting && body.trim().length > 0;

  const submit = async () => {
    const text = body.trim();
    if (text.length === 0) {
      setError(t("community.errBodyRequired"));
      return;
    }
    if (text.length > POST_BODY_MAX) {
      setError(t("community.errBodyLong"));
      return;
    }
    if (posting) return;
    setPosting(true);
    setError(null);
    setHalalTerms(null);
    setUploadCaption(null);
    let succeeded = false;
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setUploadCaption(
          `${t("community.uploadingImages", { n: images.length })} (${i + 1}/${images.length})`,
        );
        try {
          uploadedUrls.push(await uploadImage(images[i]!.file));
        } catch (uploadError) {
          setError(
            isOfflineError(uploadError)
              ? t("common.offline")
              : t("community.errImageUpload"),
          );
          return;
        }
      }
      setUploadCaption(t("community.publishingPost"));

      const created = await createPost({
        body: text,
        ...(selectedRecipe ? { recipe_id: selectedRecipe.id } : {}),
        ...(uploadedUrls.length > 0 ? { images: uploadedUrls } : {}),
      });
      succeeded = true;

      // Draft is published: clear it, then land on the new post's page.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Best-effort.
      }
      navigate(`/post/${created.id}`, { replace: true });
    } catch (err) {
      if (err instanceof HalalRejectionError) {
        setHalalTerms(err.terms);
      } else if (isOfflineError(err)) {
        setError(t("common.offline"));
      } else if (isRateLimitedError(err)) {
        toast.error(t("common.rateLimited"));
      } else {
        setError(t("community.postFailed"));
      }
    } finally {
      if (!succeeded) {
        setPosting(false);
        setUploadCaption(null);
      }
    }
  };

  // Guard against accidental unload mid-upload (draft persistence covers the rest).
  useEffect(() => {
    if (!posting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [posting]);

  // ---- Discard guard ----------------------------------------------------------------------
  const [discardOpen, setDiscardOpen] = useState(false);

  const requestClose = () => {
    if (posting) return;
    if (dirty) setDiscardOpen(true);
    else navigate(-1);
  };

  const confirmDiscard = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Best-effort.
    }
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setDiscardOpen(false);
    navigate("/community");
  };

  const authorNameDisplay = me ? (me.display_name ?? me.name ?? "").trim() : "";
  const charCountColor =
    body.length >= POST_BODY_MAX
      ? "text-orange-deep"
      : body.length >= CHAR_COUNT_WARN
        ? "text-orange"
        : "text-faint";
  const atMaxImages = images.length >= MAX_IMAGES;
  const pickerRows = recipeQuery.trim().length === 0 ? suggested : recipeResults;
  const selectedMinutes = selectedRecipe ? pickMinutes(selectedRecipe) : null;
  const selectedTitle = selectedRecipe
    ? lang === "ar"
      ? (selectedRecipe.title_ar ?? selectedRecipe.title)
      : (selectedRecipe.title ?? selectedRecipe.title_ar)
    : "";

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header: cancel | title | Post pill */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={requestClose}
          disabled={posting}
          aria-label={t("common.cancel")}
          className="flex h-10 w-10 items-center justify-center rounded-pill bg-white text-muted shadow-[var(--shadow-card)] transition-colors hover:bg-cream-deep hover:text-ink disabled:opacity-45"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-display text-xl font-semibold text-ink">
          {t("composer.pageTitle")}
        </h1>
        <Button
          onClick={() => void submit()}
          loading={posting}
          disabled={!canPost}
          className="min-w-20 px-5 py-2.5 text-[14px]"
        >
          {posting ? t("community.posting") : t("community.postAction")}
        </Button>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Author row */}
        <div className="flex items-center gap-3">
          <CommunityAvatar name={authorNameDisplay || "?"} uri={me?.avatar_url} size={42} />
          <div className="flex min-w-0 flex-col gap-1">
            {authorNameDisplay.length > 0 ? (
              <span className="truncate font-body text-[15px] font-bold text-ink">
                <CommunityIsolatedText text={authorNameDisplay} />
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 self-start rounded-pill bg-cream-deep px-2.5 py-0.5 text-[12px] font-semibold text-muted">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              {t("composer.audiencePublic")}
            </span>
          </div>
        </div>

        {/* Writing canvas */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("community.composePlaceholder")}
          maxLength={POST_BODY_MAX}
          disabled={posting}
          rows={6}
          autoFocus={prefillRecipeId == null}
          dir="auto"
          className="min-h-36 w-full resize-y bg-transparent font-body text-[16.5px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
        />
        {body.length >= CHAR_COUNT_THRESHOLD ? (
          <p className={`self-end font-body text-[12.5px] font-bold tabular-nums ${charCountColor}`} dir="ltr">
            {body.length} / {POST_BODY_MAX}
          </p>
        ) : null}

        {/* Upload / publish progress banner */}
        {uploadCaption != null ? (
          <div className="flex items-center gap-3 rounded-md bg-orange-soft px-4 py-2.5">
            <Skeleton className="h-4 w-4 rounded-full" />
            <p className="flex-1 font-body text-[13.5px] font-bold text-orange-deep">
              {uploadCaption}
            </p>
          </div>
        ) : null}

        {/* Halal / validation / upload errors (server terms verbatim) */}
        {halalTerms != null ? (
          <div className="flex items-start gap-2.5 rounded-md bg-orange-soft px-4 py-2.5">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-orange-deep" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.01" />
            </svg>
            <p className="font-body text-[13.5px] font-semibold leading-relaxed text-orange-deep">
              {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
            </p>
          </div>
        ) : null}
        {imageError != null && halalTerms == null ? (
          <div className="rounded-md bg-orange-soft px-4 py-2.5 font-body text-[13.5px] font-semibold text-orange-deep">
            {imageError}
          </div>
        ) : null}
        {error != null && halalTerms == null && imageError == null ? (
          <div className="rounded-md bg-orange-soft px-4 py-2.5 font-body text-[13.5px] font-semibold text-orange-deep">
            {error}
          </div>
        ) : null}

        {/* Photo previews + add more */}
        {images.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img, i) => (
                <div key={img.previewUrl} className="group relative aspect-square overflow-hidden rounded-md bg-cream-deep">
                  <img
                    src={img.previewUrl}
                    alt={t("composer.previewAlt", { n: i + 1 })}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    disabled={posting}
                    aria-label={t("community.removeImage", { n: i + 1 })}
                    className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-pill bg-dark-2/60 text-white transition-colors hover:bg-dark-2/85"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {images.length < MAX_IMAGES ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={posting}
                className="inline-flex self-start items-center gap-1.5 rounded-pill border border-hair bg-cream-deep px-4 py-1.5 font-body text-[13px] font-bold text-ink transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-orange" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("community.addMoreImages")}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Attached recipe card */}
        {selectedRecipe ? (
          <div className="flex items-center gap-3 rounded-md border border-hair bg-white p-2.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-cream-deep">
              {selectedRecipe.image_url ? (
                <img
                  src={selectedRecipe.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3v8a2.5 2.5 0 0 0 5 0V3M9.5 11v10M16.5 3c1.4 1.2 2 2.6 2 4.5s-.6 3-2 4v9.5" />
                </svg>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="line-clamp-2 font-body text-[14px] font-bold text-ink">
                <CommunityIsolatedText text={selectedTitle} />
              </span>
              {selectedMinutes != null ? (
                <span className="inline-flex items-center gap-1 self-start rounded-pill bg-cream-deep px-2 py-0.5 text-[12px] font-semibold text-muted">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  {fmtMinutes(selectedMinutes)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecipe(null)}
              disabled={posting}
              aria-label={t("composer.removeRecipeA11y")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-cream-deep text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* Recipe picker panel */}
        {recipePickerOpen ? (
          <div className="flex flex-col gap-3 rounded-md border border-hair p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
                {recipeQuery.trim().length === 0
                  ? t("composer.suggestedRecipes")
                  : t("community.attachRecipe")}
              </span>
              <button
                type="button"
                onClick={() => setRecipePickerOpen(false)}
                aria-label={t("common.cancel")}
                className="flex h-7 w-7 items-center justify-center rounded-pill text-muted transition-colors hover:bg-cream-deep hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-pill bg-cream-deep px-4 py-2">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input
                type="search"
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                placeholder={t("composer.searchRecipePlaceholder")}
                disabled={posting}
                dir="auto"
                className="min-w-0 flex-1 bg-transparent py-1 font-body text-[14px] text-ink placeholder:text-faint focus:outline-none"
              />
              {recipeQuery.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setRecipeQuery("")}
                  aria-label={t("common.cancel")}
                  className="flex h-6 w-6 items-center justify-center rounded-pill text-faint transition-colors hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              ) : null}
            </div>

            {recipeSearching || (recipeQuery.trim().length === 0 && !suggestionsLoaded) ? (
              <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-label={t("common.loading")}>
                {[0, 1, 2].map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-sm" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-2/5" />
                      <Skeleton className="h-2.5 w-1/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pickerRows.length === 0 ? (
              <p className="py-3 text-center font-body text-[14px] text-faint">
                {t("composer.noRecipesFound")}
              </p>
            ) : (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {pickerRows.map((recipe) => {
                  const minutes = pickMinutes(recipe);
                  const title =
                    lang === "ar"
                      ? (recipe.title_ar ?? recipe.title)
                      : (recipe.title ?? recipe.title_ar);
                  return (
                    <button
                      key={`pick-${recipe.id}`}
                      type="button"
                      disabled={posting}
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        setRecipePickerOpen(false);
                        setRecipeQuery("");
                      }}
                      className="flex items-center gap-3 rounded-md px-1.5 py-2 text-start transition-colors hover:bg-cream-deep disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-cream-deep">
                        {recipe.image_url ? (
                          <img
                            src={recipe.image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-faint" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3v8a2.5 2.5 0 0 0 5 0V3M9.5 11v10M16.5 3c1.4 1.2 2 2.6 2 4.5s-.6 3-2 4v9.5" />
                          </svg>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-body text-[14px] font-bold text-ink">
                          <CommunityIsolatedText text={title} />
                        </span>
                        {minutes != null ? (
                          <span className="text-[12px] font-medium text-muted">
                            {fmtMinutes(minutes)}
                          </span>
                        ) : null}
                      </span>
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-orange" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* Attachment toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={pickFiles}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={posting || atMaxImages}
            className="inline-flex items-center gap-2 rounded-pill border border-hair px-4 py-2 font-body text-[13.5px] font-bold text-ink transition-colors hover:border-orange hover:text-orange-deep disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="14" rx="3" />
              <path d="M3.5 15.5l4.5-4 3.5 3 4-4.5 5 5.5" />
              <circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
            </svg>
            {t("composer.toolbarPhotos")}
          </button>
          <button
            type="button"
            onClick={() => setRecipePickerOpen((v) => !v)}
            disabled={posting}
            aria-pressed={recipePickerOpen || selectedRecipe != null}
            className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 font-body text-[13.5px] font-bold transition-colors disabled:opacity-50 ${
              recipePickerOpen || selectedRecipe != null
                ? "border-orange bg-orange-soft text-orange-deep"
                : "border-hair text-ink hover:border-orange hover:text-orange-deep"
            }`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8a2.5 2.5 0 0 0 5 0V3M9.5 11v10M16.5 3c1.4 1.2 2 2.6 2 4.5s-.6 3-2 4v9.5" />
            </svg>
            {t("composer.toolbarTagRecipe")}
          </button>
          {atMaxImages ? (
            <span className="font-body text-[12.5px] font-semibold text-faint">
              {t("composer.maxImagesReached", { n: MAX_IMAGES })}
            </span>
          ) : null}
        </div>
      </Card>

      <p className="mt-4 text-center font-body text-[13px] text-faint">
        <Link to="/community" className="rounded-pill underline decoration-hair underline-offset-4 transition-colors hover:text-ink">
          {t("post.backToCommunity")}
        </Link>
      </p>

      {/* Discard confirmation */}
      {discardOpen ? (
        <CommunityConfirmDialog
          title={t("composer.discardPostTitle")}
          message={t("composer.discardPostMessage")}
          confirmLabel={t("composer.discardBtn")}
          destructive
          onConfirm={confirmDiscard}
          onCancel={() => setDiscardOpen(false)}
        />
      ) : null}
    </div>
  );
}
