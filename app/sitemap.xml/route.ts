import { listSitemapFiles } from "@/lib/data";
import { buildSitemapIndexXml } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

const BASE = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Sitemap index pointing at the numbered children in /sitemaps/. */
export async function GET() {
  const files = await listSitemapFiles();
  const xml = buildSitemapIndexXml(
    files.map((file) => ({
      loc: `${BASE}/sitemaps/${file.name}`,
      lastmod: file.generatedAt.toISOString().slice(0, 10),
    })),
  );
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
