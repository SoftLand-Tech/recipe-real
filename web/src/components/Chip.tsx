import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

/**
 * Pill chip for filters, categories and tags. Two states: rest (deep-cream
 * ground, muted text) and active (soft-apricot ground, ember text — the
 * landing's active-tab treatment). Rendered as a <button> when clickable,
 * a <span> when purely informational.
 */
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export function Chip({ label, active = false, className, ...rest }: ChipProps) {
  const styles = cn(
    "inline-flex items-center rounded-pill px-3.5 py-1.5",
    "font-body text-[13px] font-bold tracking-wide",
    active
      ? "bg-orange-soft text-orange-deep"
      : "bg-cream-deep text-muted hover:text-ink",
    className,
  );
  if (!rest.onClick) {
    return <span className={styles}>{label}</span>;
  }
  return (
    <button type="button" aria-pressed={active} className={styles} {...rest}>
      {label}
    </button>
  );
}
