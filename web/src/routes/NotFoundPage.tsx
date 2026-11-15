/**
 * 404 catch-all (FOUNDATION OWNED): unknown in-app paths land here with the
 * shared empty-state styling and a way back home.
 */
import { Link } from "react-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useT } from "@/i18n";

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <EmptyState
        title={t("common.notFoundTitle")}
        body={t("common.notFoundBody")}
        action={
          <Link to="/">
            <Button variant="primary">{t("common.goHome")}</Button>
          </Link>
        }
      />
    </div>
  );
}
