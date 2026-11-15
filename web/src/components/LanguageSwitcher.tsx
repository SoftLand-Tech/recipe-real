import { useLang } from "@/i18n";
import type { Lang } from "@/i18n";

import { cn } from "@/utils/cn";

/**
 * EN / عربي switcher for both nav bars. Renders the two language names in
 * their own script so an Arabic user can always find English and vice
 * versa (never translate the target language's name).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const options: Array<{ value: Lang; label: string }> = [
    { value: "en", label: "EN" },
    { value: "ar", label: "عربي" },
  ];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill bg-cream-deep p-0.5",
        className,
      )}
      role="group"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          lang={opt.value}
          onClick={() => setLang(opt.value)}
          aria-pressed={lang === opt.value}
          className={cn(
            "rounded-pill px-3 py-1 font-body text-[12.5px] font-bold transition-colors",
            lang === opt.value
              ? "bg-white text-ink shadow-[var(--shadow-card)]"
              : "text-muted hover:text-ink",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
