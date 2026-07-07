/**
 * Recency gating — the monetization mechanic. Pure TypeScript, no framework
 * imports. This module wraps the data layer: every keyword query MUST pass
 * through withRecencyGate() before it reaches a repository, so the UI never
 * decides what a plan may see.
 *
 * free plan: stats computed on data >30 days old, at most 3 rows, growth
 * reduced to bands, no export, long cache.
 * paid plan: fresh data, paginated rows, exact numbers, CSV export, short
 * cache.
 */

import { planConfig } from "@/lib/plan";
import type { Plan } from "@/lib/plan";

export type { Plan };

export interface GateUser {
  id: string;
  plan: Plan;
}

export type KeywordLocale = "en" | "vi" | "id";

export type SortColumn =
  "term" | "videoCount" | "totalViews" | "growth7d" | "growth30d";

export type SortDirection = "asc" | "desc";

export interface KeywordQuery {
  locale: KeywordLocale;
  /** Prefix search over the keyword term. */
  search?: string;
  sort: SortColumn;
  direction: SortDirection;
  /** Only keywords whose 30d growth is at least this fraction (0.1 = +10%). */
  minGrowth30d?: number;
  page: number;
  pageSize: number;
}

export type GrowthPrecision = "exact" | "banded";

export interface GatedKeywordQuery extends KeywordQuery {
  /** Stats are computed on data up to this date (start of day, UTC). */
  asOf: Date;
  /** Hard cap on returned rows; null = pagination governs. */
  rowCap: number | null;
  precision: GrowthPrecision;
  allowExport: boolean;
  cacheTtlSeconds: number;
}

export const FREE_DATA_DELAY_DAYS = 30;
export const FREE_ROW_CAP = 3;
export const FREE_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const PAID_CACHE_TTL_SECONDS = 5 * 60;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * The gate. Takes the user's raw query intent and returns the query the data
 * layer is actually allowed to run. Deterministic given `now`.
 */
export function withRecencyGate(
  user: GateUser,
  query: KeywordQuery,
  now: Date = new Date(),
): GatedKeywordQuery {
  const pageSize = clampInt(query.pageSize, 1, MAX_PAGE_SIZE);
  const page = clampInt(query.page, 1, 10_000);
  const config = planConfig(user.plan);

  if (config.freshKeywordData) {
    return {
      ...query,
      page,
      pageSize,
      asOf: startOfUtcDay(now),
      rowCap: config.keywordRowCap,
      precision: "exact",
      allowExport: config.csvExport,
      cacheTtlSeconds: PAID_CACHE_TTL_SECONDS,
    };
  }

  // Delayed tier: old data, first page only, capped rows, banded growth.
  const rowCap = config.keywordRowCap ?? FREE_ROW_CAP;
  return {
    ...query,
    page: 1,
    pageSize: rowCap,
    asOf: startOfUtcDay(
      new Date(now.getTime() - FREE_DATA_DELAY_DAYS * DAY_MS),
    ),
    rowCap,
    precision: "banded",
    allowExport: config.csvExport,
    cacheTtlSeconds: FREE_CACHE_TTL_SECONDS,
  };
}

// --- Growth precision -------------------------------------------------------

export type GrowthBand = "rising" | "flat" | "falling";

/** Growth within ±5% counts as flat. */
export const FLAT_BAND_THRESHOLD = 0.05;

export function bandGrowth(growth: number | null): GrowthBand {
  if (growth === null || !Number.isFinite(growth)) return "flat";
  if (growth >= FLAT_BAND_THRESHOLD) return "rising";
  if (growth <= -FLAT_BAND_THRESHOLD) return "falling";
  return "flat";
}

/**
 * What the UI receives for a growth figure. On the free plan `exact` is
 * null — the number never leaves the data layer.
 */
export interface DisplayGrowth {
  exact: number | null;
  band: GrowthBand;
}

export function toDisplayGrowth(
  growth: number | null,
  precision: GrowthPrecision,
): DisplayGrowth {
  return {
    exact: precision === "exact" ? growth : null,
    band: bandGrowth(growth),
  };
}

// --- Cache key ---------------------------------------------------------------

/** Stable Redis key for a gated query; day-granular via asOf. */
export function gatedQueryCacheKey(gated: GatedKeywordQuery): string {
  const asOfDay = gated.asOf.toISOString().slice(0, 10);
  return [
    "kw:list:v1",
    gated.locale,
    gated.search?.toLowerCase() ?? "-",
    gated.sort,
    gated.direction,
    gated.minGrowth30d ?? "-",
    gated.page,
    gated.pageSize,
    gated.rowCap ?? "-",
    gated.precision,
    asOfDay,
  ].join(":");
}
