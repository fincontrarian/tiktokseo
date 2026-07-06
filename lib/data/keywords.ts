import { cached } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { gatedQueryCacheKey, toDisplayGrowth } from "@/lib/keywords/gate";
import type {
  DisplayGrowth,
  GatedKeywordQuery,
  KeywordLocale,
  SortColumn,
} from "@/lib/keywords/gate";
import { hashtagify } from "@/lib/scoring";

const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_DAYS = 30;
const RELATED_LIMIT = 15;
const SUGGEST_LIMIT = 8;
const EXPORT_ROW_LIMIT = 500;

export type Competition = "low" | "medium" | "high";

export interface KeywordRow {
  id: string;
  term: string;
  locale: KeywordLocale;
  videoCount: number;
  totalViews: number;
  growth7d: DisplayGrowth;
  growth30d: DisplayGrowth;
  competition: Competition;
  /** Daily total views over the trailing 30 days (up to asOf), ascending. */
  spark: number[];
}

export interface KeywordPage {
  rows: KeywordRow[];
  totalCount: number;
  /** ISO date (YYYY-MM-DD) the stats are computed as of. */
  asOf: string;
}

export interface RelatedHashtag {
  hashtag: string;
  sharedVideos: number;
}

// Sort expressions are an allowlist — never interpolate user input here.
const SORT_SQL: Record<SortColumn, Prisma.Sql> = {
  term: Prisma.sql`term`,
  videoCount: Prisma.sql`video_count`,
  totalViews: Prisma.sql`total_views`,
  growth7d: Prisma.sql`growth7`,
  growth30d: Prisma.sql`growth30`,
};

