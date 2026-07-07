import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getNicheReport, listQualityNiches } from "@/lib/data";
import { formatSearchVolume } from "@/lib/scoring";
import { PRERENDER_BATCH, SEO_QUALITY } from "@/lib/seo/config";

export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ locale: string; niche: string }>;
}

export async function generateStaticParams() {
  try {
    const niches = await listQualityNiches(PRERENDER_BATCH);
    return niches.map((niche) => ({ niche }));
  } catch {
    return [];
  }
}

function parseNiche(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const niche = decoded.trim().toLowerCase();
  return /^[a-z0-9-]{2,40}$/.test(niche) ? niche : null;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, niche: rawNiche } = await params;
  const niche = parseNiche(rawNiche);
  if (!niche) return {};
  const report = await getNicheReport(niche);
  if (!report) return {};
  const t = await getTranslations({ locale, namespace: "publicNiche" });
  return {
    title: t("metaTitle", { niche: report.niche }),
    description: t("metaDescription", { niche: report.niche }),
  };
}

export default async function NichePage({ params }: PageProps) {
  const { locale, niche: rawNiche } = await params;
  setRequestLocale(locale);

  const niche = parseNiche(rawNiche);
  if (!niche) notFound();
  const report = await getNicheReport(niche);
  if (!report) notFound(); // too few quality creators to publish

  const t = await getTranslations("publicNiche");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize sm:text-4xl">
            {t("title", { niche: report.niche })}
          </h1>
          <p className="text-ink/60 mt-2 max-w-xl">{t("sub")}</p>
          <p data-testid="niche-medians" className="text-ink/50 mt-2 text-sm">
            {t("medians", {
              er: pct(report.medianEr),
              save: pct(report.medianSave),
            })}
          </p>
        </div>
        <Link
          href="/audit"
          className="bg-violet hover:bg-violet/90 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t("auditCta")}
        </Link>
      </header>

      <div className="border-ink/10 mt-8 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-ink/10 text-ink/50 border-b text-left text-xs uppercase">
              <th className="px-4 py-3 font-semibold">{t("colRank")}</th>
              <th className="px-4 py-3 font-semibold">{t("colCreator")}</th>
              <th className="px-4 py-3 font-semibold">{t("colFollowers")}</th>
              <th className="px-4 py-3 font-semibold">{t("colEr")}</th>
              <th className="px-4 py-3 font-semibold">{t("colSave")}</th>
              <th className="px-4 py-3 font-semibold">{t("colVideos")}</th>
            </tr>
          </thead>
          <tbody>
            {report.creators.map((creator) => (
              <tr
                key={creator.handle}
                data-testid="niche-row"
                className="border-ink/5 border-b last:border-b-0"
              >
                <td className="text-ink/50 px-4 py-3 tabular-nums">
                  {creator.rank}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/creators/${creator.handle}`}
                    className="text-violet font-medium hover:underline"
                  >
                    @{creator.handle}
                  </Link>
                  <span className="text-ink/40 ml-2 hidden text-xs sm:inline">
                    {creator.displayName}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatSearchVolume(creator.followerCount)}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {pct(creator.engagementRate)}
                </td>
                <td className="text-violet px-4 py-3 font-medium tabular-nums">
                  {pct(creator.saveRate)}
                </td>
                <td className="text-ink/60 px-4 py-3 tabular-nums">
                  {creator.videoCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.underrated.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">{t("underratedTitle")}</h2>
          <p className="text-ink/60 mt-1 text-sm">
            {t("underratedSub", {
              max: formatSearchVolume(SEO_QUALITY.underratedMaxFollowers),
            })}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.underrated.map((creator) => (
              <Link
                key={creator.handle}
                href={`/creators/${creator.handle}`}
                data-testid="underrated-card"
                className="border-violet/30 bg-violet/5 hover:border-violet rounded-2xl border p-5 transition"
              >
                <p className="font-bold">@{creator.handle}</p>
                <p className="text-ink/60 mt-1 text-sm">
                  {creator.displayName}
                </p>
                <p className="mt-3 text-sm tabular-nums">
                  <span className="text-violet font-semibold">
                    {pct(creator.saveRate)}
                  </span>{" "}
                  · {formatSearchVolume(creator.followerCount)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">
          {t("hashtagsTitle", { niche: report.niche })}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {report.topHashtags.map((tag) =>
            tag.qualifies ? (
              <Link
                key={tag.tag}
                href={`/hashtags/${encodeURIComponent(tag.tag)}`}
                className="border-violet/30 text-violet hover:bg-violet/5 rounded-full border px-3 py-1.5 text-sm font-medium"
              >
                #{tag.tag}
              </Link>
            ) : (
              <span
                key={tag.tag}
                className="border-ink/10 text-ink/50 rounded-full border px-3 py-1.5 text-sm"
              >
                #{tag.tag}
              </span>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
