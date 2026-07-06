import { prisma } from "@/lib/db";
import type { NicheBenchmarks } from "@/lib/scoring";

/**
 * Load benchmarks + top-10 search keywords for a niche from our index.
 * Returns empty benchmarks when the niche has no data yet — the scoring
 * engine degrades those checks to "warn" rather than failing.
 */
export async function getNicheBenchmarks(
  niche: string,
): Promise<NicheBenchmarks> {
  const [benchmark, keywords] = await Promise.all([
    prisma.nicheBenchmark.findUnique({ where: { niche } }),
    prisma.nicheKeyword.findMany({
      where: { niche },
      orderBy: { rank: "asc" },
      take: 10,
    }),
  ]);

  return {
    topKeywords: keywords.map((k) => ({
      keyword: k.keyword,
      monthlyVolume: k.monthlyVolume,
    })),
    medianPostsPerWeek: benchmark?.medianPostsPerWeek ?? 0,
    medianEngagementRate: benchmark?.medianEngagementRate ?? 0,
    medianSaveRate: benchmark?.medianSaveRate ?? 0,
  };
}
