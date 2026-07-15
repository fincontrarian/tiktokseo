import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PricingTiers } from "@/components/pricing-tiers";
import type { TierProps } from "@/components/pricing-tiers";
import { PLAN_CONFIG } from "@/lib/plan";

export const revalidate = 86400;

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

/**
 * Tier table straight from PLAN_CONFIG — the single source of truth. The
 * free CTA routes into the audit funnel; paid CTAs post to checkout.
 */
export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");

  const free = PLAN_CONFIG.free;
  const creator = PLAN_CONFIG.creator;
  const pro = PLAN_CONFIG.pro;

  const tiers: TierProps[] = [
    {
      id: "free",
      name: t("freeName"),
      description: t("freeDesc"),
      monthlyCents: null,
      annualCents: null,
      cta: t("freeCta"),
      features: [
        { text: t("fProfiles", { count: free.trackedProfileLimit }) },
        { text: t("fTopRows") },
        { text: t("fDelayed") },
        { text: t("fAuditsFree") },
      ],
    },
    {
      id: "creator",
      name: t("creatorName"),
      description: t("creatorDesc"),
      monthlyCents: creator.pricing!.monthlyCents,
      annualCents: creator.pricing!.annualCents,
      cta: t("paidCta"),
      popular: true,
      features: [
        { text: t("fFresh"), emphasized: true },
        { text: t("fUnlimitedRows") },
        {
          text: t("fTrackedKeywords", {
            count: creator.trackedKeywordLimit,
          }),
        },
        { text: t("fProfiles", { count: creator.trackedProfileLimit }) },
        { text: t("fFullAudits") },
      ],
    },
    {
      id: "pro",
      name: t("proName"),
      description: t("proDesc"),
      monthlyCents: pro.pricing!.monthlyCents,
      annualCents: pro.pricing!.annualCents,
      cta: t("paidCta"),
      features: [
        {
          text: t("fProfiles", { count: pro.trackedProfileLimit }),
          emphasized: true,
        },
        { text: t("fFresh") },
        { text: t("fTrackedKeywords", { count: pro.trackedKeywordLimit }) },
        { text: t("fCsv") },
        { text: t("fCompetitor") },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-ink/70 mt-4 max-w-xl text-lg">{t("sub")}</p>
      <PricingTiers
        tiers={tiers}
        labels={{
          monthly: t("monthly"),
          annual: t("annual"),
          annualSave: t("annualSave"),
          perMonth: t("perMonth"),
          billedAnnually: t("billedAnnually", { price: "{price}" }),
          trialNote: t("trialNote"),
          mostPopular: t("mostPopular"),
          freePrice: t("freePrice"),
        }}
      />
    </div>
  );
}
