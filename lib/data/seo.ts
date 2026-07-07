import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { median } from "@/lib/scoring";
import {
  passesCreatorQuality,
  passesHashtagQuality,
  SEO_QUALITY,
} from "@/lib/seo/config";

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOWER_SERIES_DAYS = 90;
const GROWTH_WEEKS = 12;

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface PublicVideo {
  caption: string;
  views: number;
  likes: number;
  bookmarks: number;
  postedAt: string; // YYYY-MM-DD
  creatorHandle?: string;
}

export interface TagStat {
  tag: string;
  count: number;
  /** Whether this tag has its own published /hashtags page. */
  qualifies: boolean;
}

interface RankedCreatorRow {
  id: string;
  handle: string;
  display_name: string;
  follower_count: number;
  video_count: number;
  er: number | null;
  save_rate: number | null;
}

/**
 * All creators in a niche with their latest daily stats — one lateral index
 * probe per creator. At index scale the ER rank becomes a denormalized
 * column maintained by ingestion; the shape here stays the same.
 */
async function listNicheCreators(niche: string): Promise<RankedCreatorRow[]> {
  return prisma.$queryRaw<RankedCreatorRow[]>(Prisma.sql`
    SELECT
      c.id,
      c.handle,
      c."displayName" AS display_name,
      c."followerCount" AS follower_count,
      (SELECT COUNT(*) FROM "Video" v WHERE v."creatorId" = c.id)::int AS video_count,
      s."engagementRate"::float8 AS er,
      s."saveRate"::float8 AS save_rate
    FROM "Creator" c
    LEFT JOIN LATERAL (
      SELECT sd."engagementRate", sd."saveRate"
      FROM "CreatorStatDaily" sd
      WHERE sd."creatorId" = c.id
      ORDER BY sd.date DESC
      LIMIT 1
    ) s ON TRUE
    WHERE c.niche = ${niche}
  `);
}

function qualityRanked(rows: RankedCreatorRow[]): RankedCreatorRow[] {
  return rows
    .filter((row) =>
      passesCreatorQuality({
        videoCount: row.video_count,
        followerCount: row.follower_count,
      }),
    )
    .sort((a, b) => (b.er ?? -1) - (a.er ?? -1));
}

async function tagStats(tags: string[]): Promise<Map<string, number>> {
  if (tags.length === 0) return new Map();
  const rows = await prisma.videoHashtag.groupBy({
    by: ["hashtag"],
    where: { hashtag: { in: tags } },
    _count: { hashtag: true },
  });
  return new Map(rows.map((row) => [row.hashtag, row._count.hashtag]));
}

// --- Creator report -------------------------------------------------------

export interface CreatorReport {
  handle: string;
  displayName: string;
  bio: string;
  followerCount: number;
  niche: string;
  firstSeenAt: Date;
  videoCount: number;
  totalLikes: number;
  followerSeries: SeriesPoint[];
  engagementRate: number | null;
  saveRate: number | null;
  nicheMedianEr: number | null;
  nicheMedianSave: number | null;
  nicheRank: number | null;
  nicheTotal: number;
  topVideos: PublicVideo[];
  topHashtags: TagStat[];
  similarCreators: Array<{
    handle: string;
    displayName: string;
    followerCount: number;
  }>;
}

