import { prisma } from "@/lib/db";
import { pageLimitFromEnv } from "@/lib/seo/config";
import {
  buildSitemapXml,
  chunkUrls,
  gzipXml,
  localizedLocs,
} from "@/lib/seo/sitemap";
import type { SitemapUrl } from "@/lib/seo/sitemap";
import {
  listQualityCreatorHandles,
  listQualityHashtags,
  listQualityNiches,
} from "./seo";

export interface SitemapRunResult {
  files: Array<{ name: string; urlCount: number }>;
  totalUrls: number;
  limit: number;
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/**
 * Rebuild all sitemap files from the DB, honoring quality thresholds and
 * the page limit (the launch lever — raise it to scale, don't change code).
 * Files are gzipped and stored in the sitemap_files table; /sitemap.xml
 * serves the index and /sitemaps/[name] serves the children.
 */
export async function generateSitemaps(options?: {
  limit?: number;
}): Promise<SitemapRunResult> {
  const limit = options?.limit ?? pageLimitFromEnv();
  const base = baseUrl();
  const today = new Date().toISOString().slice(0, 10);

  const [creators, hashtags, niches] = await Promise.all([
    listQualityCreatorHandles(limit),
    listQualityHashtags(limit),
    listQualityNiches(limit),
  ]);

  const byType: Record<string, SitemapUrl[]> = {
    creators: creators.flatMap((handle) =>
      localizedLocs(base, `/creators/${encodeURIComponent(handle)}`).map(
        (loc) => ({ loc, lastmod: today, changefreq: "daily" as const }),
      ),
    ),
    hashtags: hashtags.flatMap((tag) =>
      localizedLocs(base, `/hashtags/${encodeURIComponent(tag)}`).map(
        (loc) => ({ loc, lastmod: today, changefreq: "daily" as const }),
      ),
    ),
    niches: niches.flatMap((niche) =>
      localizedLocs(base, `/niches/${encodeURIComponent(niche)}`).map(
        (loc) => ({ loc, lastmod: today, changefreq: "weekly" as const }),
      ),
    ),
  };

  const files: Array<{ name: string; urlCount: number }> = [];
  for (const [type, urls] of Object.entries(byType)) {
    const chunks = chunkUrls(urls);
    for (const [index, chunk] of chunks.entries()) {
      const name = `${type}-${index + 1}.xml`;
      // Copy into a plain ArrayBuffer-backed array for Prisma's Bytes type.
      const content = new Uint8Array(gzipXml(buildSitemapXml(chunk)));
      await prisma.sitemapFile.upsert({
        where: { name },
        create: { name, content, urlCount: chunk.length },
        update: { content, urlCount: chunk.length, generatedAt: new Date() },
      });
      files.push({ name, urlCount: chunk.length });
    }
    // Drop stale higher-numbered chunks from previous, larger runs.
    await prisma.sitemapFile.deleteMany({
      where: {
        name: { startsWith: `${type}-` },
        NOT: { name: { in: chunks.map((_, i) => `${type}-${i + 1}.xml`) } },
      },
    });
  }

  return {
    files,
    totalUrls: files.reduce((sum, file) => sum + file.urlCount, 0),
    limit,
  };
}

export interface SitemapIndexEntry {
  name: string;
  generatedAt: Date;
}

export async function listSitemapFiles(): Promise<SitemapIndexEntry[]> {
  const rows = await prisma.sitemapFile.findMany({
    select: { name: true, generatedAt: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

export async function getSitemapFile(name: string): Promise<Uint8Array | null> {
  const row = await prisma.sitemapFile.findUnique({ where: { name } });
  return row?.content ?? null;
}
