/**
 * Google sign-in (FOUNDATION OWNED) — the web app's only auth screen.
 *
 * Flow (contract): GIS button → id_token (Google signs the per-attempt
 * nonce INTO it) → login() → POST /api/auth/google { id_token, nonce } →
 * token persisted → redirect to the `returnTo` search param (set by
 * <RequireAuth> when it bounced an anon visitor) or home.
 *
 * The nonce mirrors mobile's login screen exactly: a fresh
 * crypto.randomUUID() with dashes stripped (32 hex chars) per mount, so an
 * injected or replayed id_token fails the backend's exact-match check even
 * with a valid signature.
 *
 * Renders warm kitchen-table per DESIGN.md (cream ground, Fraunces headline
 * with one orange emphasis word, white pill-bordered card) and is fully
 * RTL-safe — logical properties only, GIS renders its own RTL-aware button.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "@/auth/AuthContext";
import { googleClientId, renderGoogleButton } from "@/auth/google";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { isOfflineError } from "@/api/http";
import { useT } from "@/i18n";

/** Only same-app paths may be used as a post-login redirect target. */
function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const { status, login } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  // Single-use anti-injection material, generated fresh per mount (mirror of
  // mobile's login.tsx). Google embeds the nonce INSIDE the signed id_token;
  // the backend requires an exact match and burns it after first use.
  const nonce = useMemo(
    () => crypto.randomUUID().replace(/-/g, ""),
    [],
  );

  const buttonRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client ID availability is render-stable (window config / build env),
  // so derive it instead of storing it via a setState-in-effect — the
  // GIS effect below then only manages the external script + button.
  const clientId = googleClientId();

  // Already signed in? Go straight to the destination (e.g. user navigated
  // to /login manually while authed).
  const authed = status === "authed";

  useEffect(() => {
    if (authed || busy || !buttonRef.current) return;
    const container = buttonRef.current;
    // No client ID configured (dev without VITE_GOOGLE_CLIENT_ID, or the
    // serve-time placeholder survived): render nothing — the derived
    // clientId===null branch below shows the config error instead.
    if (!clientId) return;
    let cancelled = false;
    // The container div remounts after each busy↔idle flip (conditional
    // render); start clean so a re-render never stacks a second button.
    container.innerHTML = "";
    renderGoogleButton(container, {
      nonce,
      callback: (idToken) => {
        if (cancelled) return;
        setBusy(true);
        setError(null);
        login(idToken, nonce)
          .then(() => {
            navigate(returnTo, { replace: true });
          })
          .catch((err: unknown) => {
            setBusy(false);
            setError(
              isOfflineError(err)
                ? t("auth.errOffline")
                : t("auth.errNotComplete"),
            );
          });
      },
    }).catch(() => {
      if (!cancelled) setError(t("auth.errNotReady"));
    });
    return () => {
      cancelled = true;
    };
  }, [authed, busy, clientId, login, navigate, nonce, returnTo, t]);

  if (authed) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-4 py-12 md:px-6">
        <Card className="mx-auto w-full max-w-lg px-7 py-10 text-center md:px-10 md:py-12">
          {/* Four-point spark ornament (landing vocabulary). */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mx-auto h-10 w-10 text-orange"
            fill="currentColor"
          >
            <path d="M12 1c.9 5.8 5.2 10.1 11 11-5.8.9-10.1 5.2-11 11-.9-5.8-5.2-10.1-11-11C6.8 11.1 11.1 6.8 12 1Z" />
          </svg>

          <h1 className="mt-4 font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold leading-[1.1] tracking-tight text-ink">
            {t("auth.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm font-body text-[16px] leading-relaxed text-muted">
            {t("auth.subtitle")}
          </p>

          {/* GIS renders the official button here; the wrapper keeps layout
              stable while the script loads and while the exchange runs. */}
          <div className="mt-8 flex min-h-12 items-center justify-center">
            {busy ? (
              <span className="inline-flex items-center gap-2 font-body text-[15px] font-semibold text-muted">
                <Spinner size="sm" />
                {t("auth.signingIn")}
              </span>
            ) : clientId ? (
              <div
                ref={buttonRef}
                aria-label={t("auth.googleButton")}
                data-testid="google-button"
              />
            ) : (
              // Dev without VITE_GOOGLE_CLIENT_ID, or the serve-time
              // placeholder survived — the button cannot exist; say why.
              <p role="alert" className="font-body text-[14px] font-semibold text-orange-deep">
                {t("auth.errNotConfigured")}
              </p>
            )}
          </div>

          <p className="mt-4 font-body text-[13px] text-faint">
            {t("auth.googleCaption")}
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 font-body text-[14px] font-semibold text-orange-deep"
            >
              {error}
            </p>
          ) : null}

          {returnTo !== "/" ? (
            <p className="mt-4 font-body text-[13.5px] text-muted">
              {t("auth.returnPrompt")}
            </p>
          ) : null}

          <p className="mt-8 font-body text-[13.5px] text-muted">
            <Link to="/" className="font-bold text-orange-deep hover:underline">
              {t("common.back")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
