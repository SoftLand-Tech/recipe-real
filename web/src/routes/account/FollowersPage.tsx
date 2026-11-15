/**
 * Followers list (/u/:id/followers) — OWNED BY SLICE ACCOUNT.
 * Public page (works signed-out); shared implementation in AccountFollowList.
 * key={id} remounts the list when the profile id in the URL changes, so
 * pages never carry rows across users.
 */
import { useParams } from "react-router";

import { AccountFollowList } from "@/routes/account/AccountFollowList";

export default function FollowersPage() {
  const { id } = useParams<{ id: string }>();
  return <AccountFollowList key={id ?? "none"} mode="followers" />;
}