interface RawKeywordRow {
  id: string;
  term: string;
  locale: string;
  video_count: number;
  total_views: number;
  growth7: number | null;
  growth30: number | null;
  tercile: number;
  total_count: number;
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function tercileToCompetition(tercile: number): Competition {
  if (tercile <= 1) return "low";
  if (tercile === 2) return "medium";
  return "high";
}

/**
 * The main keyword list. Only accepts a GATED query (see lib/keywords/gate)
 * so plan rules are enforced below the UI. Cached in Redis with the TTL the
 * gate chose (5 min paid, 24 h free).
 */
export async function queryKeywords(
  gated: GatedKeywordQuery,
): Promise<KeywordPage> {
  return cached(gatedQueryCacheKey(gated), gated.cacheTtlSeconds, () =>
    loadKeywords(gated),
  );
}

/** CSV export variant: first N rows of the gated query, one page. */
export async function queryKeywordsForExport(
  gated: GatedKeywordQuery,
): Promise<KeywordPage> {
  return queryKeywords({ ...gated, page: 1, pageSize: EXPORT_ROW_LIMIT });
}

async function loadKeywords(gated: GatedKeywordQuery): Promise<KeywordPage> {
  const asOf = gated.asOf;
  const asOf7 = new Date(asOf.getTime() - 7 * DAY_MS);
  const asOf30 = new Date(asOf.getTime() - 30 * DAY_MS);

  const searchSql = gated.search
    ? Prisma.sql`WHERE term ILIKE ${escapeLike(gated.search.trim().toLowerCase()) + "%"}`
    : Prisma.empty;
  const growthSql =
    gated.minGrowth30d !== undefined
      ? gated.search
        ? Prisma.sql`AND growth30 >= ${gated.minGrowth30d}`
        : Prisma.sql`WHERE growth30 >= ${gated.minGrowth30d}`
      : Prisma.empty;

  const limit = gated.rowCap ?? gated.pageSize;
  const offset = gated.rowCap !== null ? 0 : (gated.page - 1) * gated.pageSize;
  const direction =
    gated.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  // Heavy query #1 — see docs/query-plans.md.
  // latest: one lateral index probe per keyword for the snapshot at asOf and
  // the 7d/30d comparison points; competition terciles are computed over the
  // whole locale (stable per keyword, independent of filters).
  const rows = await prisma.$queryRaw<RawKeywordRow[]>(Prisma.sql`
    WITH latest AS (
      SELECT
        k.id,
        k.term,
        k.locale,
        cur."videoCount"        AS video_count,
        cur."totalViews"::float8 AS total_views,
        CASE
          WHEN w7."totalViews" IS NULL OR w7."totalViews" = 0 THEN NULL
          ELSE (cur."totalViews" - w7."totalViews")::float8 / w7."totalViews"::float8
        END AS growth7,
        CASE
          WHEN w30."totalViews" IS NULL OR w30."totalViews" = 0 THEN NULL
          ELSE (cur."totalViews" - w30."totalViews")::float8 / w30."totalViews"::float8
        END AS growth30,
        NTILE(3) OVER (ORDER BY cur."videoCount") AS tercile
      FROM "Keyword" k
      JOIN LATERAL (
        SELECT s."videoCount", s."totalViews"
        FROM "KeywordStatDaily" s
        WHERE s."keywordId" = k.id AND s.date <= ${asOf}
        ORDER BY s.date DESC
        LIMIT 1
      ) cur ON TRUE
      LEFT JOIN LATERAL (
        SELECT s."totalViews"
        FROM "KeywordStatDaily" s
        WHERE s."keywordId" = k.id AND s.date <= ${asOf7}
        ORDER BY s.date DESC
        LIMIT 1
      ) w7 ON TRUE
      LEFT JOIN LATERAL (
        SELECT s."totalViews"
        FROM "KeywordStatDaily" s
        WHERE s."keywordId" = k.id AND s.date <= ${asOf30}
        ORDER BY s.date DESC
        LIMIT 1
      ) w30 ON TRUE
      WHERE k.locale = ${gated.locale}
    ),
    filtered AS (
      SELECT *, COUNT(*) OVER ()::int AS total_count
      FROM latest
      ${searchSql}
      ${growthSql}
    )
    SELECT *
    FROM filtered
    ORDER BY ${SORT_SQL[gated.sort]} ${direction} NULLS LAST, term ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const totalCount =
    rows.length > 0 ? rows[0].total_count : await countKeywords(gated);
  const sparks = await loadSparklines(
    rows.map((row) => row.id),
    asOf,
  );

  return {
    asOf: asOf.toISOString().slice(0, 10),
    totalCount,
    rows: rows.map((row) => ({
      id: row.id,
      term: row.term,
      locale: row.locale as KeywordLocale,
      videoCount: row.video_count,
      totalViews: row.total_views,
      growth7d: toDisplayGrowth(row.growth7, gated.precision),
      growth30d: toDisplayGrowth(row.growth30, gated.precision),
      competition: tercileToCompetition(row.tercile),
      spark: sparks.get(row.id) ?? [],
    })),
  };
}

/** Fallback count when a page lands past the end of the result set. */
async function countKeywords(gated: GatedKeywordQuery): Promise<number> {
  const asOf30 = new Date(gated.asOf.getTime() - 30 * DAY_MS);
  const searchSql = gated.search
    ? Prisma.sql`AND k.term ILIKE ${escapeLike(gated.search.trim().toLowerCase()) + "%"}`
    : Prisma.empty;

  if (gated.minGrowth30d === undefined) {
    const result = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count FROM "Keyword" k
      WHERE k.locale = ${gated.locale} ${searchSql}
    `);
    return result[0]?.count ?? 0;
  }

