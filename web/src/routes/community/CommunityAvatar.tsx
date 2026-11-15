/**
 * Avatar with an initials fallback (slice COMMUNITY). Mobile's Avatar draws
 * the image when a URL exists and a warm-initials disc otherwise; the web
 * does the same with the palette's cream-deep ground + ink initials.
 */
import { useState } from "react";

import { initialsOf } from "@/routes/community/CommunityHelpers";
import { cn } from "@/utils/cn";

export interface CommunityAvatarProps {
  name: string;
  uri: string | null | undefined;
  /** Pixel size (rendered 1:1; consumers pick 32/36/40/44). */
  size: number;
  className?: string;
}

export function CommunityAvatar({ name, uri, size, className }: CommunityAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = typeof uri === "string" && uri.length > 0 && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        showImage ? "bg-cream-deep" : "bg-cream-deep text-ink",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={uri}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-body font-bold text-muted"
          style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
