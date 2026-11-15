/**
 * Placeholder stub page (FOUNDATION scaffolding).
 *
 * Every non-foundation route in the table ships wired to one of these until
 * its owning slice replaces the stub file's contents. The card shows the
 * page's real i18n title plus the not-implemented note, centered — proof
 * that routing, i18n and RTL all work end-to-end before any slice lands.
 */
import { Card } from "@/components/Card";
import { useT } from "@/i18n";

export function Placeholder({ titleKey }: { titleKey: string }) {
  const t = useT();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md px-8 py-12 text-center">
        <h1 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight text-ink">
          {t(titleKey)}
        </h1>
        <p className="mt-3 font-body text-[15px] text-muted">
          {t("common.sliceStub")}
        </p>
      </Card>
    </div>
  );
}
