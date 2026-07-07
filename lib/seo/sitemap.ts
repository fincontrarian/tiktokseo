/**
 * Sitemap XML builders. Pure TypeScript except gzip (node:zlib, no
 * framework imports). Chunking honors SITEMAP_MAX_URLS so children never
 * exceed Google's limits.
 */
import { gzipSync } from "node:zlib";
import { SITEMAP_MAX_URLS } from "./config";

export interface SitemapUrl {
  loc: string;
  lastmod?: string; // YYYY-MM-DD
  changefreq?: "daily" | "weekly" | "monthly";
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function chunkUrls<T>(
  items: T[],
  size: number = SITEMAP_MAX_URLS,
): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function buildSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
      if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`);
      if (url.changefreq) {
        parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildSitemapIndexXml(
  children: Array<{ loc: string; lastmod?: string }>,
): string {
  const entries = children
    .map((child) => {
      const parts = [`    <loc>${escapeXml(child.loc)}</loc>`];
      if (child.lastmod) parts.push(`    <lastmod>${child.lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export function gzipXml(xml: string): Buffer {
  return gzipSync(Buffer.from(xml, "utf-8"));
}

/**
 * Expand a path into its localized URL variants: en at the root, vi/id
 * prefixed — mirrors i18n/routing.ts (localePrefix: "as-needed").
 */
export function localizedLocs(baseUrl: string, path: string): string[] {
  return [`${baseUrl}${path}`, `${baseUrl}/vi${path}`, `${baseUrl}/id${path}`];
}
