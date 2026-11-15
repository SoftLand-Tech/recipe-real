import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

/**
 * White content card from DESIGN.md: hairline border, 18px radius, whispered
 * ink shadow at rest. `interactive` adds the 4px hover lift + deepened
 * shadow (for whole-card links); plain cards stay at rest elevation.
 */
export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the hover lift for clickable cards (use inside a link wrapper). */
  interactive?: boolean;
  /** Renders a semantic wrapper element instead of <div> where useful. */
  as?: "div" | "article" | "section" | "li" | "aside";
}

export function Card({
  children,
  className,
  interactive = false,
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-hair bg-white shadow-[var(--shadow-card)]",
        interactive &&
          "transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
