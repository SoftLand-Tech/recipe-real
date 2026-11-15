/**
 * Fullscreen image lightbox (slice COMMUNITY). Opens over the page with the
 * clicked photo; Esc and the close button dismiss, chevrons page through the
 * set, and the counter keeps orientation. Direction-aware: "previous" sits
 * on the start side and ArrowLeft/ArrowRight follow the layout direction.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useLang, useT } from "@/i18n";

export interface CommunityLightboxProps {
  images: string[];
  startIndex: number;
  alt: string;
  onClose: () => void;
}

export function CommunityLightbox({
  images,
  startIndex,
  alt,
  onClose,
}: CommunityLightboxProps) {
  const t = useT();
  const { dir } = useLang();
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (delta: 1 | -1) => {
      setIndex((i) => {
        if (images.length === 0) return 0;
        return (i + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        go(dir === "rtl" ? 1 : -1);
      } else if (e.key === "ArrowRight") {
        go(dir === "rtl" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir, go, onClose]);

  const multi = images.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("community.lightboxLabel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-2/92 p-4"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("community.lightboxClose")}
        className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/25"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {multi ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(dir === "rtl" ? 1 : -1);
            }}
            aria-label={t("community.lightboxPrev")}
            className="absolute start-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(dir === "rtl" ? -1 : 1);
            }}
            aria-label={t("community.lightboxNext")}
            className="absolute end-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      ) : null}

      <figure className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[index]}
          alt={alt}
          className="max-h-[82vh] max-w-full rounded-md object-contain shadow-[var(--shadow-card-hover)]"
        />
        {multi ? (
          <figcaption className="font-body text-[13px] font-semibold text-white/80" dir="ltr">
            {index + 1} / {images.length}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}
