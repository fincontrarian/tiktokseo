import { NextResponse } from "next/server";
import { generateSitemaps } from "@/lib/data";

const MAX_LIMIT = 10_000_000;

/**
 * Sitemap generation cron. Rebuilds all sitemap files from the DB, applying
 * publish-quality thresholds and the page limit (?limit= or SEO_PAGE_LIMIT —
 * the launch lever). Schedule daily alongside the index refresh.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.trunc(limitRaw), MAX_LIMIT)
      : undefined;

  const result = await generateSitemaps({ limit });
  return NextResponse.json(result);
}
