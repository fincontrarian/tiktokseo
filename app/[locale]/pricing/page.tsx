import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PricingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const tHome = await getTranslations("home");

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-ink/70 mt-4 max-w-xl text-lg">{t("sub")}</p>
      <div className="border-ink/20 mt-10 rounded-2xl border border-dashed p-10 text-center">
        <p className="text-ink/60">{t("comingSoon")}</p>
        <Link
          href="/audit"
          className="bg-violet hover:bg-violet/90 mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white"
        >
          {tHome("cta")}
        </Link>
      </div>
    </div>
  );
}