  const result = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "Keyword" k
    JOIN LATERAL (
      SELECT s."totalViews" FROM "KeywordStatDaily" s
      WHERE s."keywordId" = k.id AND s.date <= ${gated.asOf}
      ORDER BY s.date DESC LIMIT 1
    ) cur ON TRUE
    LEFT JOIN LATERAL (
      SELECT s."totalViews" FROM "KeywordStatDaily" s
      WHERE s."keywordId" = k.id AND s.date <= ${asOf30}
      ORDER BY s.date DESC LIMIT 1
    ) w30 ON TRUE
    WHERE k.locale = ${gated.locale} ${searchSql}
      AND w30."totalViews" IS NOT NULL AND w30."totalViews" <> 0
      AND (cur."totalViews" - w30."totalViews")::float8 / w30."totalViews"::float8 >= ${gated.minGrowth30d}
  `);
  return result[0]?.count ?? 0;
}

async function loadSparklines(
  keywordIds: string[],
  asOf: Date,
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (keywordIds.length === 0) return map;

  const since = new Date(asOf.getTime() - SPARKLINE_DAYS * DAY_MS);
  const stats = await prisma.keywordStatDaily.findMany({
    where: { keywordId: { in: keywordIds }, date: { gt: since, lte: asOf } },
    orderBy: { date: "asc" },
    select: { keywordId: true, totalViews: true },
  });
  for (const stat of stats) {
    const series = map.get(stat.keywordId) ?? [];
    series.push(Number(stat.totalViews));
    map.set(stat.keywordId, series);
  }
  return map;
}

/**
 * Related terms: hashtags co-occurring on videos with the keyword's hashtag
 * form. Recency-gated via asOf like everything else. Heavy query #2 — see
 * docs/query-plans.md.
 */
export async function relatedHashtags(
  term: string,
  gated: GatedKeywordQuery,
): Promise<RelatedHashtag[]> {
  const tag = hashtagify(term);
  if (!tag) return [];
  const asOfDay = gated.asOf.toISOString().slice(0, 10);
  const key = `kw:related:v1:${tag}:${asOfDay}`;

  return cached(key, gated.cacheTtlSeconds, async () => {
    const rows = await prisma.$queryRaw<
      Array<{ hashtag: string; shared_videos: number }>
    >(Prisma.sql`
      SELECT
        vh2.hashtag,
        COUNT(DISTINCT vh2."videoId")::int AS shared_videos
      FROM "VideoHashtag" vh1
      JOIN "VideoHashtag" vh2
        ON vh2."videoId" = vh1."videoId" AND vh2.hashtag <> vh1.hashtag
      JOIN "Video" v ON v.id = vh1."videoId"
      WHERE vh1.hashtag = ${tag} AND v."postedAt" <= ${gated.asOf}
      GROUP BY vh2.hashtag
      ORDER BY shared_videos DESC, vh2.hashtag ASC
      LIMIT ${RELATED_LIMIT}
    `);
    return rows.map((row) => ({
      hashtag: row.hashtag,
      sharedVideos: row.shared_videos,
    }));
  });
}

/** Prefix autocomplete over the keywords table, locale-aware. */
export async function suggestKeywords(
  prefix: string,
  locale: KeywordLocale,
): Promise<string[]> {
  const cleaned = prefix.trim().toLowerCase();
  if (cleaned.length < 1) return [];
  const key = `kw:suggest:v1:${locale}:${cleaned}`;

  return cached(key, 300, async () => {
    const keywords = await prisma.keyword.findMany({
      where: {
        locale,
        term: { startsWith: cleaned, mode: "insensitive" },
      },
      orderBy: { term: "asc" },
      take: SUGGEST_LIMIT,
      select: { term: true },
    });
    return keywords.map((k) => k.term);
  });
}

// --- Tracking (rank tracking ships later; we persist the intent now) --------

export async function trackKeyword(
  userId: string,
  keywordId: string,
): Promise<void> {
  await prisma.trackedKeyword.upsert({
    where: { userId_keywordId: { userId, keywordId } },
    create: { userId, keywordId },
    update: {},
  });
}

export async function listTrackedKeywordIds(userId: string): Promise<string[]> {
  const tracked = await prisma.trackedKeyword.findMany({
    where: { userId },
    select: { keywordId: true },
  });
  return tracked.map((t) => t.keywordId);
}
