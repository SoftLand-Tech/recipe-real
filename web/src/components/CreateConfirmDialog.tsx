/**
 * CreateConfirmDialog — small bilingual confirm modal (OWNED BY SLICE CREATE;
 * "Create"-prefixed shared component). Used for destructive confirmations
 * (delete recipe, delete import draft, discard unsaved changes).
 *
 * Overlay click and Escape cancel; the confirm button is the dark destructive
 * pill (orange stays reserved for primary actions per DESIGN.md). RTL-safe:
 * centered flex only, no directional offsets.
 */
import { useEffect } from "react";

import { Button } from "@/components/Button";

export interface CreateConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disables both buttons while the confirmed action runs. */
  busy?: boolean;
}

export function CreateConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: CreateConfirmDialogProps) {
  // Escape cancels; focus starts on the safe (cancel) action.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-hair bg-white px-6 py-7 shadow-[var(--shadow-card-hover)]"
      >
        <h2 className="font-display text-[20px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {body ? (
          <p className="mt-2 font-body text-[14.5px] leading-relaxed text-muted">
            {body}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="px-5 py-2.5 text-[14px]"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="dark"
            onClick={onConfirm}
            loading={busy}
            className="px-6 py-2.5 text-[14px]"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
