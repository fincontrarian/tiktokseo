import type { Metadata } from "next";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import { StatChart } from "@/components/dashboard/stat-chart";
import { Link } from "@/i18n/navigation";
import { getCreatorReport, listQualityCreatorHandles } from "@/lib/data";
import { formatSearchVolume } from "@/lib/scoring";
import { PRERENDER_BATCH } from "@/lib/seo/config";
import { buildCreatorJsonLd } from "@/lib/seo/jsonld";
import { isValidHandle, normalizeHandle } from "@/lib/validation";

// ISR: statically generated, refreshed daily — pages scale to millions.
export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ locale: string; handle: string }>;
}

export async function generateStaticParams() {
  try {
    const handles = await listQualityCreatorHandles(PRERENDER_BATCH);
    return handles.map((handle) => ({ handle }));
  } catch {
    return []; // DB unavailable at build time — ISR fills in on demand.
  }
}

function parseHandle(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const handle = normalizeHandle(decoded);
  return isValidHandle(handle) ? handle : null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, handle: rawHandle } = await params;
  const handle = parseHandle(rawHandle);
  if (!handle) return {};
  const report = await getCreatorReport(handle);
  if (!report) return {};
  const t = await getTranslations({ locale, namespace: "publicCreator" });
  return {
    title: t("metaTitle", { name: report.displayName, handle: report.handle }),
    description: t("metaDescription", { handle: report.handle }),
  };
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export default async function CreatorPage({ params }: PageProps) {
  const { locale, handle: rawHandle } = await params;
  setRequestLocale(locale);

  const handle = parseHandle(rawHandle);
  if (!handle) notFound();
  const report = await getCreatorReport(handle);
  if (!report) notFound(); // unknown or below publish-quality thresholds

  const [t, format] = await Promise.all([
    getTranslations("publicCreator"),
    getFormatter(),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const jsonLd = buildCreatorJsonLd({
    url: `${base}/creators/${report.handle}`,
    name: report.displayName,
    handle: report.handle,
    bio: report.bio,
    followerCount: report.followerCount,
    totalLikes: report.totalLikes,
    firstSeenAt: report.firstSeenAt,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {report.displayName}{" "}
            <span className="text-ink/50 font-medium">@{report.handle}</span>
          </h1>
          <p className="text-ink/70 mt-2 max-w-xl">{report.bio}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {report.nicheRank !== null && (
              <Link
                href={`/niches/${report.niche}`}
                data-testid="niche-rank-badge"
                className="bg-violet rounded-full px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                {t("nicheRank", {
                  rank: report.nicheRank,
                  total: report.nicheTotal,
                  niche: report.niche,
                })}
              </Link>
            )}
            <span className="text-ink/50">
              {t("indexedSince", {
                date: format.dateTime(report.firstSeenAt, {
                  dateStyle: "long",
                }),
              })}
            </span>
          </div>
        </div>
        {/* Prominent CTA into the free audit — the acquisition loop. */}
        <div className="bg-ink w-full rounded-2xl p-5 text-white sm:w-auto sm:min-w-72">
          <p className="font-bold">
            {t("ctaTitle", { handle: report.handle })}
          </p>
          <p className="mt-1 text-sm text-white/70">{t("ctaSub")}</p>
          <Link
            href={`/audit/${report.handle}`}
            data-testid="audit-cta"
            className="bg-lime text-ink mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90"
          >
            {t("ctaButton", { handle: report.handle })}
          </Link>
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <div className="border-ink/10 rounded-2xl border p-4">
          <p className="text-ink/50 text-xs font-medium uppercase">
            {t("followers")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatSearchVolume(report.followerCount)}
          </p>
        </div>
        <div className="border-ink/10 rounded-2xl border p-4">
          <p className="text-ink/50 text-xs font-medium uppercase">
            {t("videos")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {report.videoCount}
          </p>
        </div>
        <div className="border-ink/10 rounded-2xl border p-4">
          <p className="text-ink/50 text-xs font-medium uppercase">
            {t("erTile")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {pct(report.engagementRate)}
          </p>
          {report.nicheMedianEr !== null && (
            <p className="text-ink/50 mt-1 text-xs">
              {t("vsMedian", { value: pct(report.nicheMedianEr) })}
            </p>
          )}
        </div>
        <div className="border-violet/30 bg-violet/5 rounded-2xl border p-4">
          <p className="text-violet text-xs font-medium uppercase">
            {t("saveTile")}
          </p>
          <p className="text-violet mt-1 text-2xl font-bold tabular-nums">
            {pct(report.saveRate)}
          </p>
          {report.nicheMedianSave !== null && (
            <p className="text-ink/50 mt-1 text-xs">
              {t("vsMedian", { value: pct(report.nicheMedianSave) })}
            </p>
          )}
        </div>
      </div>

      <section className="mt-8">
        <StatChart
          title={t("chartTitle")}
          data={report.followerSeries.map((p) => ({
            date: p.date,
            value: p.value,
          }))}
          events={[]}
          format="count"
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <h2 className="text-xl font-bold">{t("topVideosTitle")}</h2>
          <ul className="mt-4 space-y-3">
            {report.topVideos.map((video, index) => (
              <li
                key={index}
                data-testid="top-video"
                className="border-ink/10 rounded-2xl border p-4"
              >
                <p className="font-medium">{video.caption}</p>
                <p className="text-ink/50 mt-1 text-sm tabular-nums">
                  {formatSearchVolume(video.views)} {t("views")} ·{" "}
                  {formatSearchVolume(video.likes)} {t("likes")} ·{" "}
                  {formatSearchVolume(video.bookmarks)} {t("saves")} ·{" "}
                  {video.postedAt}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="text-lg font-bold">{t("topHashtagsTitle")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.topHashtags.map((tag) =>
                tag.qualifies ? (
                  <Link
                    key={tag.tag}
                    href={`/hashtags/${encodeURIComponent(tag.tag)}`}
                    className="border-violet/30 text-violet hover:bg-violet/5 rounded-full border px-3 py-1 text-sm font-medium"
                  >
                    #{tag.tag}
                  </Link>
                ) : (
                  <span
                    key={tag.tag}
                    className="border-ink/10 text-ink/50 rounded-full border px-3 py-1 text-sm"
                  >
                    #{tag.tag}
                  </span>
                ),
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold">
              {t("similarTitle", { niche: report.niche })}
            </h2>
            <ul className="mt-3 space-y-2">
              {report.similarCreators.map((creator) => (
                <li key={creator.handle}>
                  <Link
                    href={`/creators/${creator.handle}`}
                    data-testid="similar-creator"
                    className="border-ink/10 hover:border-violet flex items-baseline justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm transition"
                  >
                    <span className="font-medium">@{creator.handle}</span>
                    <span className="text-ink/50 text-xs tabular-nums">
                      {formatSearchVolume(creator.followerCount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/niches/${report.niche}`}
              data-testid="niche-hub-link"
              className="text-violet mt-3 inline-block text-sm font-medium hover:underline"
            >
              {t("nicheHub", { niche: report.niche })}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
