/**
 * Settings (/settings, PUBLIC like mobile) — OWNED BY SLICE ACCOUNT.
 *
 * Sections: language (foundation i18n chips), and — signed in only — the
 * account group (profile link, sign out with confirm, delete account with a
 * two-step destructive confirm). Anon visitors get the language section plus
 * a sign-in prompt, exactly like the mobile settings tab.
 *
 * Account deletion contract: DELETE /api/account → wipe ALL local state
 * (favorites via the store's own toggle path so every listener follows, and
 * the token through the auth context's logout path) → redirect home. Any
 * server failure keeps the session so the user can retry (a 401 mid-flow is
 * handled globally by http.ts).
 */
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";

import { deleteAccount } from "@/api/account";
import { AccountConfirmDialog } from "@/components/AccountConfirmDialog";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useLang, useT } from "@/i18n";
import { favoriteIds, toggleFavorite } from "@/state/favorites";
import type { Lang } from "@/i18n";

const LANG_OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

/** One grouped-list row (mobile settings pattern): label, caption, control. */
function SettingsRow({
  label,
  caption,
  below,
  danger = false,
  children,
}: {
  label: string;
  caption?: string;
  below?: React.ReactNode;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-4">
        <span
          className={
            danger
              ? "flex-1 font-body text-[15px] font-bold text-orange-deep"
              : "flex-1 font-body text-[15px] font-bold text-ink"
          }
        >
          {label}
        </span>
        {children}
      </div>
      {caption ? (
        <p className="mt-1 font-body text-[13px] leading-snug text-muted">{caption}</p>
      ) : null}
      {below ? <div className="mt-3 flex flex-wrap gap-2">{below}</div> : null}
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const { lang, setLang } = useLang();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ackDelete, setAckDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  }, [logout]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteAccount();
      // Success: wipe EVERYTHING local before leaving the page. Favorites
      // go through the store's own toggle (public API only) so subscribers
      // and other tabs stay in sync; the token goes through the logout
      // path, which also revokes best-effort server-side.
      for (const id of favoriteIds()) {
        toggleFavorite(id);
      }
      // The logout POST may 401 (the account row is already gone) — the
      // token is cleared either way, so never treat that as a failed delete.
      try {
        await logout();
      } catch {
        // Token cleared in logout's finally; context flips anon via the
        // global auth-expired event.
      }
      setConfirmDelete(false);
      toast.show(t("settings.deleteDone"));
      navigate("/", { replace: true });
    } catch {
      // The account survived server-side: keep the session so the user can
      // retry (a 401 here was already handled globally).
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  }, [deleting, logout, navigate, t, toast]);

  const authed = status === "authed";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
        {t("settings.pageTitle")}
      </h1>

      {/* Language */}
      <section className="mt-5" aria-label={t("settings.language")}>
        <Card>
          <SettingsRow
            label={t("settings.language")}
            caption={t("settings.languageCaption")}
            below={LANG_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                lang={option.value}
                aria-pressed={lang === option.value}
                onClick={() => setLang(option.value)}
                className={
                  lang === option.value
                    ? "rounded-pill bg-orange px-4 py-1.5 font-body text-[13px] font-bold text-white transition-colors hover:bg-orange-deep"
                    : "rounded-pill bg-cream-deep px-4 py-1.5 font-body text-[13px] font-bold text-muted transition-colors hover:text-ink"
                }
              >
                {option.label}
              </button>
            ))}
          />
        </Card>
      </section>

      {/* Account */}
      <section className="mt-6" aria-label={t("settings.account")}>
        {!authed ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="font-body text-[15px] leading-relaxed text-muted">
              {t("settings.signInPrompt")}
            </p>
            <Button type="button" onClick={() => navigate("/login")}>
              {t("common.signIn")}
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-hair">
              <Link
                to="/account"
                className="flex items-center gap-3 px-5 py-4 font-body text-[15px] font-bold text-ink transition-colors hover:bg-cream-deep hover:text-orange-deep"
              >
                <span className="flex-1">{t("profile.title")}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-[18px] w-[18px] text-faint rtl:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </Link>
              <SettingsRow label={t("common.signOut")}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmSignOut(true)}
                >
                  {t("common.signOut")}
                </Button>
              </SettingsRow>
              <SettingsRow
                danger
                label={t("settings.deleteAccount")}
                caption={t("settings.deleteAccountHint")}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setAckDelete(false);
                    setDeleteFailed(false);
                    setConfirmDelete(true);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </SettingsRow>
            </div>
            {deleteFailed ? (
              <p
                role="alert"
                className="border-t border-hair px-5 py-3 font-body text-[13.5px] font-semibold text-orange-deep"
              >
                {t("settings.deleteFailed")}
              </p>
            ) : null}
          </Card>
        )}
      </section>

      {authed && user ? (
        <p className="mt-4 text-center font-body text-[12.5px] text-faint">
          {user.email}
        </p>
      ) : null}

      {/* Sign-out confirmation */}
      <AccountConfirmDialog
        open={confirmSignOut}
        title={t("settings.signOutConfirmTitle")}
        message={t("settings.signOutConfirmMessage")}
        confirmLabel={t("common.signOut")}
        busy={signingOut}
        onConfirm={() => void handleSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      />

      {/* Delete-account two-step confirmation */}
      <AccountConfirmDialog
        open={confirmDelete}
        destructive
        busy={deleting}
        title={t("settings.deleteConfirmTitle")}
        message={t("settings.deleteConfirmBody")}
        confirmLabel={t("settings.deleteConfirmBtn")}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setConfirmDelete(false)}
        confirmDisabled={!ackDelete}
      >
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-hair bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={ackDelete}
            disabled={deleting}
            onChange={(event) => setAckDelete(event.target.checked)}
            className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-orange"
          />
          <span className="font-body text-[13.5px] font-semibold leading-snug text-ink">
            {t("settings.deleteAcknowledge")}
          </span>
        </label>
      </AccountConfirmDialog>
    </div>
  );
}
