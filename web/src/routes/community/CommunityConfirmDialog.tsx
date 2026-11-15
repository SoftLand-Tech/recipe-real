/**
 * Centered confirm dialog (slice COMMUNITY) — the web take on mobile's
 * destructive action sheets. Esc and the backdrop close without confirming;
 * focus starts on the cancel action so a stray Enter never deletes anything.
 * Used for: delete own post/comment, report post/comment, block user,
 * discard composer draft, and the post-block success notice.
 */
import { useEffect } from "react";

import { Button } from "@/components/Button";
import { useT } from "@/i18n";

export interface CommunityConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Style the confirm as the destructive primary action (delete/block). */
  destructive?: boolean;
  busy?: boolean;
  /** Hide the cancel action (e.g. the post-block success notice: OK only). */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommunityConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: CommunityConfirmDialogProps) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-2/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-card border border-hair bg-white p-6 shadow-[var(--shadow-card-hover)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold leading-tight text-ink">
          {title}
        </h2>
        {message ? (
          <p className="mt-2 font-body text-[14.5px] leading-relaxed text-muted">
            {message}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {hideCancel ? null : (
            <Button
              variant="ghost"
              disabled={busy}
              autoFocus={!hideCancel}
              onClick={onCancel}
              className="px-5 py-2.5 text-[14px]"
            >
              {t("common.cancel")}
            </Button>
          )}
          <Button
            variant={destructive ? "dark" : "primary"}
            loading={busy}
            onClick={onConfirm}
            className="px-5 py-2.5 text-[14px]"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
