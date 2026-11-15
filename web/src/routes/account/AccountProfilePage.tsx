/**
 * Edit profile (/account/profile, authed) — OWNED BY SLICE ACCOUNT.
 *
 * Web twin of mobile's edit modal: display name (2–40), bio (≤500), avatar
 * via the DEDICATED POST /api/users/me/avatar endpoint (the file goes
 * straight up — no generic upload hop; square-center crop is CSS-only on the
 * preview). Client-side validation maps to the same friendly bilingual
 * messages as mobile; server 422s (bio halal gate) map to their own message
 * instead of raw API text.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  fetchMyProfile,
  updateProfile,
  uploadAvatar,
} from "@/api/account";
import { isRateLimitedError } from "@/api/http";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useT } from "@/i18n";

import type { MyProfile } from "@/api/types";

type LoadState = "loading" | "ready" | "error";

const SAVED_CAPTION_MS = 2400;

/** HTTP status of an axios-shaped error without importing axios here. */
function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: unknown } }).response;
    if (response && typeof response.status === "number") return response.status;
  }
  return undefined;
}

export default function AccountProfilePage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<MyProfile | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  // Initial load inline in the effect (await-first IIFE: no synchronous
  // setState); retries re-trigger it by bumping the tick.
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchMyProfile();
        if (cancelled) return;
        setProfile(me);
        setName(me.user.display_name ?? "");
        setBio(me.user.bio ?? "");
        setState("ready");
      } catch {
        if (cancelled) return;
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  /** Retry from the error state (skeleton again) — from an event, not an effect. */
  const retry = useCallback(() => {
    setState((prev) => (prev === "error" ? "loading" : prev));
    setReloadTick((tick) => tick + 1);
  }, []);

  // Clear the saved caption after a moment (mobile's SAVED_CAPTION_MS pattern).
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(0), SAVED_CAPTION_MS);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  // Object URLs need explicit revocation; one at a time here.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickAvatar = useCallback(
    (file: File | null): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPickedFile(file);
      setPreviewUrl(file ? URL.createObjectURL(file) : null);
      if (file) setRemoveAvatar(false);
    },
    [previewUrl],
  );

  const currentAvatar =
    removeAvatar || pickedFile != null ? previewUrl : (profile?.user.avatar_url ?? null);

  const handleSave = useCallback(async () => {
    if (saving || profile == null) return;
    const nameVal = name.trim();
    if (nameVal.length < DISPLAY_NAME_MIN || nameVal.length > DISPLAY_NAME_MAX) {
      setError(t("profile.errNameLength"));
      return;
    }
    if (bio.length > BIO_MAX) {
      setError(t("profile.errBioLong"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 1) Avatar first, on its dedicated endpoint (server stamps the URL).
      if (pickedFile) {
        try {
          await uploadAvatar(pickedFile);
        } catch (uploadError) {
          if (isRateLimitedError(uploadError)) throw new Error("rate");
          throw new Error("avatar");
        }
      }
      // 2) Then only the profile fields that actually moved.
      const patch: { display_name?: string; bio?: string | null; avatar_url?: null } = {};
      if (nameVal !== (profile.user.display_name ?? "")) patch.display_name = nameVal;
      const bioVal = bio.trim();
      if (bioVal !== (profile.user.bio ?? "").trim()) {
        patch.bio = bioVal === "" ? null : bioVal;
      }
      if (!pickedFile && removeAvatar) patch.avatar_url = null;
      let next: MyProfile = profile;
      if (Object.keys(patch).length > 0) {
        try {
          next = await updateProfile(patch);
        } catch (patchError) {
          if (isRateLimitedError(patchError)) throw new Error("rate");
          if (statusOf(patchError) === 422) throw new Error("bioRejected");
          throw patchError;
        }
      }
      // Re-read the source of truth so the avatar state is exact.
      try {
        next = await fetchMyProfile();
      } catch {
        // The PATCH payload is already fine; keep it.
      }
      setProfile(next);
      setName(next.user.display_name ?? "");
      setBio(next.user.bio ?? "");
      pickAvatar(null);
      setRemoveAvatar(false);
      setSavedAt(Date.now());
    } catch (err) {
      if (err instanceof Error && err.message === "rate") {
        toast.error(t("common.rateLimited"));
      } else if (err instanceof Error && err.message === "avatar") {
        setError(t("profile.errUploadAvatar"));
      } else if (err instanceof Error && err.message === "bioRejected") {
        setError(t("profile.errBioRejected"));
      } else {
        setError(t("profile.errSave"));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, profile, name, bio, pickedFile, removeAvatar, pickAvatar, t, toast]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-xl" aria-busy="true">
        <Skeleton className="h-9 w-44" />
        <Card className="mt-4 space-y-5 p-6">
          <div className="flex items-center gap-5">
            <Skeleton circle className="h-24 w-24" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <h1 className="font-display text-[1.5rem] font-semibold text-ink">
            {t("common.error")}
          </h1>
          <p className="font-body text-[15px] text-muted">{t("account.loadFailed")}</p>
          <Button type="button" onClick={retry}>
            {t("common.retry")}
          </Button>
        </Card>
      </div>
    );
  }

  const hasAvatar = Boolean(currentAvatar ?? profile?.user.avatar_url);
  const dirty =
    name.trim() !== (profile?.user.display_name ?? "") ||
    bio.trim() !== (profile?.user.bio ?? "").trim() ||
    pickedFile != null ||
    removeAvatar;

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
          {t("profile.pageTitle")}
        </h1>
        <Link
          to="/account"
          className="rounded-pill px-3 py-1.5 font-body text-[14px] font-bold text-muted transition-colors hover:text-orange-deep"
        >
          {t("profile.backToAccount")}
        </Link>
      </div>

      <Card className="mt-4 p-6">
        {/* Avatar picker */}
        <div className="flex flex-wrap items-center gap-5">
          <span className="relative inline-flex">
            <AccountAvatar
              name={name || user?.name}
              url={currentAvatar}
              size="lg"
            />
            <span className="absolute bottom-0 end-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange text-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>
            </span>
          </span>
          <div className="flex flex-col items-start gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                pickAvatar(event.target.files?.[0] ?? null);
                // Allow re-picking the same file after cancel.
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-[13.5px] whitespace-nowrap sm:px-7 sm:py-3.5 sm:text-[15.5px]"
              >
                {t("profile.changePhoto")}
              </Button>
              {hasAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving || removeAvatar}
                  onClick={() => {
                    pickAvatar(null);
                    setRemoveAvatar(true);
                  }}
                  className="px-4 py-2 text-[13.5px] whitespace-nowrap sm:px-7 sm:py-3.5 sm:text-[15.5px]"
                >
                  {t("profile.removePhoto")}
                </Button>
              ) : null}
            </div>
            <p className="font-body text-[12.5px] text-faint">
              {t("profile.photoHint")}
            </p>
          </div>
        </div>

        <hr className="my-6 border-hair" />

        {/* Display name */}
        <label className="block">
          <span className="font-body text-[13px] font-bold tracking-wide text-muted">
            {t("profile.displayName")}
          </span>
          <input
            type="text"
            value={name}
            maxLength={DISPLAY_NAME_MAX}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("profile.displayNamePlaceholder")}
            className="mt-2 w-full rounded-md border border-hair bg-cream-deep px-4 py-3 font-body text-[15.5px] font-semibold text-ink placeholder:text-faint focus:border-orange disabled:opacity-60"
          />
          <span className="mt-1.5 block font-body text-[12px] text-faint">
            {t("profile.nameHint")}
          </span>
        </label>

        {/* Bio */}
        <label className="mt-5 block">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-body text-[13px] font-bold tracking-wide text-muted">
              {t("profile.bio")}
            </span>
            <span className="font-body text-[12px] text-faint tabular-nums">
              {t("profile.bioCount", { n: bio.length })}
            </span>
          </span>
          <textarea
            value={bio}
            maxLength={BIO_MAX}
            rows={4}
            disabled={saving}
            onChange={(event) => setBio(event.target.value)}
            placeholder={t("profile.bioPlaceholder")}
            className="mt-2 w-full resize-y rounded-md border border-hair bg-cream-deep px-4 py-3 font-body text-[15px] leading-relaxed text-ink placeholder:text-faint focus:border-orange disabled:opacity-60"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-4 font-body text-[14px] font-semibold text-orange-deep">
            {error}
          </p>
        ) : null}
        {savedAt ? (
          <p className="mt-4 font-body text-[14px] font-semibold text-muted">
            {t("profile.saved")}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={saving || !dirty}
            onClick={() => {
              setName(profile?.user.display_name ?? "");
              setBio(profile?.user.bio ?? "");
              pickAvatar(null);
              setRemoveAvatar(false);
              setError(null);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={saving || !dirty}
            onClick={() => void handleSave()}
          >
            {t("common.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
