import { describe, expect, it } from "vitest";
import {
  bandGrowth,
  FREE_CACHE_TTL_SECONDS,
  FREE_DATA_DELAY_DAYS,
  FREE_ROW_CAP,
  gatedQueryCacheKey,
  MAX_PAGE_SIZE,
  PAID_CACHE_TTL_SECONDS,
  toDisplayGrowth,
  withRecencyGate,
} from "./gate";
import type { GateUser, KeywordQuery } from "./gate";

const NOW = new Date("2026-07-06T15:30:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const FREE: GateUser = { id: "u1", plan: "free" };
const CREATOR: GateUser = { id: "u2", plan: "creator" };
const PRO: GateUser = { id: "u3", plan: "pro" };

function query(overrides: Partial<KeywordQuery> = {}): KeywordQuery {
  return {
    locale: "en",
    sort: "totalViews",
    direction: "desc",
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe("withRecencyGate — free plan", () => {
  it("delays data by 30 days, truncated to start of UTC day", () => {
    const gated = withRecencyGate(FREE, query(), NOW);
    expect(gated.asOf.toISOString()).toBe(
      new Date(
        Date.UTC(2026, 6, 6) - FREE_DATA_DELAY_DAYS * DAY_MS,
      ).toISOString(),
    );
    expect(gated.asOf.getUTCHours()).toBe(0);
  });

  it("caps rows at 3 and forces the first page", () => {
    const gated = withRecencyGate(FREE, query({ page: 7, pageSize: 50 }), NOW);
    expect(gated.rowCap).toBe(FREE_ROW_CAP);
    expect(gated.pageSize).toBe(FREE_ROW_CAP);
    expect(gated.page).toBe(1);
  });

  it("bands growth, blocks export, and caches for 24h", () => {
    const gated = withRecencyGate(FREE, query(), NOW);
    expect(gated.precision).toBe("banded");
    expect(gated.allowExport).toBe(false);
    expect(gated.cacheTtlSeconds).toBe(FREE_CACHE_TTL_SECONDS);
  });

  it("preserves the user's filter intent (locale, search, sort, threshold)", () => {
    const gated = withRecencyGate(
      FREE,
      query({
        locale: "vi",
        search: "bài",
        sort: "growth30d",
        direction: "asc",
        minGrowth30d: 0.1,
      }),
      NOW,
    );
    expect(gated.locale).toBe("vi");
    expect(gated.search).toBe("bài");
    expect(gated.sort).toBe("growth30d");
    expect(gated.direction).toBe("asc");
    expect(gated.minGrowth30d).toBe(0.1);
  });
});

describe("withRecencyGate — paid plans", () => {
  it("uses fresh data (start of today, UTC)", () => {
    const gated = withRecencyGate(PRO, query(), NOW);
    expect(gated.asOf.toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("keeps pagination, exact numbers, export, and a 5-minute cache", () => {
    const gated = withRecencyGate(
      CREATOR,
      query({ page: 3, pageSize: 25 }),
      NOW,
    );
    expect(gated.rowCap).toBeNull();
    expect(gated.page).toBe(3);
    expect(gated.pageSize).toBe(25);
    expect(gated.precision).toBe("exact");
    expect(gated.allowExport).toBe(true);
    expect(gated.cacheTtlSeconds).toBe(PAID_CACHE_TTL_SECONDS);
  });

  it("clamps hostile page and pageSize values", () => {
    const gated = withRecencyGate(
      PRO,
      query({ page: -5, pageSize: 10_000 }),
      NOW,
    );
    expect(gated.page).toBe(1);
    expect(gated.pageSize).toBe(MAX_PAGE_SIZE);

    const nan = withRecencyGate(
      PRO,
      query({ page: Number.NaN, pageSize: Number.NaN }),
      NOW,
    );
    expect(nan.page).toBe(1);
    expect(nan.pageSize).toBe(1);
  });

  it("is deterministic for a fixed now", () => {
    const a = withRecencyGate(PRO, query(), NOW);
    const b = withRecencyGate(PRO, query(), NOW);
    expect(a).toEqual(b);
  });
});

describe("bandGrowth", () => {
  it("maps growth to rising/flat/falling with a ±5% flat band", () => {
    expect(bandGrowth(0.3)).toBe("rising");
    expect(bandGrowth(0.05)).toBe("rising");
    expect(bandGrowth(0.049)).toBe("flat");
    expect(bandGrowth(0)).toBe("flat");
    expect(bandGrowth(-0.049)).toBe("flat");
    expect(bandGrowth(-0.05)).toBe("falling");
    expect(bandGrowth(-0.4)).toBe("falling");
  });

  it("treats null and non-finite values as flat", () => {
    expect(bandGrowth(null)).toBe("flat");
    expect(bandGrowth(Number.NaN)).toBe("flat");
    expect(bandGrowth(Number.POSITIVE_INFINITY)).toBe("flat");
  });
});

describe("toDisplayGrowth", () => {
  it("keeps exact values for exact precision", () => {
    expect(toDisplayGrowth(0.123, "exact")).toEqual({
      exact: 0.123,
      band: "rising",
    });
  });

  it("strips exact values for banded precision — numbers never leak", () => {
    expect(toDisplayGrowth(0.123, "banded")).toEqual({
      exact: null,
      band: "rising",
    });
    expect(toDisplayGrowth(-0.4, "banded")).toEqual({
      exact: null,
      band: "falling",
    });
  });
});

describe("gatedQueryCacheKey", () => {
  it("differs across tiers, filters, and asOf days", () => {
    const free = gatedQueryCacheKey(withRecencyGate(FREE, query(), NOW));
    const paid = gatedQueryCacheKey(withRecencyGate(PRO, query(), NOW));
    const paidVi = gatedQueryCacheKey(
      withRecencyGate(PRO, query({ locale: "vi" }), NOW),
    );
    const paidNextDay = gatedQueryCacheKey(
      withRecencyGate(PRO, query(), new Date(NOW.getTime() + DAY_MS)),
    );
    expect(new Set([free, paid, paidVi, paidNextDay]).size).toBe(4);
  });

  it("is stable for identical gated queries", () => {
    const a = gatedQueryCacheKey(withRecencyGate(PRO, query(), NOW));
    const b = gatedQueryCacheKey(withRecencyGate(PRO, query(), NOW));
    expect(a).toBe(b);
  });
});
