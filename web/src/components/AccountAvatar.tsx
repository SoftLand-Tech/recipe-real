/**
 * Avatar with initials-fallback tile (ACCOUNT slice).
 *
 * The web twin of mobile's <Avatar>: the photo when the profile has one,
 * otherwise a warm initials tile (first grapheme of the display name) on
 * deep cream — never a broken-image glyph. Square-center "crop" is pure CSS
 * (object-cover), per the slice brief. Decorative by default: every screen
 * renders the name as text next to it, so screen readers don't need a
 * duplicate label (pass `label` when the avatar stands alone).
 *
 * Dimensions are inline pixels (not Tailwind size classes) so callers can
 * override with `px` without fighting class-order specificity.
 */
import { cn } from "@/utils/cn";

const PX = {
  sm: 44,
  md: 56,
  lg: 96,
} as const;

export type AccountAvatarSize = keyof typeof PX;

function initialOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().charAt(0);
  return first === "" ? "?" : first.toUpperCase();
}

export function AccountAvatar({
  name,
  url,
  size = "md",
  /** Explicit pixel size (overrides the size preset). */
  px,
  label,
  className,
}: {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: AccountAvatarSize;
  px?: number;
  /** Accessible name when the avatar stands alone (omit when decorative). */
  label?: string;
  className?: string;
}) {
  const dimension = px ?? PX[size];
  const img = typeof url === "string" && url !== "" ? url : null;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: dimension, height: dimension }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-cream-deep font-body font-extrabold text-muted",
        dimension >= 80 ? "text-[28px]" : dimension >= 52 ? "text-[18px]" : "text-[15px]",
        className,
      )}
    >
      {img ? (
        <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
