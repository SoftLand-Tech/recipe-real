/**
 * Post photo grid (slice COMMUNITY) — mobile's PostImageGrid pattern: a
 * compact multi-cell layout for a post's images. The feed/detail cards show
 * up to 4 cells like mobile; a 5th+ photo collapses into a "+N" overlay on
 * the last cell, and every cell opens the lightbox at its index (which pages
 * the FULL set). Images lazy-load and carry alt text from post context.
 */
import { useT } from "@/i18n";
import { cn } from "@/utils/cn";

export interface CommunityImageGridProps {
  images: string[];
  /** Alt-text stem, e.g. the author's display name ("Photo by Fatima"). */
  altStem: string;
  onOpen: (index: number) => void;
  className?: string;
}

/** Cells rendered in the grid before the "+N" overlay collapses the rest. */
const MAX_CELLS = 4;

export function CommunityImageGrid({
  images,
  altStem,
  onOpen,
  className,
}: CommunityImageGridProps) {
  const t = useT();
  if (images.length === 0) return null;

  const overflow = Math.max(0, images.length - MAX_CELLS);
  const cellCount = Math.min(images.length, MAX_CELLS);

  return (
    <div
      className={cn(
        "grid gap-1 overflow-hidden rounded-md bg-cream-deep",
        images.length === 1 ? "grid-cols-1" : "grid-cols-2",
        className,
      )}
    >
      {images.slice(0, cellCount).map((src, i) => {
        const isOverflowCell = overflow > 0 && i === cellCount - 1;
        // One photo: wide landscape; two: squares; three: hero + pair;
        // four+: even 2×2 (mobile's layouts).
        const shape =
          images.length === 1
            ? "aspect-[4/3] max-h-[420px] w-full"
            : images.length === 3 && i === 0
              ? "aspect-[2/1] col-span-2"
              : "aspect-square";
        return (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={t("community.openPhoto", { n: i + 1 })}
            className={cn(
              "group relative overflow-hidden bg-cream-deep transition-opacity hover:opacity-90",
              shape,
            )}
          >
            <img
              src={src}
              alt={t("community.photoAlt", { name: altStem })}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {isOverflowCell ? (
              <span className="absolute inset-0 flex items-center justify-center bg-dark-2/55 font-body text-lg font-extrabold text-white" dir="ltr">
                +{overflow}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
