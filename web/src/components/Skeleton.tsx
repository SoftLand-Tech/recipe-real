import { cn } from "@/utils/cn";

/**
 * Loading-skeleton block: cream-deep ground with a soft pulse. Compose rows
 * and cards from these while data loads (lists must show skeletons, per the
 * interaction contract).
 */
export function Skeleton({
  className,
  /** Circle (avatar) instead of rounded rectangle. */
  circle = false,
}: {
  className?: string;
  circle?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-cream-deep",
        circle ? "rounded-full" : "rounded-md",
        className,
      )}
    />
  );
}