/** Null when the handle is unknown or below publish-quality thresholds. */
export async function getCreatorReport(
  handle: string,
): Promise<CreatorReport | null> {
  const creator = await prisma.creator.findUnique({
    where: { handle },
    include: { _count: { select: { videos: true } } },
  });
  if (
    !creator ||
    !passesCreatorQuality({
      videoCount: creator._count.videos,
      followerCount: creator.followerCount,
    })
  ) {
    return null;
  }

  const since = new Date(Date.now() - FOLLOWER_SERIES_DAYS * DAY_MS);
  const [statRows, topVideoRows, nicheRows, likeAggregate] = await Promise.all([
    prisma.creatorStatDaily.findMany({
      where: { creatorId: creator.id, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.video.findMany({
      where: { creatorId: creator.id },
      orderBy: { views: "desc" },
      take: 5,
    }),
    listNicheCreators(creator.niche),
    prisma.video.aggregate({
      where: { creatorId: creator.id },
      _sum: { likes: true },
    }),
  ]);

  const latest = statRows.at(-1);
  const ranked = qualityRanked(nicheRows);
  const rankIndex = ranked.findIndex((row) => row.id === creator.id);
  const ers = ranked
    .map((row) => row.er)
    .filter((er): er is number => er !== null);
  const saves = ranked
    .map((row) => row.save_rate)
    .filter((save): save is number => save !== null);

  // Top hashtags across this creator's videos, with global qualification.
  const allVideos = await prisma.video.findMany({
    where: { creatorId: creator.id },
    select: { hashtags: true },
  });
  const tagCounts = new Map<string, number>();
  for (const video of allVideos) {
    for (const tag of new Set(video.hashtags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const globalCounts = await tagStats(topTags.map(([tag]) => tag));

  const similar = ranked
    .filter((row) => row.id !== creator.id)
    .sort(
      (a, b) =>
        Math.abs(a.follower_count - creator.followerCount) -
        Math.abs(b.follower_count - creator.followerCount),
    )
    .slice(0, 4);

  return {
    handle: creator.handle,
    displayName: creator.displayName,
    bio: creator.bio,
    followerCount: creator.followerCount,
    niche: creator.niche,
    firstSeenAt: creator.firstSeenAt,
    videoCount: creator._count.videos,
    totalLikes: likeAggregate._sum.likes ?? 0,
    followerSeries: statRows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      value: row.followerCount,
    })),
    engagementRate: latest?.engagementRate ?? null,
    saveRate: latest?.saveRate ?? null,
    nicheMedianEr: ers.length > 0 ? median(ers) : null,
    nicheMedianSave: saves.length > 0 ? median(saves) : null,
    nicheRank: rankIndex >= 0 ? rankIndex + 1 : null,
    nicheTotal: ranked.length,
    topVideos: topVideoRows.map((video) => ({
      caption: video.caption,
      views: video.views,
      likes: video.likes,
      bookmarks: video.bookmarks,
      postedAt: video.postedAt.toISOString().slice(0, 10),
    })),
    topHashtags: topTags.map(([tag, count]) => ({
      tag,
      count,
      qualifies: passesHashtagQuality(globalCounts.get(tag) ?? 0),
    })),
    similarCreators: similar.map((row) => ({
      handle: row.handle,
      displayName: row.display_name,
      followerCount: row.follower_count,
    })),
  };
}

// --- Hashtag report ---------------------------------------------------------

export interface HashtagReport {
  tag: string;
  videoCount: number;
  weeklySeries: SeriesPoint[];
  topVideos: PublicVideo[];
  relatedTags: TagStat[];
  topCreators: Array<{
    handle: string;
    displayName: string;
    followerCount: number;
    videosWithTag: number;
    qualifies: boolean;
  }>;
  primaryNiche: string | null;
}

/** Null when the tag is below the publish-quality threshold. */
export async function getHashtagReport(
  tag: string,
): Promise<HashtagReport | null> {
  const videoCount = await prisma.videoHashtag.count({
    where: { hashtag: tag },
  });
  if (!passesHashtagQuality(videoCount)) return null;

  const since = new Date(Date.now() - GROWTH_WEEKS * 7 * DAY_MS);
  const [weekly, topVideos, related, topCreators] = await Promise.all([
    prisma.$queryRaw<Array<{ week: Date; count: number }>>(Prisma.sql`
      SELECT date_trunc('week', v."postedAt") AS week, COUNT(*)::int AS count
      FROM "VideoHashtag" vh
      JOIN "Video" v ON v.id = vh."videoId"
      WHERE vh.hashtag = ${tag} AND v."postedAt" >= ${since}
      GROUP BY week
      ORDER BY week ASC
    `),
    prisma.$queryRaw<
      Array<{
        caption: string;
        views: number;
        likes: number;
        bookmarks: number;
        posted_at: Date;
        handle: string;
      }>
    >(Prisma.sql`
      SELECT v.caption, v.views, v.likes, v.bookmarks,
             v."postedAt" AS posted_at, c.handle
      FROM "VideoHashtag" vh
      JOIN "Video" v ON v.id = vh."videoId"
      JOIN "Creator" c ON c.id = v."creatorId"
      WHERE vh.hashtag = ${tag}
      ORDER BY v.views DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{ hashtag: string; shared: number }>>(Prisma.sql`
      SELECT vh2.hashtag, COUNT(DISTINCT vh2."videoId")::int AS shared
      FROM "VideoHashtag" vh1
      JOIN "VideoHashtag" vh2
        ON vh2."videoId" = vh1."videoId" AND vh2.hashtag <> vh1.hashtag
      WHERE vh1.hashtag = ${tag}
      GROUP BY vh2.hashtag
      ORDER BY shared DESC, vh2.hashtag ASC
      LIMIT 10
    `),
    prisma.$queryRaw<
      Array<{
        handle: string;
        display_name: string;
        follower_count: number;
        niche: string;
        with_tag: number;
        video_count: number;
      }>
    >(Prisma.sql`
      SELECT c.handle, c."displayName" AS display_name,
             c."followerCount" AS follower_count, c.niche,
             COUNT(*)::int AS with_tag,
             (SELECT COUNT(*) FROM "Video" v2 WHERE v2."creatorId" = c.id)::int AS video_count
      FROM "VideoHashtag" vh
      JOIN "Video" v ON v.id = vh."videoId"
      JOIN "Creator" c ON c.id = v."creatorId"
      WHERE vh.hashtag = ${tag}
      GROUP BY c.id
      ORDER BY with_tag DESC
      LIMIT 5
    `),
  ]);

  const relatedCounts = await tagStats(related.map((row) => row.hashtag));

  return {
    tag,
    videoCount,
    weeklySeries: weekly.map((row) => ({
      date: row.week.toISOString().slice(0, 10),
      value: row.count,
    })),
    topVideos: topVideos.map((video) => ({
      caption: video.caption,
      views: video.views,
      likes: video.likes,
      bookmarks: video.bookmarks,
      postedAt: video.posted_at.toISOString().slice(0, 10),
      creatorHandle: video.handle,
    })),
    relatedTags: related.map((row) => ({
      tag: row.hashtag,
      count: row.shared,
      qualifies: passesHashtagQuality(relatedCounts.get(row.hashtag) ?? 0),
    })),
    topCreators: topCreators.map((row) => ({
      handle: row.handle,
      displayName: row.display_name,
      followerCount: row.follower_count,
      videosWithTag: row.with_tag,
      qualifies: passesCreatorQuality({
        videoCount: row.video_count,
        followerCount: row.follower_count,
      }),
    })),
    primaryNiche: topCreators[0]?.niche ?? null,
  };
}

// --- Niche report -------------------------------------------------------------

export interface NicheReport {
  niche: string;
  creators: Array<{
    rank: number;
    handle: string;
    displayName: string;
    followerCount: number;
    engagementRate: number | null;
    saveRate: number | null;
    videoCount: number;
  }>;
  medianEr: number | null;
  medianSave: number | null;
  underrated: Array<{
    handle: string;
    displayName: string;
    followerCount: number;
    saveRate: number;
  }>;
  topHashtags: TagStat[];
}

/** Null when the niche has too few quality creators to publish. */
export async function getNicheReport(
  niche: string,
): Promise<NicheReport | null> {
  const ranked = qualityRanked(await listNicheCreators(niche));
  if (ranked.length < SEO_QUALITY.nicheMinCreators) return null;

  const ers = ranked
    .map((row) => row.er)
    .filter((er): er is number => er !== null);
  const saves = ranked
    .map((row) => row.save_rate)
    .filter((save): save is number => save !== null);
  const medianSave = saves.length > 0 ? median(saves) : null;

  const underrated = ranked.filter(
    (row) =>
      row.save_rate !== null &&
      medianSave !== null &&
      row.save_rate > medianSave &&
      row.follower_count < SEO_QUALITY.underratedMaxFollowers,
  );

  const nicheTags = await prisma.$queryRaw<
    Array<{ hashtag: string; count: number }>
  >(Prisma.sql`
    SELECT vh.hashtag, COUNT(*)::int AS count
    FROM "VideoHashtag" vh
    JOIN "Video" v ON v.id = vh."videoId"
    JOIN "Creator" c ON c.id = v."creatorId"
    WHERE c.niche = ${niche}
    GROUP BY vh.hashtag
    ORDER BY count DESC
    LIMIT 8
  `);
  const globalCounts = await tagStats(nicheTags.map((row) => row.hashtag));

  return {
    niche,
    creators: ranked.map((row, index) => ({
      rank: index + 1,
      handle: row.handle,
      displayName: row.display_name,
      followerCount: row.follower_count,
      engagementRate: row.er,
      saveRate: row.save_rate,
      videoCount: row.video_count,
    })),
    medianEr: ers.length > 0 ? median(ers) : null,
    medianSave,
    underrated: underrated.map((row) => ({
      handle: row.handle,
      displayName: row.display_name,
      followerCount: row.follower_count,
      saveRate: row.save_rate as number,
    })),
    topHashtags: nicheTags.map((row) => ({
      tag: row.hashtag,
      count: row.count,
      qualifies: passesHashtagQuality(globalCounts.get(row.hashtag) ?? 0),
    })),
  };
}

// --- Listings for sitemaps and prerendering ------------------------------------

/** Quality-passing creator handles, most-followed first. */
export async function listQualityCreatorHandles(
  limit: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ handle: string }>>(Prisma.sql`
    SELECT c.handle
    FROM "Creator" c
    WHERE c."followerCount" >= ${SEO_QUALITY.creatorMinFollowers}
      AND (SELECT COUNT(*) FROM "Video" v WHERE v."creatorId" = c.id) >= ${SEO_QUALITY.creatorMinVideos}
    ORDER BY c."followerCount" DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => row.handle);
}

/** Quality-passing hashtags, most-used first. */
export async function listQualityHashtags(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ hashtag: string }>>(Prisma.sql`
    SELECT hashtag
    FROM "VideoHashtag"
    GROUP BY hashtag
    HAVING COUNT(*) >= ${SEO_QUALITY.hashtagMinVideos}
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => row.hashtag);
}

/** Niches with enough quality creators for a hub page. */
export async function listQualityNiches(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ niche: string }>>(Prisma.sql`
    SELECT c.niche
    FROM "Creator" c
    WHERE c."followerCount" >= ${SEO_QUALITY.creatorMinFollowers}
      AND (SELECT COUNT(*) FROM "Video" v WHERE v."creatorId" = c.id) >= ${SEO_QUALITY.creatorMinVideos}
    GROUP BY c.niche
    HAVING COUNT(*) >= ${SEO_QUALITY.nicheMinCreators}
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => row.niche);
}
