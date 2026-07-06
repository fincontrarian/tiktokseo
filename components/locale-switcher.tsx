"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
};

export function LocaleSwitcher({ label }: { label: string }) {
  const pathname = usePathname();
  const active = useLocale();

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-white/50">{label}:</span>
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={
            locale === active
              ? "text-lime font-semibold"
              : "text-white/70 hover:text-white"
          }
        >
          {LOCALE_LABELS[locale] ?? locale}
        </Link>
      ))}
    </div>
  );
}
