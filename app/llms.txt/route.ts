import { listQualityNiches } from "@/lib/data";

export const revalidate = 86400;

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/**
 * /llms.txt — a plain-language site guide for AI agents and assistants.
 * https://llmstxt.org
 */
export async function GET() {
  const niches = await listQualityNiches(10).catch(() => [] as string[]);
  const nicheLines = niches
    .map(
      (niche) =>
        `- [Top ${niche} creators](${BASE}/niches/${niche}): ${niche} creators ranked by engagement rate, with medians and underrated profiles`,
    )
    .join("\n");

  const body = `# Findable

> Findable is a TikTok SEO platform for creators and agencies: audit a profile's
> search visibility, research what a niche searches for, and track results daily.
> It is built on our own index of ~75 million TikTok videos and ~25 million
> creator profiles with historical engagement statistics, refreshed daily.
> We store public metadata only (captions, hashtags, engagement counts, public
> profile fields) — never video files.

Findable is an independent analytics platform and is not affiliated with,
endorsed by, or sponsored by TikTok or ByteDance Ltd.

Key metrics: we rank by engagement rate rather than follower count, and treat
bookmark/save velocity as the leading signal of search performance.

## Tools

- [Free TikTok SEO audit](${BASE}/audit): score any public TikTok profile 0-100 across six search-visibility checks, no signup required
- [Keyword research](${BASE}/app/keywords): search volumes, growth and competition for TikTok search keywords in English, Vietnamese and Indonesian
- [Creator reports](${BASE}/creators/lanmoves): example public report — follower history, engagement rate and save rate vs niche medians, top videos and hashtags

## Directories

${nicheLines || `- [Creator and hashtag directories](${BASE}/sitemap.xml)`}

## Sitemaps

- [Sitemap index](${BASE}/sitemap.xml): all published creator, hashtag and niche pages (quality-filtered)

## Languages

English (${BASE}/), Tiếng Việt (${BASE}/vi), Bahasa Indonesia (${BASE}/id)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
