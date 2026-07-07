import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listQualityHashtags, listQualityNiches } from "@/lib/data";

// Rebuilt daily so the explore strip tracks the index.
export const revalidate = 86400;

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  // Entry points into the programmatic SEO mesh (never leave hubs orphaned).
  const [niches, hashtags] = await Promise.all([
    listQualityNiches(6).catch(() => [] as string[]),
    listQualityHashtags(8).catch(() => [] as string[]),
  ]);

  const features = [
    { title: t("feature1Title"), body: t("feature1Body") },
    { title: t("feature2Title"), body: t("feature2Body") },
    { title: t("feature3Title"), body: t("feature3Body") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-20 sm:py-28">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          {t("headline")}{" "}
          <span className="bg-lime px-2 leading-snug">{t("headline2")}</span>
        </h1>
        <p className="text-ink/70 mt-6 max-w-xl text-lg">{t("sub")}</p>
        <Link
          href="/audit"
          className="bg-violet hover:bg-violet/90 mt-8 inline-block rounded-full px-8 py-3.5 text-base font-semibold text-white transition"
        >
          {t("cta")}
        </Link>
      </section>

      <section id="features" className="border-ink/10 border-t py-16">
        <h2 className="text-2xl font-bold tracking-tight">
          {t("featuresTitle")}
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="border-ink/10 rounded-2xl border p-6"
            >
              <h3 className="text-violet font-semibold">{feature.title}</h3>
              <p className="text-ink/70 mt-2 text-sm leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(niches.length > 0 || hashtags.length > 0) && (
        <section className="border-ink/10 border-t py-16">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("exploreTitle")}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {niches.map((niche) => (
              <Link
                key={niche}
                href={`/niches/${niche}`}
                className="bg-ink rounded-full px-4 py-2 text-sm font-semibold text-white capitalize hover:opacity-90"
              >
                {niche}
              </Link>
            ))}
            {hashtags.map((tag) => (
              <Link
                key={tag}
                href={`/hashtags/${encodeURIComponent(tag)}`}
                className="border-violet/30 text-violet hover:bg-violet/5 rounded-full border px-4 py-2 text-sm font-medium"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
