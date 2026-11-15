import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Spinner } from "@/components/Spinner";
import { cn } from "@/utils/cn";

/**
 * The pill button from DESIGN.md — every interactive thing is a 999px pill.
 * Variants: primary (orange action + glow), ghost (white card button), dark
 * (slate). The global :focus-visible rule in index.css draws the orange ring,
 * so only hover/active states live here. Buttons disable (and show a
 * spinner) while submitting, per the interaction contract.
 */
export type ButtonVariant = "primary" | "ghost" | "dark";

const VARIANTS: Record<ButtonVariant, string> = {
  // The Orange Is Action Rule: primary carries the glow shadow; hover
  // deepens to ember; press nudges down 1px like the landing.
  primary:
    "bg-orange text-white shadow-[var(--shadow-btn)] hover:bg-orange-deep active:translate-y-px",
  ghost:
    "bg-white text-ink border border-[#E8DFD2] hover:border-orange hover:text-orange-deep active:translate-y-px",
  dark: "bg-dark text-white hover:bg-[#2E3545] active:translate-y-px",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner and disables the button while true (submitting state). */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill px-7 py-3.5",
        "font-body text-[15.5px] font-bold tracking-tight",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
