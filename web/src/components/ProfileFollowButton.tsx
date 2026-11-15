/**
 * Follow / Following pill (ACCOUNT slice) — used on the public profile
 * hero. Dumb by design: the parent owns the follow state (it does the
 * optimistic flip + rollback), the auth gating (anon visitors get the same
 * orange button wired to a login redirect), and the busy flag. Visual
 * language: following-state is the quiet ghost pill (the action available is
 * "unfollow", not the primary CTA), follow-state is the orange action pill.
 */
import { Button } from "@/components/Button";

import { useT } from "@/i18n";

export function ProfileFollowButton({
  following,
  busy = false,
  onToggle,
  className,
}: {
  following: boolean;
  busy?: boolean;
  /** Receives the NEXT state (flip semantics, like the profile page). */
  onToggle: (nextFollowing: boolean) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <Button
      type="button"
      variant={following ? "ghost" : "primary"}
      loading={busy}
      disabled={busy}
      onClick={() => onToggle(!following)}
      aria-label={following ? t("profile.unfollow") : t("profile.follow")}
      className={className}
    >
      {following ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] text-orange"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5 10 17.5 19.5 7" />
        </svg>
      ) : null}
      {following ? t("profile.followingBtn") : t("profile.follow")}
    </Button>
  );
}
