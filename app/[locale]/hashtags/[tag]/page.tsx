import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { StatChart } from "@/components/dashboard/stat-chart";
import { Link } from "@/i18n/navigation";
import { getHashtagReport, listQualityHashtags } from "@/lib/data";
import { formatSearchVolume, hashtagify } from "@/lib/scoring";
import { PRERENDER_BATCH } from "@/lib/seo/config";

export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ locale: string; tag: string }>;
}

export async function generateStaticParams() {
  try {
    const tags = await listQualityHashtags(PRERENDER_BATCH);
    return tags.map((tag) => ({ tag }));
  } catch {
    return [];
  }
}

function parseTag(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const tag = hashtagify(decoded.replace(/^#/, ""));
  return tag.length >= 2 && tag.length <= 100 ? tag : null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, tag: rawTag } = await params;
  const tag = parseTag(rawTag);
  if (!tag) return {};
  const report = await getHashtagReport(tag);
  if (!report) return {};
  const t = await getTranslations({ locale, namespace: "publicHashtag" });
  return {
    title: t("metaTitle", { tag: report.tag }),
    description: t("metaDescription", {
      tag: report.tag,
      count: report.videoCount,
    }),
  };
}

export default async function HashtagPage({ params }: PageProps) {
  const { locale, tag: rawTag } = await params;
  setRequestLocale(locale);

  const tag = parseTag(rawTag);
  if (!tag) notFound();
  const report = await getHashtagReport(tag);
  if (!report) notFound(); // below the 50-video publish threshold

  const t = await getTranslations("publicHashtag");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            #{report.tag}
          </h1>
          <p data-testid="hashtag-volume" className="text-ink/60 mt-2 text-sm">
            {t("videosCount", { count: report.videoCount })}
          </p>
        </div>
        {report.primaryNiche && (
          <Link
            href={`/niches/${report.primaryNiche}`}
            data-testid="niche-hub-link"
            className="text-violet text-sm font-medium hover:underline"
          >
            {t("nicheLink", { niche: report.primaryNiche })}
          </Link>
        )}
      </header>

      <section className="mt-8">
        <StatChart
          title={t("chartTitle")}
          data={report.weeklySeries.map((p) => ({
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
                  {formatSearchVolume(video.views)} {t("views")} · {t("by")}{" "}
                  {video.creatorHandle ? `@${video.creatorHandle}` : "—"} ·{" "}
                  {video.postedAt}
                </p>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-xl font-bold">
            {t("topCreatorsTitle", { tag: report.tag })}
          </h2>
          <ul className="mt-4 space-y-2">
            {report.topCreators.map((creator) => (
              <li
                key={creator.handle}
                data-testid="top-creator"
                className="border-ink/10 flex items-baseline justify-between gap-2 rounded-xl border px-4 py-3 text-sm"
              >
                {creator.qualifies ? (
                  <Link
                    href={`/creators/${creator.handle}`}
                    className="text-violet font-medium hover:underline"
                  >
                    @{creator.handle}
                  </Link>
                ) : (
                  <span className="font-medium">@{creator.handle}</span>
                )}
                <span className="text-ink/50 text-xs tabular-nums">
                  {t("videosWithTag", { count: creator.videosWithTag })} ·{" "}
                  {formatSearchVolume(creator.followerCount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside>
          <h2 className="text-lg font-bold">{t("relatedTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {report.relatedTags.map((related) => (
              <li
                key={related.tag}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                {related.qualifies ? (
                  <Link
                    href={`/hashtags/${encodeURIComponent(related.tag)}`}
                    data-testid="related-tag-link"
                    className="text-violet font-medium hover:underline"
                  >
                    #{related.tag}
                  </Link>
                ) : (
                  <span className="text-ink/60">#{related.tag}</span>
                )}
                <span className="text-ink/40 text-xs whitespace-nowrap tabular-nums">
                  {t("sharedVideos", { count: related.count })}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
