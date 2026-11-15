import { cn } from "@/utils/cn";

/** Sizes map to the border-width/size pairs used by the pill loader. */
const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-[3px]",
} as const;

export type SpinnerSize = keyof typeof SIZES;

/**
 * Indeterminate loading indicator. Orange on transparent so it reads on both
 * cream and white surfaces; the accessible label defaults to the shared
 * common.loading string supplied by the caller (kept dependency-free here).
 */
export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: SpinnerSize;
  className?: string;
  /** Accessible name; omit for purely decorative inline spinners. */
  label?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        SIZES[size],
        className,
      )}
    />
  );
}
