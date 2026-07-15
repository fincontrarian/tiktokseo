import { describe, expect, it } from "vitest";
import {
  annualCents,
  normalizePlan,
  PLAN_CONFIG,
  planConfig,
  PLANS,
  TRIAL_DAYS,
} from "./plan";

describe("planConfig", () => {
  it("enforces the tracked-profile limits from the spec", () => {
    expect(planConfig("free").trackedProfileLimit).toBe(1);
    expect(planConfig("creator").trackedProfileLimit).toBe(1);
    expect(planConfig("pro").trackedProfileLimit).toBe(5);
  });

  it("limits free audit re-runs to 1/day per profile", () => {
    expect(planConfig("free").auditRerunsPerDay).toBe(1);
    expect(planConfig("creator").auditRerunsPerDay).toBeGreaterThan(1);
    expect(planConfig("pro").auditRerunsPerDay).toBeGreaterThan(
      planConfig("creator").auditRerunsPerDay,
    );
  });

  it("gates keyword freshness, row cap, and export by plan", () => {
    expect(planConfig("free")).toMatchObject({
      freshKeywordData: false,
      keywordRowCap: 3,
      csvExport: false,
    });
    // Paid tiers see fresh, uncapped data; CSV export is pro-only.
    for (const plan of ["creator", "pro"] as const) {
      expect(planConfig(plan)).toMatchObject({
        freshKeywordData: true,
        keywordRowCap: null,
      });
    }
    expect(planConfig("creator").csvExport).toBe(false);
    expect(planConfig("pro").csvExport).toBe(true);
  });

  it("caps tracked keywords at 25 (creator) and 100 (pro)", () => {
    expect(planConfig("creator").trackedKeywordLimit).toBe(25);
    expect(planConfig("pro").trackedKeywordLimit).toBe(100);
    expect(planConfig("free").trackedKeywordLimit).toBeLessThan(25);
  });

  it("reserves competitor compare for pro", () => {
    expect(planConfig("pro").competitorCompare).toBe(true);
    expect(planConfig("creator").competitorCompare).toBe(false);
    expect(planConfig("free").competitorCompare).toBe(false);
  });

  it("prices creator at $12/mo and pro at $29/mo with a 20% annual discount", () => {
    expect(planConfig("free").pricing).toBeNull();
    expect(planConfig("creator").pricing).toEqual({
      monthlyCents: 1200,
      annualCents: 11520,
      trialDays: TRIAL_DAYS,
    });
    expect(planConfig("pro").pricing).toEqual({
      monthlyCents: 2900,
      annualCents: 27840,
      trialDays: TRIAL_DAYS,
    });
    expect(annualCents(1000)).toBe(9600);
    expect(TRIAL_DAYS).toBe(7);
  });

  it("covers every plan exactly once", () => {
    expect(Object.keys(PLAN_CONFIG).sort()).toEqual([...PLANS].sort());
    for (const plan of PLANS) {
      expect(PLAN_CONFIG[plan].id).toBe(plan);
    }
  });
});

describe("normalizePlan", () => {
  it("passes valid plans through and defaults everything else to free", () => {
    expect(normalizePlan("creator")).toBe("creator");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan("paid")).toBe("free");
    expect(normalizePlan("")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
  });
});
