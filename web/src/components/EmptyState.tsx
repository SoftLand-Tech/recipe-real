import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

/**
 * Empty-state card: the four-point spark ornament from the landing (orange
 * SVG, never emoji), a title, an optional body, and an optional action slot
 * (usually a <Button/>). Lists render this when they load to zero rows.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  /** Action slot — typically a Button or link styled as one. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-card border border-hair bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {/* Four-point spark (the landing's only ornament), drawn inline. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-9 w-9 text-orange"
        fill="currentColor"
      >
        <path d="M12 1c.9 5.8 5.2 10.1 11 11-5.8.9-10.1 5.2-11 11-.9-5.8-5.2-10.1-11-11C6.8 11.1 11.1 6.8 12 1Z" />
      </svg>
      <h3 className="font-body text-lg font-extrabold tracking-tight text-ink">
        {title}
      </h3>
      {body ? (
        <p className="max-w-sm font-body text-[15px] leading-relaxed text-muted">
          {body}
        </p>
      ) : null}
      {action}
    </div>
  );
}
