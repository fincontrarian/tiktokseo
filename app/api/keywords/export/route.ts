import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryKeywordsForExport } from "@/lib/data";
import { toCsv } from "@/lib/keywords/csv";
import { DEFAULT_PAGE_SIZE, withRecencyGate } from "@/lib/keywords/gate";
import type {
  KeywordLocale,
  KeywordQuery,
  SortColumn,
} from "@/lib/keywords/gate";

const LOCALES: KeywordLocale[] = ["en", "vi", "id"];
const SORT_COLUMNS: SortColumn[] = [
  "term",
  "videoCount",
  "totalViews",
  "growth7d",
  "growth30d",
];

/**
 * CSV export of the current keyword view. Paid plans only — the recency
 * gate decides, not this route.
 */
export async function GET(request: Request) {
  const session = await getSession();
  const url = new URL(request.url);

  const localeParam = url.searchParams.get("kwl") ?? "en";
  const sortParam = url.searchParams.get("sort") ?? "totalViews";
  const growthParam = url.searchParams.get("growth");
  const query: KeywordQuery = {
    locale: LOCALES.includes(localeParam as KeywordLocale)
      ? (localeParam as KeywordLocale)
      : "en",
    search: url.searchParams.get("q")?.trim() || undefined,
    sort: SORT_COLUMNS.includes(sortParam as SortColumn)
      ? (sortParam as SortColumn)
      : "totalViews",
    direction: url.searchParams.get("dir") === "asc" ? "asc" : "desc",
    minGrowth30d:
      growthParam !== null && Number.isFinite(Number(growthParam))
        ? Number(growthParam)
        : undefined,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const gated = withRecencyGate(
    { id: session.userId, plan: session.plan },
    query,
  );
  if (!gated.allowExport) {
    return NextResponse.json(
      { error: "CSV export is available on the paid plan." },
      { status: 403 },
    );
  }

  const page = await queryKeywordsForExport(gated);
  const csv = toCsv(
    [
      "term",
      "locale",
      "video_count",
      "total_views",
      "growth_7d",
      "growth_30d",
      "competition",
      "as_of",
    ],
    page.rows.map((row) => [
      row.term,
      row.locale,
      row.videoCount,
      row.totalViews,
      row.growth7d.exact,
      row.growth30d.exact,
      row.competition,
      page.asOf,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="keywords-${query.locale}-${page.asOf}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
