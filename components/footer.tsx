import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "./locale-switcher";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="bg-violet text-lime flex h-7 w-7 items-center justify-center rounded-md text-base font-bold">
              F
            </span>
            <span className="font-semibold">Findable</span>
          </div>
          <LocaleSwitcher label={t("language")} />
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-white/60">
          {t("disclaimer")}
        </p>
        <p className="text-xs text-white/40">
          {t("rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
