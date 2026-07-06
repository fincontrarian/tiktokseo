import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HandleForm } from "@/components/handle-form";
import { startAudit } from "./actions";

interface AuditPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AuditPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "audit" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AuditPage({ params }: AuditPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("audit");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="flex flex-col items-center py-20 text-center sm:py-28">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          {t("headline")}
          <br />
          <span className="bg-lime px-2 leading-snug">{t("headline2")}</span>
        </h1>
        <p className="text-ink/70 mt-6 max-w-xl text-lg">{t("sub")}</p>
        <div className="mt-10 flex w-full justify-center">
          <HandleForm
            action={startAudit}
            inputLabel={t("inputLabel")}
            placeholder={t("inputPlaceholder")}
            cta={t("cta")}
            invalidMessage={t("invalidHandle")}
          />
        </div>
        <p className="text-ink/50 mt-4 text-sm">{t("disclaimerShort")}</p>
      </section>
    </div>
  );
}
