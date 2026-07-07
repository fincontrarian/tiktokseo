import { getSitemapFile } from "@/lib/data";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z]+-\d+\.xml$/;

/**
 * Serves a generated sitemap chunk. Content is stored gzipped and served
 * with Content-Encoding: gzip — crawlers and browsers decompress it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!NAME_RE.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  const content = await getSitemapFile(name);
  if (!content) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(content), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
