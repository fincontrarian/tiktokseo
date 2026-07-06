import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Nav() {
  const t = await getTranslations("nav");

  return (
    <header className="border-ink/10 border-b">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-violet text-lime flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold">
            F
          </span>
          <span className="text-lg font-semibold tracking-tight">Findable</span>
        </Link>

        <div className="text-ink/70 hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href="/#features" className="hover:text-ink">
            {t("features")}
          </Link>
          <Link href="/audit" className="hover:text-ink">
            {t("freeTools")}
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            {t("pricing")}
          </Link>
        </div>

        {/* Audience toggle — visual stub until the B2B surface ships. */}
        <div
          className="border-ink/15 flex rounded-full border p-0.5 text-xs font-medium"
          title={t("comingSoon")}
        >
          <span
            aria-pressed="true"
            className="bg-ink rounded-full px-3 py-1 text-white"
          >
            {t("creators")}
          </span>
          <span aria-pressed="false" className="text-ink/50 px-3 py-1">
            {t("business")}
          </span>
        </div>
      </nav>
    </header>
  );
}
