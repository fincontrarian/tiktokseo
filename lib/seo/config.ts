/**
 * Programmatic SEO configuration — THE single source of truth for
 * publish-quality thresholds and generation limits. Pure TypeScript.
 *
 * Every surface that decides whether a page exists (page templates,
 * sitemap generation, internal links) reads from here, so a threshold
 * change propagates everywhere at once and we never ship thin pages.
 */

export const SEO_QUALITY = {
  /** Creator pages publish only at or above these. */
  creatorMinVideos: 5,
  creatorMinFollowers: 1000,
  /** Hashtag pages publish only with at least this many videos. */
  hashtagMinVideos: 50,
  /** Niche hubs publish only with at least this many quality creators. */
  nicheMinCreators: 3,
  /** "Underrated" = save rate above the niche median AND fewer followers. */
  underratedMaxFollowers: 10_000,
} as const;

/** Google's hard cap is 50k URLs per sitemap; we stay under it. */
export const SITEMAP_MAX_URLS = 45_000;

/**
 * Launch lever: how many URLs per page type enter the sitemaps. Raise the
 * env var (or pass --limit to scripts/generate-sitemaps.ts) to scale from
 * the 1k seed batch to millions — no code changes.
 */
export const DEFAULT_PAGE_LIMIT = 1000;

export function pageLimitFromEnv(): number {
  const raw = Number(process.env.SEO_PAGE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_PAGE_LIMIT;
}

/** How many pages per type to prerender at build time (ISR fills the rest). */
export const PRERENDER_BATCH = 25;

export interface CreatorQualityInput {
  videoCount: number;
  followerCount: number;
}

export function passesCreatorQuality(input: CreatorQualityInput): boolean {
  return (
    input.videoCount >= SEO_QUALITY.creatorMinVideos &&
    input.followerCount >= SEO_QUALITY.creatorMinFollowers
  );
}

export function passesHashtagQuality(videoCount: number): boolean {
  return videoCount >= SEO_QUALITY.hashtagMinVideos;
}
