/** Tiny classnames helper (no clsx dep needed at this size). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
