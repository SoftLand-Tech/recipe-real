/**
 * Centered confirmation dialog (ACCOUNT slice) — the web stand-in for
 * mobile's ConfirmDialog, used by settings (sign out / delete account) and
 * the public profile menu (report / block). Destructive confirms use the
 * dark slate button (orange stays the app's POSITIVE action color; teal is
 * reserved for measured time). Escape and backdrop clicks cancel; focus
 * starts on the safe action.
 */
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/Button";

import { useT } from "@/i18n";

export function AccountConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  /** Blocks the confirm action (e.g. until a type-to-confirm/checkbox passes). */
  confirmDisabled = false,
  /** Extra content between message and actions (e.g. the acknowledge checkbox). */
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();

  // Escape cancels. Focus starts on the safe action when the dialog mounts
  // (it remounts per open, so autoFocus lands correctly every time).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card border border-hair bg-white p-6 shadow-[var(--shadow-card-hover)] md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-[1.35rem] font-semibold leading-tight text-ink">
          {title}
        </h2>
        {message ? (
          <p className="mt-3 font-body text-[15px] leading-relaxed text-muted">
            {message}
          </p>
        ) : null}
        {children}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            autoFocus
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "dark" : "primary"}
            loading={busy}
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
