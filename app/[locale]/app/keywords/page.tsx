import type { Metadata } from "next";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { KeywordSearch } from "@/components/keywords/keyword-search";
import { Sparkline } from "@/components/keywords/sparkline";
import { TrackButton } from "@/components/keywords/track-button";
import { UpgradeLink } from "@/components/upgrade-link";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import {
  listTrackedKeywordIds,
  queryKeywords,
  relatedHashtags,
} from "@/lib/data";
import type { Competition, KeywordRow, RelatedHashtag } from "@/lib/data";
import {
  DEFAULT_PAGE_SIZE,
  FREE_ROW_CAP,
  withRecencyGate,
} from "@/lib/keywords/gate";
import type {
  DisplayGrowth,
  KeywordLocale,
  KeywordQuery,
  SortColumn,
  SortDirection,
} from "@/lib/keywords/gate";
import { planConfig } from "@/lib/plan";
import { formatSearchVolume } from "@/lib/scoring";
import { trackKeywordAction } from "./actions";

const KEYWORD_LOCALES: KeywordLocale[] = ["en", "vi", "id"];
const SORT_COLUMNS: SortColumn[] = [
  "term",
  "videoCount",
  "totalViews",
  "growth7d",
  "growth30d",
];
const GROWTH_OPTIONS = ["", "0", "0.1", "0.25"] as const;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "keywords" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseQuery(
  raw: Record<string, string | string[] | undefined>,
  uiLocale: string,
): KeywordQuery {
  const kwl = first(raw.kwl);
  const locale = KEYWORD_LOCALES.includes(kwl as KeywordLocale)
    ? (kwl as KeywordLocale)
    : KEYWORD_LOCALES.includes(uiLocale as KeywordLocale)
      ? (uiLocale as KeywordLocale)
      : "en";
  const sortRaw = first(raw.sort);
  const sort = SORT_COLUMNS.includes(sortRaw as SortColumn)
    ? (sortRaw as SortColumn)
    : "totalViews";
  const direction: SortDirection = first(raw.dir) === "asc" ? "asc" : "desc";
  const growthRaw = first(raw.growth);
  const minGrowth30d =
    growthRaw !== "" && Number.isFinite(Number(growthRaw))
      ? Number(growthRaw)
      : undefined;
  const page = Number(first(raw.page)) || 1;

  return {
    locale,
    search: first(raw.q).trim() || undefined,
    sort,
    direction,
    minGrowth30d,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/** Query string for a link, preserving current state with overrides. */
function qs(
  query: KeywordQuery,
  selected: string | undefined,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const base: Record<string, string | undefined> = {
    q: query.search,
    kwl: query.locale,
    sort: query.sort,
    dir: query.direction,
    growth: query.minGrowth30d?.toString(),
    page: query.page > 1 ? String(query.page) : undefined,
    sel: selected,
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export default async function KeywordsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, session, raw] = await Promise.all([
    getTranslations("keywords"),
    getFormatter(),
    requireSession(),
    searchParams,
  ]);

  const query = parseQuery(raw, locale);
  const selected = first(raw.sel) || undefined;
  const gated = withRecencyGate(
    { id: session.userId, plan: session.plan },
    query,
  );

  const [page, trackedIds, related] = await Promise.all([
    queryKeywords(gated),
    listTrackedKeywordIds(session.userId),
    selected
      ? relatedHashtags(selected, gated)
      : Promise.resolve<RelatedHashtag[]>([]),
  ]);

  const tracked = new Set(trackedIds);
  const isFree = session.plan === "free";
  const trackedKeywordLimit = planConfig(session.plan).trackedKeywordLimit;
  const lockedCount = Math.max(0, page.totalCount - page.rows.length);
  const asOfDate = format.dateTime(new Date(page.asOf + "T00:00:00Z"), {
    dateStyle: "medium",
  });
  const from = (gated.page - 1) * gated.pageSize + 1;
  const to = (gated.page - 1) * gated.pageSize + page.rows.length;

  const compLabels: Record<Competition, string> = {
    low: t("compLow"),
    medium: t("compMedium"),
    high: t("compHigh"),
  };
  const bandLabels = {
    rising: t("bandRising"),
    flat: t("bandFlat"),
    falling: t("bandFalling"),
  };
  const colLabels: Record<SortColumn, string> = {
    term: t("colKeyword"),
    videoCount: t("colVideos"),
    totalViews: t("colViews"),
    growth7d: t("col7d"),
    growth30d: t("col30d"),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-ink/60 mt-2 max-w-2xl text-sm">{t("sub")}</p>
        </div>
        {gated.allowExport ? (
          <a
            href={`/api/keywords/export${qs(query, undefined, { sel: undefined, page: undefined })}`}
            data-testid="export-csv"
            className="border-ink/20 hover:border-violet hover:text-violet rounded-full border px-4 py-2 text-sm font-semibold transition"
          >
            {t("exportCsv")}
          </a>
        ) : !isFree ? (
          // Creator tier: export is the pro upsell.
          <UpgradeLink
            gate="csv-export"
            path="/app/keywords"
            userId={session.userId}
            testId="export-upsell"
            className="border-ink/20 text-ink/60 hover:border-violet hover:text-violet rounded-full border border-dashed px-4 py-2 text-sm font-semibold transition"
          >
            {t("exportCsv")} — {t("proOnly")}
          </UpgradeLink>
        ) : null}
      </div>

      {isFree ? (
        <p
          data-testid="free-notice"
          className="bg-lime/40 text-ink mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm"
        >
          {t("freeNotice", { date: asOfDate, cap: FREE_ROW_CAP })}
          <UpgradeLink
            gate="stale-data"
            path="/app/keywords"
            userId={session.userId}
            testId="stale-data-upgrade"
            className="text-violet font-semibold hover:underline"
          >
            {t("upgradeCta")} →
          </UpgradeLink>
        </p>
      ) : (
        <p className="text-ink/50 mt-6 text-xs">
          {t("asOf", { date: asOfDate })}
        </p>
      )}

      {/* Filters: plain GET form, no client JS required. */}
      <form
        method="GET"
        className="mt-6 flex flex-wrap items-center gap-3"
        data-testid="filters"
      >
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.direction} />
        <KeywordSearch
          name="q"
          defaultValue={query.search ?? ""}
          keywordLocale={query.locale}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
        />
        <label className="text-ink/60 flex items-center gap-2 text-sm">
          {t("filterLocale")}
          <select
            name="kwl"
            defaultValue={query.locale}
            className="border-ink/20 h-11 rounded-full border bg-white px-3 text-sm"
          >
            {KEYWORD_LOCALES.map((kwLocale) => (
              <option key={kwLocale} value={kwLocale}>
                {kwLocale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-ink/60 flex items-center gap-2 text-sm">
          {t("filterGrowth")}
          <select
            name="growth"
            defaultValue={query.minGrowth30d?.toString() ?? ""}
            className="border-ink/20 h-11 rounded-full border bg-white px-3 text-sm"
          >
            {GROWTH_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === ""
                  ? t("growthAny")
                  : value === "0"
                    ? t("growthPos")
                    : value === "0.1"
                      ? t("growth10")
                      : t("growth25")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-ink hover:bg-ink/85 h-11 rounded-full px-5 text-sm font-semibold text-white transition"
        >
          {t("apply")}
        </button>
      </form>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="border-ink/10 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-ink/10 text-ink/50 border-b text-left text-xs uppercase">
                  {SORT_COLUMNS.map((column) => {
                    const active = query.sort === column;
                    const nextDir =
                      active && query.direction === "desc" ? "asc" : "desc";
                    return (
                      <th key={column} className="px-4 py-3 font-semibold">
                        <Link
                          href={`/app/keywords${qs(query, selected, { sort: column, dir: nextDir, page: undefined })}`}
                          className="hover:text-ink inline-flex items-center gap-1"
                        >
                          {colLabels[column]}
                          {active ? (
                            <span aria-hidden="true">
                              {query.direction === "desc" ? "▼" : "▲"}
                            </span>
                          ) : null}
                        </Link>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 font-semibold">
                    {t("colCompetition")}
                  </th>
                  <th className="px-4 py-3 font-semibold">{t("colTrend")}</th>
                  <th className="px-4 py-3 font-semibold">{t("colTrack")}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-ink/50 px-4 py-10 text-center"
                    >
                      {t("noResults")}
                    </td>
                  </tr>
                ) : (
                  page.rows.map((row) => (
                    <KeywordTableRow
                      key={row.id}
                      row={row}
                      query={query}
                      selected={selected}
                      compLabel={compLabels[row.competition]}
                      bandLabels={bandLabels}
                      trackLabel={t("track")}
                      trackedLabel={t("tracked")}
                      trackLimitLabel={t("trackLimit", {
                        limit: trackedKeywordLimit,
                      })}
                      isTracked={tracked.has(row.id)}
                    />
                  ))
                )}
                {isFree && lockedCount > 0
                  ? Array.from({ length: Math.min(lockedCount, 4) }).map(
                      (_, i) => <LockedRow key={`locked-${i}`} />,
                    )
                  : null}
              </tbody>
            </table>
            {isFree && lockedCount > 0 ? (
              <div
                data-testid="upgrade-wall"
                className="border-ink/10 flex flex-col items-center gap-3 border-t bg-gradient-to-b from-white to-white px-6 py-8 text-center"
              >
                <p className="text-lg font-bold">{t("upgradeTitle")}</p>
                <p className="text-ink/60 max-w-md text-sm">
                  {t("upgradeSub")} — {t("lockedRows", { count: lockedCount })}
                </p>
                <UpgradeLink
                  gate="keywords-blur"
                  path="/app/keywords"
                  userId={session.userId}
                  testId="upgrade-cta"
                  className="bg-violet hover:bg-violet/90 mt-1 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition"
                >
                  {t("upgradeCta")}
                </UpgradeLink>
              </div>
            ) : null}
          </div>

          {!isFree ? (
            <div className="text-ink/60 mt-4 flex items-center justify-between text-sm">
              <span>
                {page.totalCount > 0
                  ? t("pageInfo", { from, to, total: page.totalCount })
                  : null}
              </span>
              <div className="flex gap-3">
                {gated.page > 1 ? (
                  <Link
                    href={`/app/keywords${qs(query, selected, { page: String(gated.page - 1) })}`}
                    className="text-violet font-medium hover:underline"
                  >
                    ← {t("pagePrev")}
                  </Link>
                ) : null}
                {to < page.totalCount ? (
                  <Link
                    href={`/app/keywords${qs(query, selected, { page: String(gated.page + 1) })}`}
                    className="text-violet font-medium hover:underline"
                  >
                    {t("pageNext")} →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <aside
          data-testid="related-panel"
          className="border-ink/10 h-fit rounded-2xl border p-5"
        >
          {selected ? (
            <>
              <h2 className="font-bold">
                {t("relatedTitle", { term: selected })}
              </h2>
              <p className="text-ink/50 mt-1 text-xs">{t("relatedSub")}</p>
              {related.length === 0 ? (
                <p className="text-ink/50 mt-4 text-sm">{t("relatedEmpty")}</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {related.map((item) => (
                    <li
                      key={item.hashtag}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-violet font-medium">
                        #{item.hashtag}
                      </span>
                      <span className="text-ink/50 text-xs whitespace-nowrap">
                        {t("sharedVideos", { count: item.sharedVideos })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-ink/50 text-sm">{t("relatedHint")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function GrowthCell({
  growth,
  bandLabels,
}: {
  growth: DisplayGrowth;
  bandLabels: Record<"rising" | "flat" | "falling", string>;
}) {
  if (growth.exact !== null) {
    const pct = growth.exact * 100;
    const text = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    const color =
      growth.band === "rising"
        ? "text-emerald-600"
        : growth.band === "falling"
          ? "text-red-600"
          : "text-ink/60";
    return <span className={`font-medium ${color}`}>{text}</span>;
  }

  const chip =
    growth.band === "rising"
      ? "bg-lime text-ink"
      : growth.band === "falling"
        ? "bg-red-100 text-red-700"
        : "bg-ink/10 text-ink/60";
  return (
    <span
      data-testid="growth-band"
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}
    >
      {bandLabels[growth.band]}
    </span>
  );
}

function KeywordTableRow({
  row,
  query,
  selected,
  compLabel,
  bandLabels,
  trackLabel,
  trackedLabel,
  trackLimitLabel,
  isTracked,
}: {
  row: KeywordRow;
  query: KeywordQuery;
  selected: string | undefined;
  compLabel: string;
  bandLabels: Record<"rising" | "flat" | "falling", string>;
  trackLabel: string;
  trackedLabel: string;
  trackLimitLabel: string;
  isTracked: boolean;
}) {
  const compChip: Record<Competition, string> = {
    low: "bg-lime text-ink",
    medium: "bg-amber-100 text-amber-900",
    high: "bg-red-100 text-red-700",
  };
  const isSelected = selected === row.term;

  return (
    <tr
      data-testid="keyword-row"
      className={`border-ink/5 border-b last:border-b-0 ${isSelected ? "bg-violet/5" : ""}`}
    >
      <td className="px-4 py-3">
        <Link
          href={`/app/keywords${qs(query, row.term, {})}`}
          className="text-ink hover:text-violet font-medium"
        >
          {row.term}
        </Link>
      </td>
      <td className="px-4 py-3 tabular-nums">
        {formatSearchVolume(row.videoCount)}
      </td>
      <td className="px-4 py-3 tabular-nums">
        {formatSearchVolume(row.totalViews)}
      </td>
      <td className="px-4 py-3">
        <GrowthCell growth={row.growth7d} bandLabels={bandLabels} />
      </td>
      <td className="px-4 py-3">
        <GrowthCell growth={row.growth30d} bandLabels={bandLabels} />
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${compChip[row.competition]}`}
        >
          {compLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <Sparkline values={row.spark} />
      </td>
      <td className="px-4 py-3">
        <TrackButton
          action={trackKeywordAction}
          keywordId={row.id}
          label={trackLabel}
          trackedLabel={trackedLabel}
          limitLabel={trackLimitLabel}
          limitHref="/pricing?from=keyword-track-limit"
          initialTracked={isTracked}
        />
      </td>
    </tr>
  );
}

/** Blurred placeholder — real data for locked rows never reaches the client. */
function LockedRow() {
  return (
    <tr
      data-testid="locked-row"
      aria-hidden="true"
      className="border-ink/5 border-b select-none last:border-b-0"
    >
      <td className="px-4 py-3">
        <div className="bg-ink/15 h-3.5 w-28 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-3.5 w-10 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-3.5 w-12 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-3.5 w-10 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-3.5 w-10 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-4 w-14 rounded-full blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-violet/15 h-4 w-20 rounded blur-[3px]" />
      </td>
      <td className="px-4 py-3">
        <div className="bg-ink/10 h-4 w-12 rounded-full blur-[3px]" />
      </td>
    </tr>
  );
}
