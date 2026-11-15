/**
 * ⋯ action dropdown (slice COMMUNITY) — the web take on mobile's post
 * action sheet. Opens a small anchored menu (click-outside and Esc close),
 * used by the post card and the detail screen for the moderation
 * affordances: edit/delete your own content, report + block others.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/utils/cn";

export interface CommunityMenuItem {
  key: string;
  label: string;
  /** Inline SVG node (16–18px, currentColor). */
  icon: ReactNode;
  /** Emphasized styling for irreversible actions (delete/block). */
  destructive?: boolean;
  onSelect: () => void;
}

export interface CommunityActionMenuProps {
  /** Accessibility label for the ⋯ trigger. */
  label: string;
  items: CommunityMenuItem[];
  /** Optional replacement node for the ⋯ trigger content (e.g. a "Reported" tick). */
  triggerTone?: "default" | "reported";
  disabled?: boolean;
  align?: "start" | "end";
}

/** Minimal inline icons (DESIGN.md: hand-drawn inline SVG, never a font). */
export function MenuIcon({ name }: { name: "flag" | "ban" | "trash" | "edit" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      {name === "flag" && (
        <>
          <path d="M5 21V4" {...common} />
          <path d="M5 4h11l-1.5 4L16 12H5" {...common} />
        </>
      )}
      {name === "ban" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M6 6l12 12" {...common} />
        </>
      )}
      {name === "trash" && (
        <>
          <path d="M4 7h16" {...common} />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" {...common} />
          <path d="M6.5 7l1 13h9l1-13" {...common} />
        </>
      )}
      {name === "edit" && (
        <>
          <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" {...common} />
          <path d="M13.5 6.5l3 3" {...common} />
        </>
      )}
    </svg>
  );
}

export function CommunityActionMenu({
  label,
  items,
  triggerTone = "default",
  disabled = false,
  align = "end",
}: CommunityActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors",
          "hover:bg-cream-deep hover:text-ink disabled:opacity-45",
          triggerTone === "reported" && "text-orange-deep",
        )}
      >
        {triggerTone === "reported" ? (
          <MenuIcon name="flag" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-48 overflow-hidden rounded-md border border-hair bg-white py-1 shadow-[var(--shadow-card-hover)]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-start font-body text-[14px] font-semibold transition-colors",
                item.destructive
                  ? "text-orange-deep hover:bg-orange-soft"
                  : "text-ink hover:bg-cream-deep",
              )}
            >
              <span className={item.destructive ? "text-orange-deep" : "text-muted"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
